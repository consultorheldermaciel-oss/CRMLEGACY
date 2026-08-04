import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogoMark } from '../components/ui/LogoMark'

export default function ResetPasswordPage() {
  const { session, loading, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    setDone(true)
  }

  async function goToApp() {
    navigate('/', { replace: true })
  }

  async function goToLogin() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-[10px] bg-[#1C2230] flex items-center justify-center shrink-0">
            <LogoMark size={24} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-xl tracking-wide text-[#0B2D5B]">LEGACY</div>
            <div className="text-[10px] text-text-muted tracking-[1.5px]">GESTÃO E DESENVOLVIMENTO</div>
          </div>
        </div>

        {loading && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-text-muted">
            Verificando link…
          </div>
        )}

        {!loading && !session && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-text-muted">
              Esse link de redefinição de senha é inválido ou expirou.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="bg-navy text-white rounded-lg py-2.5 px-4 font-bold text-sm mt-4"
            >
              Voltar pro login
            </button>
          </div>
        )}

        {!loading && session && !done && (
          <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
            <h1 className="font-heading font-bold text-lg text-center mb-1">Criar nova senha</h1>
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
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        {!loading && session && done && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center flex flex-col gap-4">
            <p className="text-sm text-text-muted">✅ Senha alterada com sucesso.</p>
            <button type="button" onClick={goToApp} className="bg-navy text-white rounded-lg py-2.5 font-bold text-sm">
              Entrar no Legacy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
