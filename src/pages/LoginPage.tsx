import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { LogoMark } from '../components/ui/LogoMark'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-[10px] bg-[#1C2230] flex items-center justify-center relative shrink-0">
            <LogoMark size={24} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-xl tracking-wide text-[#0B2D5B]">LEGACY</div>
            <div className="text-[10px] text-text-muted tracking-[1.5px]">GESTÃO E DESENVOLVIMENTO</div>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-lg bg-[#FCEFD9] text-[#9C6B0A] text-xs font-semibold px-3 py-2.5">
            Backend não conectado — configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja README.md).
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
          <h1 className="font-heading font-bold text-lg text-center mb-1">Entrar</h1>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted text-xs font-semibold">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-navy"
              placeholder="voce@legacy.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text-muted text-xs font-semibold">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-navy"
              placeholder="••••••••"
            />
          </label>
          {error && <div className="text-xs font-semibold text-[#B23030]">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="bg-navy text-white rounded-lg py-2.5 font-bold text-sm mt-2 disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="text-[11px] text-text-faint text-center mt-1">
            Consultores recebem o acesso por convite do líder de unidade.
          </p>
        </form>
      </div>
    </div>
  )
}
