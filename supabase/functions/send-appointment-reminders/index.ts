// Edge Function: send-appointment-reminders
// Runs on a schedule (a Supabase Cron Job hitting this URL every minute) and
// does three independent things:
//   1. Alerts each consultor whose next appointment just entered their
//      configured lead time (profiles.notify_lead_minutes, default 30).
//   2. Alerts the líder (profiles.manager_id of the appointment's owner) as
//      soon as a consultor flags `wants_manager` ("⭐ Chamar o líder de
//      unidade") — independent of the appointment's start time, since this
//      is "you were called into something", not a start-time reminder.
//   3. Alerts the líder when a consultor's weekly self-report (migration
//      0026) diverges from what the system computed automatically.
// All three are push notification, plus optionally WhatsApp for whoever
// opted into that channel (profiles.notify_whatsapp). Acts on behalf of the
// whole team via the service role key — there's no single authenticated
// caller, since this is only ever invoked by the scheduler.
// Deploy: supabase functions deploy send-appointment-reminders
//
// Required secrets (Project Settings → Edge Functions → Secrets, or
// `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (e.g. mailto:voce@exemplo.com), CRON_SECRET (any random
// string — set the same value as a header when creating the Cron Job so
// only that job can trigger this function).
//
// Optional, for the WhatsApp channel (skipped silently if unset):
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g.
// "whatsapp:+14155238886"), and TWILIO_WHATSAPP_CONTENT_SID — the SID of an
// approved WhatsApp message template with two variables ({{1}} = "Fechamento
// às 15:00", {{2}} = client name). Without a Content SID, messages are sent
// as free-form text instead, which only reaches numbers that joined the
// Twilio WhatsApp Sandbox — fine for testing, not for production.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const TYPE_LABELS: Record<string, string> = {
  abordagem: 'Abordagem',
  fechamento: 'Fechamento',
  entrega: 'Entrega de apólice',
  outros: 'Compromisso',
  evento: 'Evento',
}

// Appointment date/time are stored as plain "civil time" strings with no
// timezone (e.g. "2026-08-04" / "09:00") — the whole app only ever compares
// them as strings in the browser's own local time. Brazil has had a single,
// fixed UTC-3 offset nationwide since abolishing DST in 2019, so anchoring
// them here to -03:00 recovers the correct real-world instant regardless of
// the timezone this function happens to run in.
function apptInstant(date: string, time: string): number {
  return new Date(`${date}T${time}:00-03:00`).getTime()
}

// profiles.phone is free-typed by the líder (e.g. "(11) 99999-0000") —
// normalize to E.164 assuming Brazil when no country code is present.
function toE164BR(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  return `+55${digits}`
}

async function sendWhatsApp(toPhone: string, title: string, clientName: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!sid || !token || !from) return
  const to = toE164BR(toPhone)
  if (!to) return

  const contentSid = Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')
  const params = new URLSearchParams({ From: from, To: `whatsapp:${to}` })
  if (contentSid) {
    params.set('ContentSid', contentSid)
    params.set('ContentVariables', JSON.stringify({ '1': title, '2': clientName }))
  } else {
    params.set('Body', `🔔 Lembrete Legacy: ${title} com ${clientName}.`)
  }

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).catch((err) => console.error('WhatsApp send failed', err))
}

