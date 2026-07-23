import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { prCadastroProgress } from '../lib/kpi'
import { toTitleCase } from '../lib/format'
import type { DailyGoals, Dependent, ExtraGoal, Profile, UserRole } from '../lib/types'
import { CONSULTANT_COLOR_SWATCHES } from '../lib/types'
import { Avatar } from '../components/ui/Avatar'

type InviteFn = (payload: {
  name: string
  email: string
  roleToGrant?: 'consultor' | 'lider' | 'diretor'
}) => Promise<{ error: string | null; inviteLink: string | null }>

const DAILY_GOAL_FIELDS: [keyof DailyGoals, string][] = [
  ['abordagens', 'Abordagens / dia'],
  ['fechamentos', 'Fechamentos / dia'],
  ['comparecimentoAbordagem', 'Comparecimento abordagem %'],
  ['comparecimentoFechamento', 'Comparecimento fechamento %'],
  ['assertividadeFechamento', 'Assertividade fechamento %'],
  ['apolicesFechadas', 'Apólices fechadas / dia'],
  ['apolicesEntregues', 'Apólices entregues / dia'],
  ['premioMedio', 'Prêmio médio alvo (R$)'],
]

export function EquipePage() {
  const { profile } = useAuth()
  const { consultants, dependents, removeConsultant, inviteConsultant, toggleHierarchy } = useCrm()
  const { openTaskModal } = useUi()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ name: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)

  if (!profile) return null
  const isDiretor = profile.role === 'diretor'
  const managedRole: UserRole = isDiretor ? 'lider' : 'consultor'
  const roleLabel = isDiretor ? 'líder de unidade' : 'consultor'
  const roleLabelPlural = isDiretor ? 'Líderes de unidade' : 'Consultores'

  const team = consultants.filter((c) => c.role === managedRole)
  const editing = editingId ? team.find((c) => c.id === editingId) : null

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) return
    setInviteBusy(true)
    setInviteError(null)
    setInviteResult(null)
    const name = toTitleCase(newName)
    const { error, inviteLink } = await inviteConsultant({ name, email: newEmail.trim(), roleToGrant: managedRole })
    setInviteBusy(false)
    if (error) setInviteError(error)
    else {
      if (inviteLink) setInviteResult({ name, link: inviteLink })
      setNewName('')
      setNewEmail('')
    }
  }

  function whatsappUrl(name: string, link: string) {
    const text = `Você foi convidado(a) para entrar na equipe Legacy, ${name.split(' ')[0]}! Toque no link para criar sua senha e acessar: ${link}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function monthsOfPartnership(contractStart: string) {
    const start = new Date(contractStart)
    const now = new Date()
    return Math.max(0, now.getFullYear() * 12 + now.getMonth() - (start.getFullYear() * 12 + start.getMonth()))
  }

  return (
    <div className="grid gap-5 items-start" style={{ gridTemplateColumns: editing ? '360px 1fr' : '1fr' }}>
      <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-2xl p-4.5">
        <div className="font-heading font-bold text-[17px] mb-3.5">{roleLabelPlural}</div>
        <div className="flex flex-col gap-2 mb-4">
          {team.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 p-2.5 rounded-[10px]"
              style={{ background: editingId === c.id ? '#EAF0FA' : 'transparent' }}
            >
              <Avatar profile={c} size={34} />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</div>
                <div className="text-[11px] text-text-faint">{monthsOfPartnership(c.contract_start)} meses de parceria</div>
              </div>
              <button
                type="button"
                onClick={() => openTaskModal(c.id)}
                className="bg-[#FDECC8] text-[#8A5A00] border-none rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold whitespace-nowrap"
              >
                👉 Cutucão
              </button>
              <button type="button" onClick={() => setEditingId(c.id)} className="bg-transparent border-none text-[15px] p-1">
                ✏️
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remover ${c.name} da equipe?`)) removeConsultant(c.id)
                }}
                className="bg-transparent border-none text-[15px] p-1"
              >
                🗑️
              </button>
            </div>
          ))}
          {team.length === 0 && (
            <div className="text-[12.5px] text-text-faint">Nenhum {roleLabel} ainda.</div>
          )}
        </div>
        <form onSubmit={handleInvite} className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Nome do novo ${roleLabel}`}
              className="flex-1 min-w-[140px] border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="E-mail para convite"
              className="flex-1 min-w-[140px] border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <button
              type="submit"
              disabled={inviteBusy}
              className="bg-navy text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
            >
              {inviteBusy ? 'Convidando…' : 'Convidar'}
            </button>
          </div>
          {inviteError && <div className="text-xs font-semibold text-[#B23030]">{inviteError}</div>}
        </form>

        {inviteResult && (
          <div className="mt-3 bg-[#EAF0FA] border border-[#C7D7EE] rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="text-[12.5px] font-semibold">
              Convite de {inviteResult.name} criado! Envie o link abaixo para ele(a) criar a senha e entrar:
            </div>
            <div className="bg-white border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[11.5px] text-text-muted break-all">
              {inviteResult.link}
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={whatsappUrl(inviteResult.name, inviteResult.link)}
                target="_blank"
                rel="noreferrer"
                className="bg-[#25D366] text-white rounded-lg px-3 py-2 text-[12.5px] font-semibold"
              >
                Enviar pelo WhatsApp
              </a>
              <button
                type="button"
                onClick={() => copyLink(inviteResult.link)}
                className="bg-navy text-white border-none rounded-lg px-3 py-2 text-[12.5px] font-semibold"
              >
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button
                type="button"
                onClick={() => setInviteResult(null)}
                className="bg-transparent border-none text-text-muted text-[12.5px] font-semibold"
              >
                Fechar
              </button>
            </div>
            <div className="text-[11px] text-text-faint">
              Esse link expira depois de um tempo — se o consultor demorar para usar, gere um novo convite.
            </div>
          </div>
        )}
      </div>

      {!isDiretor && (
        <DiretorLinkCard
          profile={profile}
          consultants={consultants}
          inviteConsultant={inviteConsultant}
          toggleHierarchy={toggleHierarchy}
        />
      )}
      </div>

      {editing && (
        <EditConsultantPanel
          key={editing.id}
          editing={editing}
          roleLabel={roleLabel}
          dependents={dependents.filter((d) => d.consultant_id === editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

function DiretorLinkCard({
  profile,
  consultants,
  inviteConsultant,
  toggleHierarchy,
}: {
  profile: Profile
  consultants: Profile[]
  inviteConsultant: InviteFn
  toggleHierarchy: (enabled: boolean) => Promise<{ error: string | null }>
}) {
  const myDiretor = profile.manager_id ? consultants.find((c) => c.id === profile.manager_id) : null
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [togglingBusy, setTogglingBusy] = useState(false)

  if (myDiretor) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4.5">
        <div className="font-heading font-bold text-[15px] mb-1">Líder de agência</div>
        <div className="text-[12.5px] text-text-muted">Sua unidade está vinculada a {myDiretor.name}.</div>
      </div>
    )
  }

  async function handleToggle() {
    setTogglingBusy(true)
    await toggleHierarchy(!profile.hierarchy_enabled)
    setTogglingBusy(false)
  }

  if (!profile.hierarchy_enabled) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4.5">
        <div className="font-heading font-bold text-[15px] mb-1">Líder de agência</div>
        <div className="text-[12.5px] text-text-muted mb-3">
          Só ative essa opção quando o líder de agência da sua operação estiver realmente pronto para entrar. Depois
          de ativar, você poderá convidá-lo aqui, uma única vez.
        </div>
        <button
          type="button"
          disabled={togglingBusy}
          onClick={handleToggle}
          className="bg-navy text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
        >
          {togglingBusy ? 'Ativando…' : 'Ativar líder de agência'}
        </button>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setBusy(true)
    setError(null)
    setResult(null)
    const finalName = toTitleCase(name)
    const { error, inviteLink } = await inviteConsultant({ name: finalName, email: email.trim(), roleToGrant: 'diretor' })
    setBusy(false)
    if (error) setError(error)
    else if (inviteLink) {
      setResult({ name: finalName, link: inviteLink })
      setName('')
      setEmail('')
    }
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-4.5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-heading font-bold text-[15px]">Líder de agência</div>
        <button
          type="button"
          disabled={togglingBusy}
          onClick={handleToggle}
          className="bg-transparent border-none text-[11.5px] text-text-faint font-semibold disabled:opacity-60"
        >
          Desativar
        </button>
      </div>
      <div className="text-[12.5px] text-text-muted mb-3">
        Se existe um líder de agência acima de você, acompanhando várias unidades, convide-o aqui — uma única vez.
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do líder de agência"
          className="flex-1 min-w-[140px] border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail para convite"
          className="flex-1 min-w-[140px] border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-navy text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
        >
          {busy ? 'Convidando…' : 'Convidar'}
        </button>
      </form>
      {error && <div className="text-xs font-semibold text-[#B23030] mt-1.5">{error}</div>}
      {result && (
        <div className="mt-3 bg-[#EAF0FA] border border-[#C7D7EE] rounded-xl p-3.5 flex flex-col gap-2.5">
          <div className="text-[12.5px] font-semibold">
            Convite de {result.name} criado! Envie o link abaixo para ele(a) criar a senha e entrar:
          </div>
          <div className="bg-white border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[11.5px] text-text-muted break-all">
            {result.link}
          </div>
          <button
            type="button"
            onClick={() => copyLink(result.link)}
            className="self-start bg-navy text-white border-none rounded-lg px-3 py-2 text-[12.5px] font-semibold"
          >
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      )}
    </div>
  )
}

function EditConsultantPanel({
  editing,
  roleLabel,
  dependents,
  onClose,
}: {
  editing: Profile
  roleLabel: string
  dependents: Dependent[]
  onClose: () => void
}) {
  const { updateConsultant, uploadAvatar } = useCrm()
  const [draft, setDraft] = useState({
    name: editing.name,
    birth_date: editing.birth_date ?? '',
    phone: editing.phone ?? '',
    spouse_name: editing.spouse_name ?? '',
    spouse_phone: editing.spouse_phone ?? '',
    spouse_birth_date: editing.spouse_birth_date ?? '',
    contract_start: editing.contract_start,
    commission_pct: editing.commission_pct,
    bonus_per_policy: editing.bonus_per_policy,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setSaved(false)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    await updateConsultant(editing.id, {
      name: toTitleCase(draft.name) || editing.name,
      birth_date: draft.birth_date || null,
      phone: draft.phone || null,
      spouse_name: draft.spouse_name ? toTitleCase(draft.spouse_name) : null,
      spouse_phone: draft.spouse_phone || null,
      spouse_birth_date: draft.spouse_birth_date || null,
      contract_start: draft.contract_start,
      commission_pct: Number(draft.commission_pct) || 0,
      bonus_per_policy: Number(draft.bonus_per_policy) || 0,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pr = prCadastroProgress(draft.contract_start, new Date())

  return (
    <div className="bg-card border border-border rounded-2xl p-5.5">
      <div className="flex items-center justify-between mb-4.5">
        <div className="font-heading font-bold text-[17px]">Editar {roleLabel} — {editing.name}</div>
        <button type="button" onClick={onClose} className="bg-transparent border-none text-xl text-text-faint">
          ×
        </button>
      </div>

      <div className="flex flex-col gap-4.5">
        <AvatarUploader profile={editing} onUpload={(file) => uploadAvatar(editing.id, file)} />
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">COR DE IDENTIFICAÇÃO</div>
          <div className="flex gap-2 flex-wrap">
            {CONSULTANT_COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateConsultant(editing.id, { color })}
                className="w-7 h-7 rounded-full"
                style={{
                  background: color,
                  boxShadow: editing.color === color ? '0 0 0 2px #fff, 0 0 0 4px #1A1D23' : undefined,
                }}
                aria-label={`Usar cor ${color}`}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">DADOS PESSOAIS</div>
          <label className="text-xs text-text-muted flex flex-col gap-1 mb-2.5">
            Nome
            <input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
          </label>
          <label className="text-xs text-text-muted flex flex-col gap-1 max-w-[200px]">
            Data de nascimento
            <input
              type="date"
              value={draft.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
          </label>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CONTATO</div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="Telefone"
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <div className="text-[13px] text-text-muted flex items-center">{editing.email}</div>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CÔNJUGE</div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={draft.spouse_name}
              onChange={(e) => set('spouse_name', e.target.value)}
              placeholder="Nome do cônjuge"
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <input
              value={draft.spouse_phone}
              onChange={(e) => set('spouse_phone', e.target.value)}
              placeholder="Telefone do cônjuge"
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <label className="text-xs text-text-muted flex flex-col gap-1 col-span-2 max-w-[200px]">
              Data de nascimento do cônjuge
              <input
                type="date"
                value={draft.spouse_birth_date}
                onChange={(e) => set('spouse_birth_date', e.target.value)}
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
          </div>
        </div>
        <DependentsEditor consultantId={editing.id} dependents={dependents} />
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CONTRATO COM A METLIFE</div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="date"
              value={draft.contract_start}
              onChange={(e) => set('contract_start', e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <div className="text-[13px] text-text-muted flex items-center">parceiro(a) desde {draft.contract_start}</div>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CONTRATO DE COMISSIONAMENTO</div>
          <select
            value={editing.contract_template ?? ''}
            onChange={(e) => updateConsultant(editing.id, { contract_template: e.target.value || null })}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px] w-full"
          >
            <option value="">Nenhum ainda (mostra "em breve" pra ele)</option>
            <option value="metlife_2025">MetLife — Programa de Relacionamento (maio/2025)</option>
          </select>
          <div className="text-[11px] text-text-faint mt-1.5">
            Define como a tela "Minha remuneração" calcula os valores dele.
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">PR CADASTRO — MÊS {pr.month} DE 17</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-text-muted mb-1">Apólices pagas acumuladas</div>
              <div className="bg-[#EFEDE6] rounded-md h-2 overflow-hidden">
                <div className="bg-green h-full" style={{ width: `${pr.policiesPct}%` }} />
              </div>
            </div>
            <div>
              <div className="text-[11px] text-text-muted mb-1">Prêmio pago no trimestre</div>
              <div className="bg-[#EFEDE6] rounded-md h-2 overflow-hidden">
                <div className="bg-navy h-full" style={{ width: `${pr.premiumPct}%` }} />
              </div>
            </div>
          </div>
          <div className="text-xs text-text-muted mt-1.5">
            Bônus PR do mês: <span className="font-mono font-semibold">R$ {pr.bonusValue.toLocaleString('pt-BR')}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">BÔNUS E COMISSIONAMENTO BASE</div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="text-xs text-text-muted flex flex-col gap-1">
              % comissão
              <input
                type="number"
                value={draft.commission_pct}
                onChange={(e) => set('commission_pct', Number(e.target.value))}
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="text-xs text-text-muted flex flex-col gap-1">
              Bônus por apólice (R$)
              <input
                type="number"
                value={draft.bonus_per_policy}
                onChange={(e) => set('bonus_per_policy', Number(e.target.value))}
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="bg-navy text-white border-none rounded-lg py-3 text-sm font-bold w-full disabled:opacity-60"
        >
          {saving ? 'Salvando…' : saved ? '✅ Alterações salvas!' : 'Salvar alterações'}
        </button>

        <ExtraGoalsEditor
          goals={editing.extra_goals}
          onChange={(goals) => updateConsultant(editing.id, { extra_goals: goals })}
        />
        <div>
          <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">METAS DE PRODUTIVIDADE (POR DIA)</div>
          <div className="grid grid-cols-2 gap-2.5">
            {DAILY_GOAL_FIELDS.map(([key, label]) => (
              <label key={key} className="text-[11.5px] text-text-muted flex flex-col gap-1">
                {label}
                <input
                  type="number"
                  step="0.1"
                  defaultValue={editing.daily_goals[key]}
                  onBlur={(e) =>
                    updateConsultant(editing.id, {
                      daily_goals: { ...editing.daily_goals, [key]: Number(e.target.value) || 0 },
                    })
                  }
                  className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ExtraGoalsEditor({ goals, onChange }: { goals: ExtraGoal[]; onChange: (goals: ExtraGoal[]) => void }) {
  const [name, setName] = useState('')

  return (
    <div>
      <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">METAS EXTRAS GAMIFICADAS</div>
      <div className="flex flex-col gap-2 mb-2.5">
        {goals.map((g, i) => (
          <div key={i} className="border border-border rounded-[9px] px-3 py-2.5">
            <div className="flex justify-between text-[12.5px] font-semibold mb-1.5">
              <span>
                {g.icon} {g.name}
              </span>
              <div className="flex items-center gap-2">
                <span>{g.pct}%</span>
                <button
                  type="button"
                  onClick={() => onChange(goals.filter((_, idx) => idx !== i))}
                  className="bg-transparent border-none text-text-faint"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="bg-[#EFEDE6] rounded-md h-[7px] overflow-hidden">
              <div className="h-full" style={{ background: g.barColor, width: `${g.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova meta (ex: 5 indicações no mês)"
          className="flex-1 border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[12.5px]"
        />
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return
            onChange([...goals, { icon: '🏆', name: name.trim(), pct: 0, barColor: '#D64545' }])
            setName('')
          }}
          className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}

