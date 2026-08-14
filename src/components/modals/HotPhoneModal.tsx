import { useEffect, useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { mondayOf, weekRange } from '../../lib/report'
import type { Profile } from '../../lib/types'
import { Modal, ModalHeader } from '../ui/Modal'
import { Avatar } from '../ui/Avatar'

const GOAL = 25
const REFRESH_MS = 60_000

function fmtClock(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function HotPhoneModal({ team, onClose }: { team: Profile[]; onClose: () => void }) {
  const { appointments, refresh } = useCrm()
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      refresh()
      setLastUpdated(new Date())
    }, REFRESH_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nextMonday = new Date(mondayOf(new Date()))
  nextMonday.setDate(nextMonday.getDate() + 7)
  const { start, end, startDate, endDate } = weekRange(nextMonday)
  const periodLabel = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`

  const rows = team
    .map((c) => ({
      consultant: c,
      count: appointments.filter((a) => a.consultant_id === c.id && a.type !== 'evento' && a.date >= start && a.date <= end)
        .length,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <ModalHeader title="🔥 Hot Phone" onClose={onClose} />
      <div className="text-[12.5px] text-text-muted mb-1">
        Agendamentos pra semana de <span className="font-semibold">{periodLabel}</span> — meta de {GOAL} por consultor.
      </div>
      <div className="text-[11px] text-text-faint mb-4">
        Atualiza sozinho a cada minuto · última atualização às {fmtClock(lastUpdated)}
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map(({ consultant, count }) => {
          const pct = Math.min(100, Math.round((count / GOAL) * 100))
          const color = count >= GOAL ? '#1E7A46' : count >= GOAL / 2 ? '#9C6B0A' : '#B23030'
          return (
            <div key={consultant.id} className="flex items-center gap-3 border border-border rounded-2xl px-4 py-3">
              <Avatar profile={consultant} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="text-[13.5px] font-semibold truncate">{consultant.name}</div>
                  <div className="font-mono text-[13px] font-bold shrink-0" style={{ color }}>
                    {count}/{GOAL}
                  </div>
                </div>
                <div className="rounded-full h-2 bg-[#EFEDE6] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <div className="text-[12.5px] text-text-faint">Nenhum consultor nessa visão.</div>}
      </div>
    </Modal>
  )
}
