// Edge Function: send-appointment-reminders
// Runs on a schedule (a Supabase Cron Job hitting this URL every minute) and
// alerts each consultor whose next appointment just entered their
// configured lead time (profiles.notify_lead_minutes, default 30) — as a
// browser/phone push notification, and optionally as a WhatsApp message for
// consultores who opted into that channel (profiles.notify_whatsapp). Acts
// on behalf of the whole team via the service role key — there's no single
// authenticated caller, since this is only ever invoked by the scheduler.
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

  const upcoming = (appts ?? []).filter((a) => apptInstant(a.date, a.time) > now)
  if (upcoming.length === 0) return json({ ok: true, sent: 0 })

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
  if (due.length === 0) return json({ ok: true, sent: 0 })

  let sent = 0
  for (const appt of due) {
    const title = `${TYPE_LABELS[appt.type] ?? appt.type} às ${appt.time}`

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('consultant_id', appt.consultant_id)

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({ title, body: appt.client_name, url: '/' })
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }

    const consultantProfile = profileById.get(appt.consultant_id)
    if (consultantProfile?.notify_whatsapp && consultantProfile.phone) {
      await sendWhatsApp(consultantProfile.phone as string, title, appt.client_name)
    }

    await admin.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
    sent++
  }

  return json({ ok: true, sent })
})