function AvatarUploader({ profile, onUpload }: { profile: Profile; onUpload: (file: File) => Promise<{ error: string | null }> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    const { error } = await onUpload(file)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div>
      <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">FOTO</div>
      <div className="flex items-center gap-3">
        <Avatar profile={profile} size={56} />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? 'Enviando…' : 'Alterar foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
      {error && <div className="text-xs font-semibold text-[#B23030] mt-1.5">{error}</div>}
    </div>
  )
}

function DependentsEditor({ consultantId, dependents }: { consultantId: string; dependents: Dependent[] }) {
  const { createDependent, updateDependent, removeDependent } = useCrm()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')

  return (
    <div>
      <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">FILHOS</div>
      <div className="flex flex-col gap-2 mb-2.5">
        {dependents.map((d) => (
          <div key={d.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input
              defaultValue={d.name}
              onBlur={(e) => updateDependent(d.id, { name: toTitleCase(e.target.value) })}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <input
              type="date"
              defaultValue={d.birth_date ?? ''}
              onBlur={(e) => updateDependent(d.id, { birth_date: e.target.value || null })}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <button
              type="button"
              onClick={() => removeDependent(d.id)}
              className="bg-transparent border-none text-text-faint text-[15px] p-1"
            >
              🗑️
            </button>
          </div>
        ))}
        {dependents.length === 0 && <div className="text-[12px] text-text-faint">Nenhum filho cadastrado.</div>}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do filho(a)"
          className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return
            createDependent({ consultant_id: consultantId, name: toTitleCase(name), birth_date: birthDate || null })
            setName('')
            setBirthDate('')
          }}
          className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold"
        >
          +
        </button>
      </div>
    </div>
  )
}
