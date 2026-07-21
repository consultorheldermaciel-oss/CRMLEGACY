// Edge Function: accept-invite
// Public (unauthenticated) endpoint the /convite/:token page calls once the
// consultor picks a password. Creates their auth user + profile and marks the
// invite as used.
// Deploy: supabase functions deploy accept-invite
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CONSULTANT_COLORS = ['#0B2D5B', '#3FA66B', '#B5622A', '#6B4FA0', '#1E7A8C']

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

  const { token, password } = await req.json()
  if (!token || !password || password.length < 8) {
    return json({ error: 'Convite ou senha inválidos.' }, 400)
  }

  const { data: invite } = await admin
    .from('invites')
    .select('id, name, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return json({ error: 'Convite não encontrado.' }, 404)
  if (invite.used_at) return json({ error: 'Esse convite já foi usado.' }, 400)
  if (new Date(invite.expires_at) < new Date()) return json({ error: 'Esse convite expirou.' }, 400)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { name: invite.name },
  })
  if (createError || !created?.user) {
    return json({ error: createError?.message ?? 'Falha ao criar a conta.' }, 400)
  }

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
  const color = CONSULTANT_COLORS[(count ?? 0) % CONSULTANT_COLORS.length]

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, role: 'consultor', name: invite.name, email: invite.email, color }, { onConflict: 'id' })
  if (profileError) {
    return json({ error: profileError.message }, 400)
  }

  await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

  return json({ ok: true, email: invite.email })
})
