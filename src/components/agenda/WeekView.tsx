import { useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { dstr, WEEKDAYS } from '../../lib/format'
import { AGENDA_END_HOUR, AGENDA_EXTENDED_END_HOUR, agendaSlots, apptColor, apptSpan, minutesToTime, timeToMinutes } from '../../lib/domain'
import type { Appointment, Profile } from '../../lib/types'

function mondayOf(d: Date) {
  const dt = new Date(d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return dt
}

export function WeekView({
  appointments,
  consultants,
  isGestorView,
  onOpenAppt,
  onSlotClick,
  onConflict,
  onOpenSlotChooser,
}: {
  appointments: Appointment[]
  consultants: Profile[]
  isGestorView: boolean
  onOpenAppt: (id: string) => void
  onSlotClick: (date: string, time: string) => void
  onConflict: (appt: Appointment) => void
  onOpenSlotChooser: (ids: string[]) => void
}) {
  const { updateAppointment } = useCrm()
  const [anchor, setAnchor] = useState(() => new Date())
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [extended, setExtended] = useState(false)
  const monday = mondayOf(anchor)
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dstr(dt.getFullYear(), dt.getMonth(), dt.getDate())
  })
  const headers = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()}`
  })
  const slots = agendaSlots(extended ? AGENDA_EXTENDED_END_HOUR : AGENDA_END_HOUR)
  const consultantById = new Map(consultants.map((c) => [c.id, c]))

  function shiftWeek(delta: number) {
    setAnchor((a) => {
      const d = new Date(a)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  function handleDrop(e: React.DragEvent, date: string, time: string) {
    e.preventDefault()
    setDragOverKey(null)
    const apptId = e.dataTransfer.getData('text/plain')
    if (apptId) updateAppointment(apptId, { date, time })
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-2.5">
        <button type="button" onClick={() => shiftWeek(-1)} className="text-text-muted px-2 font-bold">
          ‹
        </button>
        <div className="text-center font-heading font-bold text-sm">Semana de {headers[0]}</div>
        <button type="button" onClick={() => shiftWeek(1)} className="text-text-muted px-2 font-bold">
          ›
        </button>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-px bg-border border border-border rounded-[10px] overflow-hidden"
          style={{ gridTemplateColumns: '56px repeat(7,minmax(108px,1fr))', minWidth: 812 }}
        >
          <div className="bg-[#FAFAF8]" />
          {headers.map((h) => (
            <div key={h} className="bg-[#FAFAF8] py-2 text-center text-xs font-bold">
              {h}
            </div>
          ))}
          {slots.map((m) => {
            const onHour = m % 60 === 0
            const timeStr = minutesToTime(m)
            return (
              <div key={m} className="contents">
                <div
                  className="bg-white p-1 text-right"
                  style={{ fontSize: onHour ? 10 : 9, color: onHour ? '#8A8F98' : '#C7CAD1' }}
                >
                  {timeStr}
                </div>
                {days.map((ds) => {
                  const key = `${ds}-${m}`
                  const startingHere = appointments.filter((a) => a.date === ds && timeToMinutes(a.time) === m)
                  if (isGestorView) {
                    if (startingHere.length) {
                      const anyManager = startingHere.some((a) => a.wants_manager)
                      const single = startingHere.length === 1 ? startingHere[0] : null
                      const label = single
                        ? `${timeStr} ${consultantById.get(single.consultant_id)?.name.split(' ')[0]}`
                        : `${timeStr} · ${startingHere.length} consultores`
                      const bg = single ? consultantById.get(single.consultant_id)?.color ?? '#666' : '#6B4FA0'
                      return (
                        <div key={ds} className="bg-white min-h-[36px] p-0.5 flex flex-col gap-0.5">
                          <button
                            type="button"
                            draggable={!!single}
                            onDragStart={(e) => single && e.dataTransfer.setData('text/plain', single.id)}
                            className="text-white border-none rounded px-1.5 py-1 text-[10px] font-semibold text-left"
                            style={{
                              background: bg,
                              boxShadow: anyManager ? 'inset 0 0 0 2px #C9A227' : undefined,
                              cursor: single ? 'grab' : 'pointer',
                            }}
                            onClick={() => (single ? onOpenAppt(single.id) : onOpenSlotChooser(startingHere.map((a) => a.id)))}
                          >
                            {label}
                          </button>
                        </div>
                      )
                    }
                    const covering = appointments.find((a) => a.date === ds && m > timeToMinutes(a.time) && m < apptSpan(a).end)
                    if (covering) {
                      const cons = consultantById.get(covering.consultant_id)
                      return (
                        <div key={ds} className="bg-white min-h-[36px] p-0.5 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => (covering.locked_by_lider ? onConflict(covering) : undefined)}
                            className="rounded h-full min-h-4 flex items-center px-1.5 w-full"
                            style={{ background: cons?.color ?? '#666', opacity: 0.55, cursor: covering.locked_by_lider ? 'pointer' : 'default' }}
                          >
                            <span className="text-white text-[9.5px] font-semibold truncate">
                              {cons?.name.split(' ')[0]}
                            </span>
                          </button>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={ds}
                        className="bg-white min-h-[36px]"
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverKey(key)
                        }}
                        onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                        onDrop={(e) => handleDrop(e, ds, timeStr)}
                        style={{ background: dragOverKey === key ? '#EAF0FA' : undefined }}
                      />
                    )
                  }

                  if (startingHere.length) {
                    return (
                      <div key={ds} className="bg-white min-h-[36px] p-0.5 flex flex-col gap-0.5">
                        {startingHere.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}
                            onClick={() => onOpenAppt(a.id)}
                            className="text-white border-none rounded px-1.5 py-1 text-[10px] font-semibold text-left cursor-grab active:cursor-grabbing"
                            style={{ background: apptColor(a) }}
                          >
                            {a.time} {a.client_name}
                            {a.duration > 1 ? ` (${a.duration}h)` : ''}
                          </button>
                        ))}
                      </div>
                    )
                  }
                  const covering = appointments.find((a) => a.date === ds && m > timeToMinutes(a.time) && m < apptSpan(a).end)
                  if (covering) {
                    return (
                      <div key={ds} className="bg-white min-h-[36px] p-0.5">
                        <button
                          type="button"
                          onClick={() => (covering.locked_by_lider ? onConflict(covering) : undefined)}
                          className="rounded h-full min-h-4 w-full flex items-center px-1.5"
                          style={{ background: apptColor(covering), opacity: 0.55, cursor: covering.locked_by_lider ? 'pointer' : 'default' }}
                        >
                          <span className="text-white text-[9.5px] font-semibold truncate">{covering.client_name}</span>
                        </button>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={ds}
                      className="bg-white min-h-[36px] p-0.5"
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverKey(key)
                      }}
                      onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                      onDrop={(e) => handleDrop(e, ds, timeStr)}
                    >
                      <button
                        type="button"
                        onClick={() => onSlotClick(ds, timeStr)}
                        className="border border-dashed rounded text-[9px] p-1 w-full h-full"
                        style={{
                          borderColor: dragOverKey === key ? '#0B2D5B' : '#C7CAD1',
                          background: dragOverKey === key ? '#EAF0FA' : 'transparent',
                          color: '#9AA0A8',
                        }}
                      >
                        +
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
