import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { taskUrgency } from '../lib/domain'
import { dateLabel } from '../lib/format'
import { computeBirthdayReminders } from '../lib/birthdays'
import { isManagerRole } from '../lib/types'
import { resolveViewScope } from '../lib/viewScope'
import { getExistingPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from '../lib/push'

const LEAD_OPTIONS = [10, 15, 30, 60, 120]

function formatLead(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${hours}h`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function LembretesPage() {
  const { profile } = useAuth()
  const { consultants, dependents, clients, tasks, reminders, markTaskDone, createReminder } = useCrm()
  const { viewingId } = useUi()
  const [icon, setIcon] = useState('🎂')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  if (!profile) return null
  const isGestor = isManagerRole(profile.role)
  const { memberIds } = resolveViewScope(consultants, viewingId)
  const scopedTasks = memberIds ? tasks.filter((t) => memberIds.includes(t.consultant_id)) : tasks
  const today = todayStr()

  const scopedConsultants = memberIds ? consultants.filter((c) => memberIds.includes(c.id)) : consultants
  const scopedDependents = memberIds ? dependents.filter((d) => memberIds.includes(d.consultant_id)) : dependents
  const scopedClients = memberIds ? clients.filter((c) => memberIds.includes(c.consultant_id)) : clients
  const birthdayReminders = computeBirthdayReminders(scopedConsultants, scopedDependents, scopedClients, new Date())

  const importantDates = [
    ...reminders.map((r) => ({ id: r.id, icon: r.icon, title: r.title, date: r.date })),
    ...birthdayReminders,
  ].sort((a, b) => a.date.localeCompare(b.date))

  async function handleAddReminder(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    await createReminder({ icon, title: title.trim(), date })
    setTitle('')
    setDate('')
  }

  return (
    <div className="flex flex-col gap-5 max-w-[640px]">
      <NotificationsCard />

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="font-heading font-bold text-[17px] mb-1">👉 Alertas Cutucão</div>
        <div className="text-xs text-text-faint mb-3.5">
          Tarefas atribuídas pelo líder de unidade — a cor esquenta conforme o prazo se aproxima.
        </div>
        <div className="flex flex-col gap-2">
          {scopedTasks.map((t) => {
            const consultant = consultants.find((c) => c.id === t.consultant_id)
            const urg = t.done ? { label: '✅ Concluído', bg: '#E4F5EA', color: '#1E7A46' } : taskUrgency(t.deadline, new Date())
            return (
              <div
                key={t.id}
                className="border border-border rounded-[10px] px-3.5 py-3"
                style={{ background: t.done ? '#FAFAF8' : '#fff' }}
              >
                <div className="flex justify-between gap-2.5 items-start mb-1.5">
                  <div className="text-[13px] font-semibold flex-1">{t.text}</div>
                  {!t.done && (
                    <button
                      type="button"
                      onClick={() => markTaskDone(t.id)}
                      className="bg-navy text-white border-none rounded-md px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap"
                    >
                      Concluído
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: urg.bg, color: urg.color }}
                  >
                    {urg.label}
                  </span>
                  <span className="text-[11.5px] text-text-faint">
                    prazo: {dateLabel(t.deadline)} · para {consultant?.name.split(' ')[0]}
                  </span>
                  {t.auto_kind && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF0FA] text-[#0B2D5B]">
                      🤖 automático
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {scopedTasks.length === 0 && <div className="text-[12.5px] text-text-faint">Nenhum Cutucão por aqui — tudo tranquilo.</div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="font-heading font-bold text-[17px] mb-3.5">Datas importantes</div>
        <div className="flex flex-col gap-2 mb-4">
          {importantDates.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-3.5 py-2.5 border border-border rounded-[10px]"
              style={{ background: r.date === today ? '#FBEAEA' : '#fff' }}
            >
              <div className="text-lg">{r.icon}</div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{r.title}</div>
                <div className="text-[11.5px] text-text-faint">{dateLabel(r.date)}</div>
              </div>
              {r.date === today && (
                <span className="bg-red text-white text-[10px] font-bold px-2 py-1 rounded-full">HOJE</span>
              )}
            </div>
          ))}
          {importantDates.length === 0 && (
            <div className="text-[12.5px] text-text-faint">Nenhuma data cadastrada ainda.</div>
          )}
        </div>

        {isGestor && (
          <form onSubmit={handleAddReminder} className="flex gap-2 flex-wrap border-t border-border pt-4">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className="border border-[#D8D5CD] rounded-lg px-2 py-2 text-sm">
              <option value="🎂">🎂</option>
              <option value="📅">📅</option>
              <option value="💍">💍</option>
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descrição da data"
              className="flex-1 min-w-[160px] border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
            <button type="submit" className="bg-navy text-white border-none rounded-lg px-3.5 py-2 text-[13px] font-semibold">
              Adicionar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function NotificationsCard() {
  const { profile } = useAuth()
  const { updateMyNotifyLeadMinutes, savePushSubscription, removePushSubscription } = useCrm()
  const [supported] = useState(() => isPushSupported())
  const [checking, setChecking] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadMinutes, setLeadMinutes] = useState(profile?.notify_lead_minutes ?? 30)

  useEffect(() => {
    if (!supported) {
      setChecking(false)
      return
    }
    getExistingPushSubscription()
      .then((sub) => setSubscribed(!!sub))
      .finally(() => setChecking(false))
  }, [supported])

  useEffect(() => {
    setLeadMinutes(profile?.notify_lead_minutes ?? 30)
  }, [profile?.notify_lead_minutes])

  if (!profile) return null

  async function handleEnable() {
    setBusy(true)
    setError(null)
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
      if (!vapidKey) throw new Error('Notificações ainda não configuradas nesse ambiente.')
      const sub = await subscribeToPush(vapidKey)
      const { error } = await savePushSubscription(sub)
      if (error) throw new Error(error)
      setSubscribed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu pra ativar as notificações.')
    }
    setBusy(false)
  }

  async function handleDisable() {
    setBusy(true)
    setError(null)
    const endpoint = await unsubscribeFromPush()
    if (endpoint) await removePushSubscription(endpoint)
    setSubscribed(false)
    setBusy(false)
  }

  async function handleLeadChange(minutes: number) {
    setLeadMinutes(minutes)
    await updateMyNotifyLeadMinutes(minutes)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="font-heading font-bold text-[17px] mb-1">🔔 Notificações no celular</div>
      <div className="text-xs text-text-faint mb-3.5">
        Receba um alerta no celular antes de cada agendamento — como no Google Agenda.
      </div>

      {!supported && (
        <div className="bg-[#FCEFD9] text-[#9C6B0A] rounded-lg px-3 py-2.5 text-[12.5px] font-semibold">
          Esse navegador não suporta notificações. No iPhone: abra pelo Safari, toque em Compartilhar → "Adicionar à
          Tela de Início", e ative por esse ícone instalado.
        </div>
      )}

      {supported && checking && <div className="text-[12.5px] text-text-faint">Verificando…</div>}

      {supported && !checking && (
        <>
          {subscribed ? (
            <div className="flex items-center gap-2.5 flex-wrap mb-4">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#E4F5EA] text-[#1E7A46]">
                ✅ Ativadas nesse aparelho
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleDisable}
                className="bg-transparent border border-[#D8D5CD] rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
              >
                Desativar
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="bg-navy text-white border-none rounded-lg px-3.5 py-2.5 text-[13px] font-bold mb-4 disabled:opacity-60"
            >
              {busy ? 'Ativando…' : '🔔 Ativar notificações nesse aparelho'}
            </button>
          )}

          {error && <div className="text-[11.5px] font-semibold text-[#B23030] mb-3">{error}</div>}

          <div className="text-xs text-text-muted mb-1.5">Avisar com quanto tempo de antecedência:</div>
          <div className="flex gap-1.5 flex-wrap">
            {LEAD_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleLeadChange(m)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold border"
                style={{
                  borderColor: leadMinutes === m ? '#0B2D5B' : '#D8D5CD',
                  background: leadMinutes === m ? '#0B2D5B' : '#fff',
                  color: leadMinutes === m ? '#fff' : '#1A1D23',
                }}
              >
                {formatLead(m)}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-text-faint mt-2">
            É por aparelho — se usar o Legacy no celular e no computador, ative nos dois.
          </div>
        </>
      )}
    </div>
  )
}
