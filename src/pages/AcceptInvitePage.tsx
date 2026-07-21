import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, functionErrorMessage } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LogoMark } from '../components/ui/LogoMark'

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [invite, setInvite] = useState<{ name: string; email: string } | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase.functions
      .invoke('get-invite', { body: { token } })
      .then(async ({ data, error }) => {
        if (error) {
          setCheckError(await functionErrorMessage(error, 'Convite inválido.'))
        } else if (data?.error) {
          setCheckError(data.error as string)
        } else {
          setInvite({ name: data.name, email: data.email })
        }
      })
      .finally(() => setChecking(false))
  }, [token])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (password.length < 8) {
      setSubmitError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setSubmitError('As senhas não coincidem.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('accept-invite', {
      body: { token, password },
    })
    if (error) {
      setBusy(false)
      setSubmitError(await functionErrorMessage(error, 'Falha ao criar a conta.'))
      return
    }
    if (data?.error) {
      setBusy(false)
      setSubmitError(data.error as string)
      return
    }
    const { error: signInError } = await signIn(data.email, password)
    setBusy(false)
    if (signInError) {
      navigate('/login', { replace: true })
      return
    }
    navigate('/', { replace: true })
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

        {checking && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-text-muted">
            Verificando convite…
          </div>
        )}

        {!checking && checkError && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-sm text-text-muted">{checkError}</p>
            <p className="text-xs text-text-faint mt-2">
              Peça ao líder de unidade para gerar um novo convite pra você.
            </p>
          </div>
        )}

        {!checking && invite && (
          <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
            <h1 className="font-heading font-bold text-lg text-center mb-1">
              Você foi convidado(a) para a equipe Legacy!
            </h1>
            <p className="text-xs text-text-muted text-center -mt-2 mb-1">
              Olá, {invite.name.split(' ')[0]} — crie sua senha para acessar com o e-mail{' '}
              <span className="font-semibold">{invite.email}</span>.
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
            {submitError && <div className="text-xs font-semibold text-[#B23030]">{submitError}</div>}
            <button
              type="submit"
              disabled={busy}
              className="bg-navy text-white rounded-lg py-2.5 font-bold text-sm mt-2 disabled:opacity-60"
            >
              {busy ? 'Criando conta…' : 'Criar senha e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
