import { useMemo, useState, type ReactNode } from 'react'
import { WEEKDAYS, dstr } from '../../lib/format'
import {
  agendaSlots,
  apptColor,
  apptTypeLabel,
  findApptCovering,
  isOccupied,
  minutesToTime,
  monthYearLabel as fmtMonthYear,
} from '../../lib/domain'
import type { Appointment, Profile } from '../../lib/types'

function todayParts() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }
}

export function MonthView({
  appointments,
  allAppointments,
  viewingId,
  consultants,
  isGestorView,
  onOpenAppt,
  onDayClickGestor,
  onDayClickSelf,
  onOpenSlotChooser,
  onFullDay,
}: {
  appointments: Appointment[]
  allAppointments: Appointment[]
  viewingId: string
  consultants: Profile[]
  isGestorView: boolean
  onOpenAppt: (id: string) => void
  onDayClickGestor: (date: string) => void
  onDayClickSelf: (date: string, time: string) => void
  onOpenSlotChooser: (ids: string[]) => void
  onFullDay: (appt: Appointment) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const t = todayParts()
    return { y: t.y, m: t.m }
  })
  const today = todayParts()
  const consultantById = useMemo(() => new Map(consultants.map((c) => [c.id, c])), [consultants])

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const cells: ReactNode[] = []
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`pad-${i}`} className="bg-[#FBFAF7] min-h-[96px]" />)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dstr(cursor.y, cursor.m, d)
    const isToday = cursor.y === today.y && cursor.m === today.m && d === today.d
    const dayApps = appointments.filter((a) => a.date === ds)

    let items: { label: string; bg: string; onClick: () => void; ring?: boolean }[]
    if (isGestorView) {
      const byTime = new Map<string, Appointment[]>()
      dayApps.forEach((a) => {
        const arr = byTime.get(a.time) ?? []
        arr.push(a)
        byTime.set(a.time, arr)
      })
      items = [...byTime.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 3)
        .map(([time, apps]) => {
          const anyManager = apps.some((a) => a.wants_manager)
          if (apps.length === 1) {
            const a = apps[0]
            const cons = consultantById.get(a.consultant_id)
            return {
              label: `${time} ${cons?.name.split(' ')[0] ?? '—'} · ${a.type === 'abordagem' ? 'Abordagem' : apptTypeLabel(a)}`,
              bg: cons?.color ?? '#666',
              ring: anyManager,
              onClick: () => onOpenAppt(a.id),
            }
          }
          return {
            label: `${time} · ${apps.length} consultores`,
            bg: '#6B4FA0',
            ring: anyManager,
            onClick: () => onOpenSlotChooser(apps.map((a) => a.id)),
          }
        })
    } else {
      items = dayApps.slice(0, 3).map((a) => ({
        label: `${a.time} ${a.client_name}`,
        bg: apptColor(a),
        onClick: () => onOpenAppt(a.id),
      }))
    }

    const handleDayClick = () => {
      if (isGestorView) return onDayClickGestor(ds)
      let freeSlot: number | null = null
      for (const m of agendaSlots()) {
        if (!isOccupied(allAppointments, viewingId, ds, m)) {
          freeSlot = m
          break
        }
      }
      if (freeSlot === null) {
        const covering =
          findApptCovering(allAppointments, viewingId, ds, agendaSlots()[0]) ?? allAppointments.find((a) => a.date === ds)
        if (covering) onFullDay(covering)
        return
      }
      onDayClickSelf(ds, minutesToTime(freeSlot))
    }

    cells.push(
      <div
        key={ds}
        className="min-h-[96px] p-1.5 flex flex-col gap-1 min-w-0 overflow-hidden cursor-pointer"
        style={{ background: isToday ? '#EAF0FA' : '#fff' }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          handleDayClick()
        }}
      >
        <div className="flex justify-between items-center">
          <div className="text-[11px] font-bold" style={{ color: isToday ? '#0B2D5B' : '#1A1D23' }}>
            {d}
          </div>
          <button
            type="button"
            className="bg-transparent border-none text-text-faint text-xs font-bold px-0.5 leading-none"
            onClick={handleDayClick}
          >
            +
          </button>
        </div>
        {items.map((it, idx) => (
          <button
            key={idx}
            type="button"
            onClick={it.onClick}
            className="text-white border-none rounded px-1.5 py-0.5 text-[10px] text-left font-semibold overflow-hidden whitespace-nowrap text-ellipsis"
            style={{ background: it.bg, boxShadow: it.ring ? 'inset 0 0 0 2px #C9A227' : undefined }}
          >
            {it.label}
          </button>
        ))}
      </div>,
    )
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-2.5">
        <button type="button" onClick={() => shiftMonth(-1)} className="text-text-muted px-2 font-bold">
          ‹
        </button>
        <div className="text-center font-heading font-bold text-[15px] min-w-[160px]">
          {fmtMonthYear(cursor.y, cursor.m)}
        </div>
        <button type="button" onClick={() => shiftMonth(1)} className="text-text-muted px-2 font-bold">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-[10px] overflow-hidden w-full box-border">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-[#FAFAF8] py-2 text-center text-[11px] font-bold text-text-muted">
            {wd}
          </div>
        ))}
        {cells}
      </div>
    </div>
  )
}
