// Edge Function: invite-consultor
// Called by an authenticated 'lider' to create a consultor account and send them
// a Supabase invite email (magic link) to set their own password.
// Deploy: supabase functions deploy invite-consultor
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CONSULTANT_COLORS = ['#0B2D5B', '#3FA66B', '#B5622A', '#6B4FA0', '#1E7A8C']

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
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
    return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'lider') {
    return new Response(
      JSON.stringify({ error: 'Só o líder de unidade pode convidar consultores.' }),
      { status: 403 },
    )
  }

  const { email, name } = await req.json()
  if (!email || !name) {
    return new Response(JSON.stringify({ error: 'Informe nome e e-mail.' }), { status: 400 })
  }

  const { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
  })
  if (inviteError || !created?.user) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? 'Falha ao convidar.' }), {
      status: 400,
    })
  }

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
  const color = CONSULTANT_COLORS[(count ?? 0) % CONSULTANT_COLORS.length]

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: created.user.id, role: 'consultor', name, email, color }, { onConflict: 'id' })
  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 400 })
  }

  return new Response(JSON.stringify({ ok: true, userId: created.user.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
