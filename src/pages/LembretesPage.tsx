import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { taskUrgency } from '../lib/domain'
import { dateLabel } from '../lib/format'
import { computeBirthdayReminders } from '../lib/birthdays'
import { isManagerRole } from '../lib/types'
import { resolveViewScope } from '../lib/viewScope'

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
