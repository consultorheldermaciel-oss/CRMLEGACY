import { useState } from 'react'
import { dstr, MONTHS } from '../../lib/format'
import { apptColor, apptSpan, apptTypeLabel, statusLabel } from '../../lib/domain'
import type { Appointment, AppointmentType, Profile } from '../../lib/types'

export function DayView({
  appointments,
  consultants,
  isGestorView,
  viewingId,
  apptTypeFilter,
  onOpenAppt,
  onEmptySlotClick,
  onConflict,
}: {
  appointments: Appointment[]
  consultants: Profile[]
  isGestorView: boolean
  viewingId: string
  apptTypeFilter: AppointmentType | 'todos'
  onOpenAppt: (id: string) => void
  onEmptySlotClick: (consultantId: string, date: string, time: string) => void
  onConflict: (appt: Appointment) => void
}) {
  const [cursor, setCursor] = useState(() => new Date())
  const ds = dstr(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
  const columns = isGestorView ? consultants.map((c) => ({ id: c.id, name: c.name.split(' ')[0] })) : (() => {
    const c = consultants.find((x) => x.id === viewingId)
    return [{ id: viewingId, name: c?.name.split(' ')[0] ?? 'Eu' }]
  })()
  const hours: number[] = []
  for (let h = 8; h < 18; h++) hours.push(h)

  function shiftDay(delta: number) {
    setCursor((c) => {
      const d = new Date(c)
      d.setDate(d.getDate() + delta)
      return d
    })
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-2.5">
        <button type="button" onClick={() => shiftDay(-1)} className="text-text-muted px-2 font-bold">
          ‹
        </button>
        <div className="text-center font-heading font-bold text-sm">
          {cursor.getDate()} de {MONTHS[cursor.getMonth()]} de {cursor.getFullYear()}
        </div>
        <button type="button" onClick={() => shiftDay(1)} className="text-text-muted px-2 font-bold">
          ›
        </button>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-px bg-border border border-border rounded-[10px] overflow-hidden"
          style={{ gridTemplateColumns: `56px repeat(${columns.length},minmax(160px,1fr))`, minWidth: 600 }}
        >
          <div className="bg-[#FAFAF8]" />
          {columns.map((col) => (
            <div key={col.id} className="bg-[#FAFAF8] py-2 text-center text-xs font-bold">
              {col.name}
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} className="contents">
              <div className="bg-white text-[10px] text-text-faint p-1 text-right">
                {String(h).padStart(2, '0')}:00
              </div>
              {columns.map((col) => {
                const startingHere = appointments.filter(
                  (a) =>
                    a.consultant_id === col.id &&
                    a.date === ds &&
                    parseInt(a.time) === h &&
                    (apptTypeFilter === 'todos' || a.type === apptTypeFilter),
                )
                if (startingHere.length) {
                  return (
                    <div key={col.id} className="bg-white min-h-[56px] p-0.5 flex flex-col gap-0.5">
                      {startingHere.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onOpenAppt(a.id)}
                          className="text-white border-none rounded px-1.5 py-1 text-left flex flex-col gap-0.5"
                          style={{ background: apptColor(a) }}
                        >
                          <span className="text-[10.5px] font-semibold">
                            {a.client_name} · {apptTypeLabel(a)}
                            {a.duration > 1 ? ` (${a.duration}h)` : ''}
                          </span>
                          <span className="text-[9px] opacity-85">{statusLabel(a.status)}</span>
                        </button>
                      ))}
                    </div>
                  )
                }
                const covering = appointments.find(
                  (a) => a.consultant_id === col.id && a.date === ds && h > parseInt(a.time) && h < apptSpan(a).end,
                )
                if (covering) {
                  return (
                    <div key={col.id} className="bg-white min-h-[56px] p-0.5">
                      <button
                        type="button"
                        onClick={() => (covering.locked_by_lider ? onConflict(covering) : undefined)}
                        className="rounded h-full min-h-5 w-full flex items-center px-1.5"
                        style={{ background: apptColor(covering), opacity: 0.55, cursor: covering.locked_by_lider ? 'pointer' : 'default' }}
                      >
                        <span className="text-white text-[9.5px] font-semibold truncate">
                          {covering.client_name}
                        </span>
                      </button>
                    </div>
                  )
                }
                return (
                  <div key={col.id} className="bg-white min-h-[56px] p-0.5">
                    <button
                      type="button"
                      onClick={() => onEmptySlotClick(col.id, ds, `${String(h).padStart(2, '0')}:00`)}
                      className="border border-dashed border-[#C7CAD1] bg-transparent text-text-faint rounded text-[10px] p-1 w-full h-full"
                    >
                      + Novo agendamento
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
