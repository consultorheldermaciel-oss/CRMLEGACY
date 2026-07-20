import type { Appointment, Profile } from '../../lib/types'
import { apptTypeLabel } from '../../lib/domain'
import { Modal } from '../ui/Modal'

export function SlotChooserModal({
  apptIds,
  appointments,
  consultants,
  onClose,
  onPick,
}: {
  apptIds: string[]
  appointments: Appointment[]
  consultants: Profile[]
  onClose: () => void
  onPick: (id: string) => void
}) {
  const items = apptIds
    .map((id) => appointments.find((a) => a.id === id))
    .filter((a): a is Appointment => !!a)

  return (
    <Modal onClose={onClose} maxWidth={380} align="center">
      <div className="font-heading font-bold text-base mb-3.5">Vários agendamentos nesse horário</div>
      <div className="flex flex-col gap-2">
        {items.map((a) => {
          const cons = consultants.find((c) => c.id === a.consultant_id)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.id)}
              className="flex items-center gap-2.5 border-none rounded-[10px] px-3.5 py-2.5 text-white text-[13px] font-bold text-left"
              style={{ background: cons?.color ?? '#666', boxShadow: a.wants_manager ? 'inset 0 0 0 2px #C9A227' : undefined }}
            >
              <span className="flex-1">
                {cons?.name} · {apptTypeLabel(a)}
              </span>
              {a.wants_manager && <span>⭐</span>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
