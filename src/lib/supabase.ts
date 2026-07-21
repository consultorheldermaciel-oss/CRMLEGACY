import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Legacy CRM] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configurados. ' +
      'Copie .env.example para .env e conecte seu projeto Supabase (veja README.md).',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

/**
 * supabase.functions.invoke() collapses any non-2xx response into a generic
 * "Edge Function returned a non-2xx status code" — the real message our
 * function sent back as JSON is on error.context (the raw Response). This
 * digs it out so users/logs see the actual reason instead of the generic one.
 */
export async function functionErrorMessage(error: unknown, fallback = 'Falha inesperada.'): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json()
      if (body?.error) return body.error as string
    } catch {
      // response body wasn't JSON — fall through to the generic message below
    }
  }
  return (error as { message?: string })?.message ?? fallback
}
