import type { Profile } from '../../lib/types'
import { Modal } from '../ui/Modal'

export function SlotChoiceModal({
  slot,
  consultants,
  onClose,
  onScheduleClient,
  onAssignTask,
}: {
  slot: { consultantId: string; date: string; time: string }
  consultants: Profile[]
  onClose: () => void
  onScheduleClient: () => void
  onAssignTask: () => void
}) {
  const cons = consultants.find((c) => c.id === slot.consultantId)
  const label = `${cons?.name.split(' ')[0] ?? ''} · ${slot.date.split('-').reverse().join('/')} ${slot.time}`

  return (
    <Modal onClose={onClose} maxWidth={360} align="center">
      <div className="font-heading font-bold text-base mb-1">{label}</div>
      <div className="text-[12.5px] text-text-muted mb-4.5">O que você quer fazer nesse horário?</div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onScheduleClient} className="bg-navy text-white border-none rounded-lg py-3 text-[13.5px] font-bold">
          📅 Agendar cliente
        </button>
        <button type="button" onClick={onAssignTask} className="bg-[#FDECC8] text-[#8A5A00] border-none rounded-lg py-3 text-[13.5px] font-bold">
          👉 Atribuir tarefa (Cutucão)
        </button>
        <button type="button" onClick={onClose} className="bg-transparent text-text-muted border-none rounded-lg py-2.5 text-[13px] font-semibold">
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
