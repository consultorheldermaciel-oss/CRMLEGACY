import { useState } from 'react'
import type { Appointment, Profile } from '../../lib/types'
import { dateLabel, initials } from '../../lib/format'
import { isOccupied } from '../../lib/domain'
import { Modal } from '../ui/Modal'

export function ConsultantPickerModal({
  date,
  consultants,
  appointments,
  onClose,
  onConfirm,
}: {
  date: string
  consultants: Profile[]
  appointments: Appointment[]
  onClose: () => void
  onConfirm: (ids: string[], date: string, time: string) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const allSelected = selected.length === consultants.length && consultants.length > 0

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function confirm() {
    if (!selected.length) return
    let freeHour = 9
    for (let h = 8; h < 18; h++) {
      if (selected.every((id) => !isOccupied(appointments, id, date, h))) {
        freeHour = h
        break
      }
    }
    onConfirm(selected, date, `${String(freeHour).padStart(2, '0')}:00`)
  }

  return (
    <Modal onClose={onClose} maxWidth={380} align="center">
      <div className="font-heading font-bold text-base mb-1">Para quem é esse agendamento?</div>
      <div className="text-[12.5px] text-text-muted mb-4">{dateLabel(date)}</div>
      <div className="flex flex-col gap-2 mb-4">
        <button
          type="button"
          onClick={() => setSelected(allSelected ? [] : consultants.map((c) => c.id))}
          className="border rounded-lg px-3 py-2.5 text-[13px] font-bold text-left"
          style={{
            borderColor: allSelected ? '#0B2D5B' : '#D8D5CD',
            background: allSelected ? '#0B2D5B' : '#fff',
            color: allSelected ? '#fff' : '#1A1D23',
          }}
        >
          👥 Todos os consultores
        </button>
        {consultants.map((c) => {
          const active = selected.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className="flex items-center gap-2.5 border rounded-lg px-3 py-2.5 text-[13px] font-semibold text-left"
              style={{ borderColor: active ? '#0B2D5B' : '#D8D5CD', background: active ? '#EAF0FA' : '#fff' }}
            >
              <span
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: c.color }}
              >
                {initials(c.name)}
              </span>
              <span>{c.name}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        disabled={!selected.length}
        onClick={confirm}
        className="bg-navy text-white border-none rounded-lg py-2.5 text-[13.5px] font-bold w-full disabled:opacity-50"
      >
        Continuar
      </button>
    </Modal>
  )
}
