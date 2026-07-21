import { useState } from 'react'
import { dstr, WEEKDAYS } from '../../lib/format'
import { apptColor, apptSpan } from '../../lib/domain'
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
  const [anchor, setAnchor] = useState(() => new Date())
  const monday = mondayOf(anchor)
  const days = [0, 1, 2, 3, 4].map((i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return dstr(dt.getFullYear(), dt.getMonth(), dt.getDate())
  })
  const headers = [0, 1, 2, 3, 4].map((i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()}`
  })
  const hours: number[] = []
  for (let h = 8; h < 18; h++) hours.push(h)
  const consultantById = new Map(consultants.map((c) => [c.id, c]))

  function shiftWeek(delta: number) {
    setAnchor((a) => {
      const d = new Date(a)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
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
          style={{ gridTemplateColumns: '56px repeat(5,minmax(140px,1fr))', minWidth: 760 }}
        >
          <div className="bg-[#FAFAF8]" />
          {headers.map((h) => (
            <div key={h} className="bg-[#FAFAF8] py-2 text-center text-xs font-bold">
              {h}
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} className="contents">
              <div className="bg-white text-[10px] text-text-faint p-1 text-right">
                {String(h).padStart(2, '0')}:00
              </div>
              {days.map((ds) => {
                const startingHere = appointments.filter((a) => a.date === ds && parseInt(a.time) === h)
                if (isGestorView) {
                  if (startingHere.length) {
                    const anyManager = startingHere.some((a) => a.wants_manager)
                    const label =
                      startingHere.length === 1
                        ? `${h.toString().padStart(2, '0')}:00 ${consultantById.get(startingHere[0].consultant_id)?.name.split(' ')[0]}`
                        : `${h.toString().padStart(2, '0')}:00 · ${startingHere.length} consultores`
                    const bg =
                      startingHere.length === 1
                        ? consultantById.get(startingHere[0].consultant_id)?.color ?? '#666'
                        : '#6B4FA0'
                    return (
                      <div key={ds} className="bg-white min-h-[50px] p-0.5 flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="text-white border-none rounded px-1.5 py-1 text-[10px] font-semibold text-left"
                          style={{ background: bg, boxShadow: anyManager ? 'inset 0 0 0 2px #C9A227' : undefined }}
                          onClick={() =>
                            startingHere.length === 1
                              ? onOpenAppt(startingHere[0].id)
                              : onOpenSlotChooser(startingHere.map((a) => a.id))
                          }
                        >
                          {label}
                        </button>
                      </div>
                    )
                  }
                  const covering = appointments.find(
                    (a) => a.date === ds && h > parseInt(a.time) && h < apptSpan(a).end,
                  )
                  if (covering) {
                    const cons = consultantById.get(covering.consultant_id)
                    return (
                      <div key={ds} className="bg-white min-h-[50px] p-0.5 flex flex-col gap-0.5">
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
                  return <div key={ds} className="bg-white min-h-[50px]" />
                }

                if (startingHere.length) {
                  return (
                    <div key={ds} className="bg-white min-h-[50px] p-0.5 flex flex-col gap-0.5">
                      {startingHere.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onOpenAppt(a.id)}
                          className="text-white border-none rounded px-1.5 py-1 text-[10px] font-semibold text-left"
                          style={{ background: apptColor(a) }}
                        >
                          {a.time} {a.client_name}
                          {a.duration > 1 ? ` (${a.duration}h)` : ''}
                        </button>
                      ))}
                    </div>
                  )
                }
                const covering = appointments.find(
                  (a) => a.date === ds && h > parseInt(a.time) && h < apptSpan(a).end,
                )
                if (covering) {
                  return (
                    <div key={ds} className="bg-white min-h-[50px] p-0.5">
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
                  <div key={ds} className="bg-white min-h-[50px] p-0.5">
                    <button
                      type="button"
                      onClick={() => onSlotClick(ds, `${String(h).padStart(2, '0')}:00`)}
                      className="border border-dashed border-[#C7CAD1] bg-transparent text-text-faint rounded text-[9px] p-1 w-full h-full"
                    >
                      +
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
