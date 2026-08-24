// Edge Function: send-daily-digest
// Runs once a day (Cron Job at 09:00 UTC = 06:00 América/São Paulo — Brazil
// has had a single fixed UTC-3 offset nationwide since abolishing DST in
// 2019) and sends every líder/consultor a summary of their OWN day's
// appointments — push notification, plus WhatsApp for whoever opted in.
// Separate from send-appointment-reminders (migration 0022), which handles
// the per-appointment "X minutes before" alert; this one is the "here's your
// whole day" morning digest.
// Deploy: supabase functions deploy send-daily-digest
//
// Reuses the exact same secrets as send-appointment-reminders: VAPID_*,
// CRON_SECRET, and (optional) the TWILIO_* ones for WhatsApp — see that
// function/README for what each one is. No new secrets needed.
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

function toE164BR(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  return `+55${digits}`
}

// The WhatsApp template approved for send-appointment-reminders only has two
// generic variables, so the digest reuses it (title in {{1}}, the day's
// summary packed into {{2}}) rather than requiring a second Meta-approved
// template just for this. Falls back to free text (Twilio Sandbox only)
// when no Content SID is configured.
async function sendWhatsApp(toPhone: string, title: string, summary: string) {
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
    params.set('ContentVariables', JSON.stringify({ '1': title, '2': summary }))
  } else {
    params.set('Body', `📅 ${title}: ${summary}`)
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

function todayBR(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
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

  const today = todayBR()
  const { data: appts, error } = await admin
    .from('appointments')
    .select('consultant_id, client_name, type, time')
    .eq('date', today)
    .order('time')
  if (error) return json({ error: error.message }, 500)
  if (!appts || appts.length === 0) return json({ ok: true, sent: 0 })

  const byConsultant = new Map<string, typeof appts>()
  for (const a of appts) {
    const arr = byConsultant.get(a.consultant_id) ?? []
    arr.push(a)
    byConsultant.set(a.consultant_id, arr)
  }

  const consultantIds = [...byConsultant.keys()]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, notify_whatsapp, phone')
    .in('id', consultantIds)
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]))

  let sent = 0
  for (const [consultantId, list] of byConsultant) {
    const lines = list.map((a) => `${a.time} ${TYPE_LABELS[a.type] ?? a.type} - ${a.client_name}`)
    const title = `📅 Sua agenda de hoje (${list.length} compromisso${list.length > 1 ? 's' : ''})`
    const summary = lines.join('; ')

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('consultant_id', consultantId)

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({ title, body: lines.join('\n'), url: '/' })
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

    const consultantProfile = profileById.get(consultantId)
    if (consultantProfile?.notify_whatsapp && consultantProfile.phone) {
      await sendWhatsApp(consultantProfile.phone as string, title, summary)
    }

    sent++
  }

  return json({ ok: true, sent })
})
