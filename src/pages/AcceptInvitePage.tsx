import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AcceptInvitePage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refreshProfile()
    navigate('/', { replace: true })
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-text-muted">
            Este link de convite expirou ou já foi usado. Peça ao líder de unidade para reenviar o convite.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 flex flex-col gap-4"
      >
        <h1 className="font-heading font-bold text-lg text-center mb-1">Bem-vindo(a) à Legacy</h1>
        <p className="text-xs text-text-muted text-center -mt-2 mb-1">
          Crie sua senha para acessar sua conta de consultor.
        </p>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-muted text-xs font-semibold">Nova senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-muted text-xs font-semibold">Confirmar senha</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
        </label>
        {error && <div className="text-xs font-semibold text-[#B23030]">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="bg-navy text-white rounded-lg py-2.5 font-bold text-sm mt-2 disabled:opacity-60"
        >
          {busy ? 'Salvando…' : 'Criar senha e entrar'}
        </button>
      </form>
    </div>
  )
}
