// Edge Function: get-invite
// Public (unauthenticated) lookup of a pending invite by its token, used by the
// /convite/:token page to show "Convite para <name>" before they set a password.
// Deploy: supabase functions deploy get-invite
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { token } = await req.json()
  if (!token) return json({ error: 'Convite inválido.' }, 400)

  const { data: invite } = await admin
    .from('invites')
    .select('name, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return json({ error: 'Convite não encontrado.' }, 404)
  if (invite.used_at) return json({ error: 'Esse convite já foi usado.' }, 400)
  if (new Date(invite.expires_at) < new Date()) return json({ error: 'Esse convite expirou.' }, 400)

  return json({ ok: true, name: invite.name, email: invite.email })
})
