// Edge Function: send-appointment-reminders
// Runs on a schedule (a Supabase Cron Job hitting this URL every minute) and
// pushes a browser/phone notification to each consultor whose next
// appointment just entered their configured lead time
// (profiles.notify_lead_minutes, default 30). Acts on behalf of the whole
// team via the service role key — there's no single authenticated caller,
// since this is only ever invoked by the scheduler.
// Deploy: supabase functions deploy send-appointment-reminders
//
// Required secrets (Project Settings → Edge Functions → Secrets, or
// `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (e.g. mailto:voce@exemplo.com), CRON_SECRET (any random
// string — set the same value as a header when creating the Cron Job so
// only that job can trigger this function).
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
  const { data: profiles } = await admin.from('profiles').select('id, notify_lead_minutes').in('id', consultantIds)
  const leadById = new Map((profiles ?? []).map((p) => [p.id as string, (p.notify_lead_minutes as number) ?? 30]))

  const due = upcoming.filter((a) => {
    const lead = leadById.get(a.consultant_id) ?? 30
    return apptInstant(a.date, a.time) - now <= lead * 60_000
  })
  if (due.length === 0) return json({ ok: true, sent: 0 })

  let sent = 0
  for (const appt of due) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('consultant_id', appt.consultant_id)

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title: `${TYPE_LABELS[appt.type] ?? appt.type} às ${appt.time}`,
        body: appt.client_name,
        url: '/',
      })
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
    await admin.from('appointments').update({ reminder_sent: true }).eq('id', appt.id)
    sent++
  }

  return json({ ok: true, sent })
})
