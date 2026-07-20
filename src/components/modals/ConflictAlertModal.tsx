import type { Appointment } from '../../lib/types'
import { apptTypeLabel } from '../../lib/domain'
import { Modal } from '../ui/Modal'

export function ConflictAlertModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  return (
    <Modal onClose={onClose} maxWidth={360} align="center">
      <div className="font-heading font-bold text-base mb-2">⚠️ Conflito de agenda</div>
      <div className="text-[13px] text-[#374151] leading-relaxed mb-4.5">
        Você tem {apptTypeLabel(appt).toLowerCase()} agendado(a) pelo líder de unidade nesse horário. Esse horário
        não pode ser usado para outro compromisso.
      </div>
      <button type="button" onClick={onClose} className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold w-full">
        Entendi
      </button>
    </Modal>
  )
}
