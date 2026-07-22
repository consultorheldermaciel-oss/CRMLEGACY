// Edge Function: invite-consultor
// Called by an authenticated 'lider' to register a pending invite for a consultor
// and return a short link (https://<app>/convite/<token>) they can share however
// they like (WhatsApp, email...). No Supabase auth user is created yet — that
// happens when the consultor opens the link and sets a password, via the
// accept-invite function.
// Deploy: supabase functions deploy invite-consultor
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
    .select('role, hierarchy_enabled')
    .eq('id', caller.id)
    .single()

  const { email, name, appOrigin, roleToGrant: roleToGrantRaw } = await req.json()
  if (!email || !name || !appOrigin) {
    return json({ error: 'Informe nome e e-mail.' }, 400)
  }
  const roleToGrant = roleToGrantRaw === 'lider' || roleToGrantRaw === 'diretor' ? roleToGrantRaw : 'consultor'

  let managerId: string | null = null
  if (roleToGrant === 'consultor') {
    if (callerProfile?.role !== 'lider') {
      return json({ error: 'Só o líder de unidade pode convidar consultores.' }, 403)
    }
    managerId = caller.id
  } else if (roleToGrant === 'lider') {
    if (callerProfile?.role !== 'diretor') {
      return json({ error: 'Só o líder de agência pode convidar líderes de unidade.' }, 403)
    }
    managerId = caller.id
  } else {
    // 'diretor' — bootstrap only: a lider may invite the very first líder de
    // agência, who then sits above them with no manager of their own.
    if (callerProfile?.role !== 'lider') {
      return json({ error: 'Só um líder de unidade pode convidar o líder de agência.' }, 403)
    }
    if (!callerProfile.hierarchy_enabled) {
      return json({ error: 'Ative a opção "líder de agência" antes de convidar.' }, 403)
    }
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'diretor')
    if ((count ?? 0) > 0) {
      return json({ error: 'Já existe um líder de agência cadastrado.' }, 400)
    }
    managerId = null
  }

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return json({ error: 'Já existe uma conta com esse e-mail.' }, 400)
  }

  const token = crypto.randomUUID().replace(/-/g, '')
  const { error: insertError } = await admin.from('invites').insert({
    token,
    email,
    name,
    created_by: caller.id,
    role_to_grant: roleToGrant,
    manager_id: managerId,
  })
  if (insertError) {
    return json({ error: insertError.message }, 400)
  }

  return json({ ok: true, inviteLink: `${appOrigin}/convite/${token}` })
})
