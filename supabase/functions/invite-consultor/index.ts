// Edge Function: invite-consultor
// Called by an authenticated 'lider' to create a consultor account and generate an
// invite link for them to set their own password. The link is returned to the caller
// (instead of only being emailed) so the lider can share it via WhatsApp, email, etc.
// Deploy: supabase functions deploy invite-consultor
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

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Client scoped to the caller, used only to verify who is calling and their role.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser()
  if (!caller) {
    return json({ error: 'Não autenticado.' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'lider') {
    return json({ error: 'Só o líder de unidade pode convidar consultores.' }, 403)
  }

  const { email, name, redirectTo } = await req.json()
  if (!email || !name) {
    return json({ error: 'Informe nome e e-mail.' }, 400)
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { name },
      redirectTo: redirectTo || undefined,
    },
  })
  if (linkError || !linkData?.user) {
    return json({ error: linkError?.message ?? 'Falha ao gerar convite.' }, 400)
  }

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
  const color = CONSULTANT_COLORS[(count ?? 0) % CONSULTANT_COLORS.length]

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: linkData.user.id, role: 'consultor', name, email, color }, { onConflict: 'id' })
  if (profileError) {
    return json({ error: profileError.message }, 400)
  }

  return json({ ok: true, userId: linkData.user.id, inviteLink: linkData.properties?.action_link })
})
