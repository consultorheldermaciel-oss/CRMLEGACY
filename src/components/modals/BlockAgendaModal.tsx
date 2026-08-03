import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from '../../lib/domain'
import { Modal, ModalHeader } from '../ui/Modal'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BlockAgendaModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const { createAppointment } = useCrm()
  const [date, setDate] = useState(todayStr())
  const [allDay, setAllDay] = useState(true)
  const [hour, setHour] = useState(AGENDA_START_HOUR)
  const [duration, setDuration] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  if (!profile) return null

  async function handleSave() {
    setSaving(true)
    setSaveError(false)
    const created = await createAppointment({
      consultant_id: profile!.id,
      client_name: note.trim() || 'Indisponível',
      type: 'evento',
      event_kind: 'Bloqueio de agenda',
      duration: allDay ? AGENDA_END_HOUR - AGENDA_START_HOUR : duration,
      date,
      time: allDay ? `${String(AGENDA_START_HOUR).padStart(2, '0')}:00` : `${String(hour).padStart(2, '0')}:00`,
      status: 'agendado',
      wants_manager: false,
      locked_by_lider: true,
      anamnese: {},
      policy_closed: null,
      premium: null,
      product: null,
      capital_segurado: null,
      recommendations: 0,
      notes: null,
      policy_delivered: null,
      fechamento_agendado: false,
      linked_appointment_id: null,
    })
    setSaving(false)
    if (created) onClose()
    else setSaveError(true)
  }

  return (
    <Modal onClose={onClose} align="center" maxWidth={420}>
      <ModalHeader title="Bloquear minha agenda" onClose={onClose} />
      <div className="text-[12.5px] text-text-muted mb-4">
        Marca um período como indisponível — os consultores continuam podendo agendar na própria agenda deles, mas
        deixam de conseguir pedir a sua presença nesse horário.
      </div>

      <label className="text-xs text-text-muted flex flex-col gap-1 mb-3">
        Data
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
        />
      </label>

      <div className="mb-4">
        <div className="text-xs text-text-muted mb-1.5">Período</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setAllDay(true)}
            className="flex-1 border rounded-lg py-2 text-[13px] font-bold"
            style={{
              borderColor: allDay ? '#0B2D5B' : '#D8D5CD',
              background: allDay ? '#0B2D5B' : '#fff',
              color: allDay ? '#fff' : '#1A1D23',
            }}
          >
            Dia todo
          </button>
          <button
            type="button"
            onClick={() => setAllDay(false)}
            className="flex-1 border rounded-lg py-2 text-[13px] font-bold"
            style={{
              borderColor: !allDay ? '#0B2D5B' : '#D8D5CD',
              background: !allDay ? '#0B2D5B' : '#fff',
              color: !allDay ? '#fff' : '#1A1D23',
            }}
          >
            Horário específico
          </button>
        </div>
        {!allDay && (
          <div className="flex items-center gap-2 mt-2.5">
            <label className="text-xs text-text-muted flex flex-col gap-1">
              Início
              <input
                type="number"
                min={AGENDA_START_HOUR}
                max={AGENDA_END_HOUR - 1}
                value={hour}
                onChange={(e) => setHour(Math.max(AGENDA_START_HOUR, Math.min(AGENDA_END_HOUR - 1, Number(e.target.value) || AGENDA_START_HOUR)))}
                className="border border-[#D8D5CD] rounded-lg px-2 py-1.5 text-[13px] w-16"
              />
            </label>
            <label className="text-xs text-text-muted flex flex-col gap-1">
              Duração (h)
              <input
                type="number"
                min={1}
                max={10}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="border border-[#D8D5CD] rounded-lg px-2 py-1.5 text-[13px] w-16"
              />
            </label>
          </div>
        )}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Motivo (opcional)"
        className="w-full border border-[#D8D5CD] rounded-lg px-3.5 py-2.5 text-sm mb-4"
      />

      {saveError && (
        <div className="bg-[#FBE7E7] text-[#B23030] rounded-lg px-3 py-2.5 text-[12.5px] font-semibold mb-3">
          ⚠️ Não deu pra bloquear a agenda. Tente de novo.
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="bg-navy text-white rounded-[10px] py-3 text-sm font-bold w-full disabled:opacity-60"
      >
        {saving ? 'Bloqueando…' : 'Bloquear agenda'}
      </button>
    </Modal>
  )
}
