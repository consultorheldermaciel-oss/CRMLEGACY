import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import type { NewApptSlot } from '../agenda/AgendaPanel'
import type { Anamnese, AppointmentType } from '../../lib/types'
import { Modal, ModalHeader } from '../ui/Modal'
import { Chip } from '../ui/Chip'
import { AnamneseForm } from './AnamneseForm'

const EVENT_KINDS = ['Reunião com o líder', 'Reunião com outro líder', 'Treinamento', 'Outro']
const WEEKDAYS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function toDstr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Every following occurrence of the same weekday as `startDate`, through Dec 31 of that year. */
function weeklyOccurrences(startDate: string): string[] {
  const [y, m, d] = startDate.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const dec31 = new Date(y, 11, 31)
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= dec31) {
    dates.push(toDstr(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

export function NewAppointmentModal({
  slot,
  isGestorAggregate,
  onClose,
}: {
  slot: NewApptSlot
  isGestorAggregate: boolean
  onClose: () => void
}) {
  const { profile } = useAuth()
  const { consultants, appointments, createAppointment } = useCrm()
  const [type, setType] = useState<AppointmentType>('abordagem')
  const [eventKind, setEventKind] = useState(EVENT_KINDS[0])
  const [eventOther, setEventOther] = useState('')
  const [duration, setDuration] = useState(1)
  const [allDay, setAllDay] = useState(false)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [inviteManager, setInviteManager] = useState(false)
  const [clientName, setClientName] = useState('')
  const [anamnese, setAnamnese] = useState<Anamnese>({})
  const [saving, setSaving] = useState(false)

  if (!profile) return null
  const isLiderCreator = profile.role === 'lider'
  const names = slot.consultantIds
    .map((id) => consultants.find((c) => c.id === id)?.name.split(' ')[0])
    .filter(Boolean)
    .join(', ')
  const slotLabel = `${names} · ${slot.date.split('-').reverse().join('/')} ${slot.time}`

  const lider = consultants.find((c) => c.role === 'lider')
  const conflict =
    inviteManager && lider
      ? appointments.find(
          (a) =>
            a.date === slot.date &&
            a.time === slot.time &&
            a.wants_manager &&
            !slot.consultantIds.includes(a.consultant_id) &&
            a.consultant_id === lider.id,
        )
      : undefined

  async function handleSave() {
    setSaving(true)
    const kind = type === 'evento' ? (eventKind === 'Outro' ? eventOther || 'Outro' : eventKind) : null
    const wantsManager = type === 'evento' && kind?.includes('líder') ? true : inviteManager
    const dates = repeatWeekly ? weeklyOccurrences(slot.date) : [slot.date]
    for (const consultantId of slot.consultantIds) {
      for (const date of dates) {
        await createAppointment({
          consultant_id: consultantId,
          client_name: clientName || (type === 'evento' ? kind || 'Evento' : 'Novo cliente'),
          type,
          event_kind: kind,
          duration: allDay ? 10 : duration,
          date,
          time: allDay ? '08:00' : slot.time,
          status: 'agendado',
          wants_manager: wantsManager,
          locked_by_lider: isLiderCreator,
          anamnese: type === 'abordagem' ? anamnese : {},
          policy_closed: null,
          premium: null,
          product: null,
          policy_delivered: null,
          fechamento_agendado: false,
          linked_appointment_id: null,
        })
      }
    }
    setSaving(false)
    onClose()
  }

  const weekdayName = WEEKDAYS_FULL[new Date(`${slot.date}T00:00:00`).getDay()]
  const occurrenceCount = repeatWeekly ? weeklyOccurrences(slot.date).length : 1

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`Novo agendamento — ${slotLabel}`} onClose={onClose} />

      <div className="flex gap-2 mb-3.5 flex-wrap">
        {(
          [
            ['abordagem', '🤝 Abordagem (1º encontro)', '#0B2D5B'],
            ['fechamento', '✅ Fechamento (2º encontro)', '#3FA66B'],
            ...(isLiderCreator ? [['evento', '👔 Outro evento', '#6B4FA0']] : []),
          ] as [AppointmentType, string, string][]
        ).map(([key, label, color]) => (
          <button
            key={key}
            type="button"
            onClick={() => setType(key)}
            className="flex-1 rounded-lg py-2.5 text-[13px] font-bold border"
            style={{
              borderColor: type === key ? color : '#D8D5CD',
              background: type === key ? color : '#fff',
              color: type === key ? '#fff' : '#1A1D23',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {type === 'evento' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3.5">
            {EVENT_KINDS.map((k) => (
              <Chip key={k} label={k} active={eventKind === k} activeColor="#6B4FA0" onClick={() => setEventKind(k)} />
            ))}
          </div>
          {eventKind === 'Outro' && (
            <input
              value={eventOther}
              onChange={(e) => setEventOther(e.target.value)}
              placeholder="Descreva o evento"
              className="w-full border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-[13px] mb-3.5"
            />
          )}
        </>
      )}

      <div className="mb-4">
        <div className="text-xs text-text-muted mb-1.5">Duração</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setDuration(n)
                setAllDay(false)
              }}
              className="flex-1 border rounded-lg py-2 text-[13px] font-bold"
              style={{
                borderColor: !allDay && duration === n ? '#0B2D5B' : '#D8D5CD',
                background: !allDay && duration === n ? '#0B2D5B' : '#fff',
                color: !allDay && duration === n ? '#fff' : '#1A1D23',
              }}
            >
              {n}h
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAllDay((v) => !v)}
            className="flex-1 border rounded-lg py-2 text-[13px] font-bold"
            style={{
              borderColor: allDay ? '#0B2D5B' : '#D8D5CD',
              background: allDay ? '#0B2D5B' : '#fff',
              color: allDay ? '#fff' : '#1A1D23',
            }}
          >
            Dia todo
          </button>
        </div>
        {allDay && (
          <div className="text-[11px] text-text-faint mt-1.5">Vai ocupar o dia inteiro (08:00 às 18:00).</div>
        )}
      </div>

      <div className="mb-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} />
          🔁 Repetir toda {weekdayName} até o fim do ano
        </label>
        {repeatWeekly && (
          <div className="text-[11px] text-text-faint mt-1">
            Vai criar {occurrenceCount} agendamentos, um por semana, até 31/12.
          </div>
        )}
      </div>

      {!isGestorAggregate && (
        <>
          <label className="flex items-center gap-2 text-[13px] mb-2">
            <input type="checkbox" checked={inviteManager} onChange={(e) => setInviteManager(e.target.checked)} />
            Convidar o líder de unidade para participar
          </label>
          {conflict && (
            <div className="bg-[#FBE7E7] text-[#B23030] rounded-lg px-3 py-2 text-[12.5px] font-semibold mb-4">
              ⚠️ O líder já está comprometido nesse horário e pode não conseguir participar.
            </div>
          )}
        </>
      )}

      <input
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder={type === 'evento' ? 'Observação (opcional)' : 'Nome do cliente'}
        className="w-full border border-[#D8D5CD] rounded-lg px-3.5 py-2.5 text-sm mb-4"
      />

      {type === 'abordagem' && <AnamneseForm draft={anamnese} onChange={setAnamnese} />}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="bg-navy text-white rounded-[10px] py-3 text-sm font-bold w-full mt-5 disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Salvar agendamento'}
      </button>
    </Modal>
  )
}
