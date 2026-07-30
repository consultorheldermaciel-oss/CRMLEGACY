import { useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { dstr, MONTHS } from '../../lib/format'
import {
  AGENDA_END_HOUR,
  AGENDA_EXTENDED_END_HOUR,
  agendaSlots,
  apptColor,
  apptSpan,
  apptTypeLabel,
  minutesToTime,
  statusLabel,
  timeToMinutes,
} from '../../lib/domain'
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
  const { updateAppointment } = useCrm()
  const [cursor, setCursor] = useState(() => new Date())
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [extended, setExtended] = useState(false)
  const ds = dstr(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
  const columns = isGestorView ? consultants.map((c) => ({ id: c.id, name: c.name.split(' ')[0] })) : (() => {
    const c = consultants.find((x) => x.id === viewingId)
    return [{ id: viewingId, name: c?.name.split(' ')[0] ?? 'Eu' }]
  })()
  const slots = agendaSlots(extended ? AGENDA_EXTENDED_END_HOUR : AGENDA_END_HOUR)

  function shiftDay(delta: number) {
    setCursor((c) => {
      const d = new Date(c)
      d.setDate(d.getDate() + delta)
      return d
    })
  }

  function handleDrop(e: React.DragEvent, time: string) {
    e.preventDefault()
    setDragOverKey(null)
    const apptId = e.dataTransfer.getData('text/plain')
    if (apptId) updateAppointment(apptId, { date: ds, time })
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
          {slots.map((m) => {
            const onHour = m % 60 === 0
            return (
              <div key={m} className="contents">
                <div
                  className="bg-white p-1 text-right"
                  style={{ fontSize: onHour ? 10 : 9, color: onHour ? '#8A8F98' : '#C7CAD1' }}
                >
                  {minutesToTime(m)}
                </div>
                {columns.map((col) => {
                  const key = `${col.id}-${m}`
                  const startingHere = appointments.filter(
                    (a) =>
                      a.consultant_id === col.id &&
                      a.date === ds &&
                      timeToMinutes(a.time) === m &&
                      (apptTypeFilter === 'todos' || a.type === apptTypeFilter),
                  )
                  if (startingHere.length) {
                    return (
                      <div key={col.id} className="bg-white min-h-[40px] p-0.5 flex flex-col gap-0.5">
                        {startingHere.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}
                            onClick={() => onOpenAppt(a.id)}
                            className="text-white border-none rounded px-1.5 py-1 text-left flex flex-col gap-0.5 cursor-grab active:cursor-grabbing"
                            style={{ background: apptColor(a) }}
                          >
                            <span className="text-[10.5px] font-semibold">
                              {a.time} {a.client_name} · {apptTypeLabel(a)}
                              {a.duration > 1 ? ` (${a.duration}h)` : ''}
                            </span>
                            <span className="text-[9px] opacity-85">{statusLabel(a.status)}</span>
                          </button>
                        ))}
                      </div>
                    )
                  }
                  const covering = appointments.find(
                    (a) => a.consultant_id === col.id && a.date === ds && m > timeToMinutes(a.time) && m < apptSpan(a).end,
                  )
                  if (covering) {
                    return (
                      <div key={col.id} className="bg-white min-h-[40px] p-0.5">
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
                    <div
                      key={col.id}
                      className="bg-white min-h-[40px] p-0.5"
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverKey(key)
                      }}
                      onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                      onDrop={(e) => handleDrop(e, minutesToTime(m))}
                    >
                      <button
                        type="button"
                        onClick={() => onEmptySlotClick(col.id, ds, minutesToTime(m))}
                        className="border border-dashed rounded text-[10px] p-1 w-full h-full"
                        style={{
                          borderColor: dragOverKey === key ? '#0B2D5B' : '#C7CAD1',
                          background: dragOverKey === key ? '#EAF0FA' : 'transparent',
                          color: '#9AA0A8',
                        }}
                      >
                        {onHour ? '+ Novo agendamento' : '+'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setExtended((v) => !v)}
        className="bg-transparent border-none text-navy text-[12.5px] font-bold mt-2.5 p-0"
      >
        {extended ? `🔼 Voltar até ${AGENDA_END_HOUR}h` : `🔽 Estender agenda até ${AGENDA_EXTENDED_END_HOUR}h`}
      </button>
    </div>
  )
}