// Sends a push notification to every device a profile has registered
// (push_subscriptions.consultant_id — despite the column name, it's just
// "which profile owns this subscription", used for líderes too), pruning
// any subscription the push service reports as gone (404/410).
// deno-lint-ignore no-explicit-any
async function pushToProfile(admin: any, profileId: string, title: string, body: string) {
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('consultant_id', profileId)
  if (!subs || subs.length === 0) {
    console.log(`pushToProfile: no subscription registered for profile ${profileId}`)
    return
  }
  const payload = JSON.stringify({ title, body, url: '/' })
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      console.log(`pushToProfile: sent ok to ${sub.endpoint}`)
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode
      const respBody = (err as { body?: string })?.body
      console.error(`pushToProfile: send failed for ${sub.endpoint} — status ${statusCode} — body: ${respBody} — err: ${err}`)
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Não autorizado.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const now = Date.now()
  const { data: appts, error } = await admin
    .from('appointments')
    .select('id, consultant_id, client_name, type, date, time')
    .eq('reminder_sent', false)
    .eq('status', 'agendado')
  if (error) return json({ error: error.message }, 500)

  // Each of these three checks (X-minutes-before reminder, manager alert,
  // self-report divergence) is independent — none of them may early-return
  // the whole function, or it skips the other two whenever this particular
  // one has nothing to do (the common case on any given minute).
  const upcoming = (appts ?? []).filter((a) => apptInstant(a.date, a.time) > now)

  const consultantIds = [...new Set(upcoming.map((a) => a.consultant_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, notify_lead_minutes, notify_whatsapp, phone')
    .in('id', consultantIds)
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  const due = upcoming.filter((a) => {
    const lead = (profileById.get(a.consultant_id)?.notify_lead_minutes as number | undefined) ?? 30
    return apptInstant(a.date, a.time) - now <= lead * 60_000
  })

  let sent = 0
  for (const appt of due) {
    const title = `${TYPE_LABELS[appt.type] ?? appt.type} às ${appt.time}`
    await pushToProfile(admin, appt.consultant_id, title, appt.client_name)

    const consultantProfile = profileById.get(appt.consultant_id)
    if (consultantProfile?.notify_whatsapp && consultantProfile.phone) {
      await sendWhatsApp(consultantProfile.phone as string, title, appt.client_name)
    }

    await admin.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
    sent++
  }

  // Manager ("líder") alert — fires once as soon as `wants_manager` is
  // noticed, regardless of how far away the appointment is.
  const { data: managerPending, error: managerError } = await admin
    .from('appointments')
    .select('id, consultant_id, client_name, type, date, time')
    .eq('wants_manager', true)
    .eq('manager_notified', false)
    .eq('status', 'agendado')
  if (managerError) return json({ error: managerError.message }, 500)

  let managerSent = 0
  if (managerPending && managerPending.length > 0) {
    const ownerIds = [...new Set(managerPending.map((a) => a.consultant_id))]
    const { data: owners } = await admin.from('profiles').select('id, name, manager_id').in('id', ownerIds)
    const ownerById = new Map((owners ?? []).map((p) => [p.id as string, p]))

    const managerIds = [
      ...new Set(
        managerPending
          .map((a) => ownerById.get(a.consultant_id)?.manager_id as string | null | undefined)
          .filter((id): id is string => !!id),
      ),
    ]
    const { data: managers } = await admin
      .from('profiles')
      .select('id, notify_whatsapp, phone')
      .in('id', managerIds)
    const managerById = new Map((managers ?? []).map((p) => [p.id as string, p]))

    for (const appt of managerPending) {
      const owner = ownerById.get(appt.consultant_id)
      const managerId = owner?.manager_id as string | null | undefined

      if (managerId) {
        const [y, m, d] = appt.date.split('-')
        const title = `⭐ ${owner?.name?.split(' ')[0] ?? 'Um consultor'} chamou você`
        const body = `${TYPE_LABELS[appt.type] ?? appt.type} com ${appt.client_name} — ${d}/${m}/${y} às ${appt.time}`
        await pushToProfile(admin, managerId, title, body)

        const managerProfile = managerById.get(managerId)
        if (managerProfile?.notify_whatsapp && managerProfile.phone) {
          await sendWhatsApp(managerProfile.phone as string, title, body)
        }
        managerSent++
      }

      await admin.from('appointments').update({ manager_notified: true }).eq('id', appt.id)
    }
  }

  // Self-report divergence alert — the consultor's weekly self-report
  // (migration 0026) didn't match what buildWeeklyReport computed from their
  // own appointments; let the líder know.
  const { data: divergentReports, error: divergenceError } = await admin
    .from('weekly_self_reports')
    .select('id, consultant_id, week_start, divergence_details')
    .eq('has_divergence', true)
    .eq('manager_notified', false)
  if (divergenceError) return json({ error: divergenceError.message }, 500)

  let divergenceSent = 0
  if (divergentReports && divergentReports.length > 0) {
    const ownerIds = [...new Set(divergentReports.map((r) => r.consultant_id))]
    const { data: owners } = await admin.from('profiles').select('id, name, manager_id').in('id', ownerIds)
    const ownerById = new Map((owners ?? []).map((p) => [p.id as string, p]))

    const managerIds = [
      ...new Set(
        divergentReports
          .map((r) => ownerById.get(r.consultant_id)?.manager_id as string | null | undefined)
          .filter((id): id is string => !!id),
      ),
    ]
    const { data: managers } = await admin
      .from('profiles')
      .select('id, notify_whatsapp, phone')
      .in('id', managerIds)
    const managerById = new Map((managers ?? []).map((p) => [p.id as string, p]))

    for (const report of divergentReports) {
      const owner = ownerById.get(report.consultant_id)
      const managerId = owner?.manager_id as string | null | undefined

      if (managerId) {
        const [y, m, d] = (report.week_start as string).split('-')
        const title = `⚠️ Divergência no relatório de ${owner?.name?.split(' ')[0] ?? 'um consultor'}`
        const body = (report.divergence_details as string) || `Semana de ${d}/${m}/${y} — confira o relatório semanal.`
        await pushToProfile(admin, managerId, title, body)

        const managerProfile = managerById.get(managerId)
        if (managerProfile?.notify_whatsapp && managerProfile.phone) {
          await sendWhatsApp(managerProfile.phone as string, title, body)
        }
        divergenceSent++
      }

      await admin.from('weekly_self_reports').update({ manager_notified: true }).eq('id', report.id)
    }
  }

  return json({ ok: true, sent, managerSent, divergenceSent })
})
