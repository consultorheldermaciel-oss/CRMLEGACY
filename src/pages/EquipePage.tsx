import { useState, type FormEvent } from 'react'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { initials } from '../lib/format'
import { prCadastroProgress } from '../lib/kpi'
import type { DailyGoals, ExtraGoal } from '../lib/types'

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
  const { consultants, updateConsultant, removeConsultant, inviteConsultant } = useCrm()
  const { openTaskModal } = useUi()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ name: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const team = consultants.filter((c) => c.role === 'consultor')
  const editing = editingId ? team.find((c) => c.id === editingId) : null

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) return
    setInviteBusy(true)
    setInviteError(null)
    setInviteResult(null)
    const name = newName.trim()
    const { error, inviteLink } = await inviteConsultant({ name, email: newEmail.trim() })
    setInviteBusy(false)
    if (error) setInviteError(error)
    else {
      if (inviteLink) setInviteResult({ name, link: inviteLink })
      setNewName('')
      setNewEmail('')
    }
  }

  function whatsappUrl(name: string, link: string) {
    const text = `Oi ${name.split(' ')[0]}! Segue o link para você criar sua senha e acessar o Legacy CRM: ${link}`
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
      <div className="bg-card border border-border rounded-2xl p-4.5">
        <div className="font-heading font-bold text-[17px] mb-3.5">Consultores</div>
        <div className="flex flex-col gap-2 mb-4">
          {team.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 p-2.5 rounded-[10px]"
              style={{ background: editingId === c.id ? '#EAF0FA' : 'transparent' }}
            >
              <div
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: c.color }}
              >
                {initials(c.name)}
              </div>
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
          {team.length === 0 && <div className="text-[12.5px] text-text-faint">Nenhum consultor ainda.</div>}
        </div>
        <form onSubmit={handleInvite} className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do novo consultor"
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

      {editing && (
        <div className="bg-card border border-border rounded-2xl p-5.5">
          <div className="flex items-center justify-between mb-4.5">
            <div className="font-heading font-bold text-[17px]">Editar consultor — {editing.name}</div>
            <button type="button" onClick={() => setEditingId(null)} className="bg-transparent border-none text-xl text-text-faint">
              ×
            </button>
          </div>

          <div className="flex flex-col gap-4.5">
            <div>
              <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">FOTO</div>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ background: editing.color }}
              >
                {initials(editing.name)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CONTATO</div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  defaultValue={editing.phone ?? ''}
                  onBlur={(e) => updateConsultant(editing.id, { phone: e.target.value })}
                  placeholder="Telefone"
                  className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
                />
                <div className="text-[13px] text-text-muted flex items-center">{editing.email}</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">CONTRATO COM A METLIFE</div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  defaultValue={editing.contract_start}
                  onBlur={(e) => updateConsultant(editing.id, { contract_start: e.target.value })}
                  className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
                />
                <div className="text-[13px] text-text-muted flex items-center">
                  parceiro(a) desde {editing.contract_start}
                </div>
              </div>
            </div>
            {(() => {
              const pr = prCadastroProgress(editing.contract_start, new Date())
              return (
                <div>
                  <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">
                    PR CADASTRO — MÊS {pr.month} DE 17
                  </div>
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
              )
            })()}
            <div>
              <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">BÔNUS E COMISSIONAMENTO BASE</div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="text-xs text-text-muted flex flex-col gap-1">
                  % comissão
                  <input
                    type="number"
                    defaultValue={editing.commission_pct}
                    onBlur={(e) => updateConsultant(editing.id, { commission_pct: Number(e.target.value) || 0 })}
                    className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
                  />
                </label>
                <label className="text-xs text-text-muted flex flex-col gap-1">
                  Bônus por apólice (R$)
                  <input
                    type="number"
                    defaultValue={editing.bonus_per_policy}
                    onBlur={(e) => updateConsultant(editing.id, { bonus_per_policy: Number(e.target.value) || 0 })}
                    className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
                  />
                </label>
              </div>
            </div>
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
      )}
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
