// Edge Function: toggle-hierarchy
// Called by an authenticated 'lider' to turn the "líder de agência" tier on
// or off for their own unit. Off by default (see migration 0008) — a lider
// only flips this once they're actually ready to bring a líder de agência
// into the hierarchy. invite-consultor checks this flag server-side before
// allowing the diretor-bootstrap invite, so the switch is a real gate, not
// just a hidden UI element.
// Deploy: supabase functions deploy toggle-hierarchy
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

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    return json({ error: 'Só o líder de unidade pode ativar essa opção.' }, 403)
  }

  const { enabled } = await req.json()
  if (typeof enabled !== 'boolean') {
    return json({ error: 'Valor inválido.' }, 400)
  }

  const { error } = await admin.from('profiles').update({ hierarchy_enabled: enabled }).eq('id', caller.id)
  if (error) {
    return json({ error: error.message }, 400)
  }

  return json({ ok: true, enabled })
})
