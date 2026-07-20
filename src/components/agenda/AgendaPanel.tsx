import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import { useUi } from '../../context/UiContext'
import type { Period } from '../../lib/kpi'
import type { Appointment } from '../../lib/types'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { YearView } from './YearView'
import { NewAppointmentModal } from '../modals/NewAppointmentModal'
import { ClientCardModal } from '../modals/ClientCardModal'
import { ConflictAlertModal } from '../modals/ConflictAlertModal'
import { ConsultantPickerModal } from '../modals/ConsultantPickerModal'
import { SlotChooserModal } from '../modals/SlotChooserModal'
import { SlotChoiceModal } from '../modals/SlotChoiceModal'

export interface NewApptSlot {
  consultantIds: string[]
  date: string
  time: string
}

const FILTER_DEFS: [Appointment['type'] | 'todos', string][] = [
  ['todos', 'Todos'],
  ['abordagem', 'Abordagem'],
  ['fechamento', 'Fechamento'],
]

export function AgendaPanel({ period }: { period: Period }) {
  const { profile } = useAuth()
  const { consultants, appointments } = useCrm()
  const { viewingId, openTaskModal } = useUi()
  const [apptTypeFilter, setApptTypeFilter] = useState<Appointment['type'] | 'todos'>('todos')

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [newApptSlot, setNewApptSlot] = useState<NewApptSlot | null>(null)
  const [conflictAppt, setConflictAppt] = useState<Appointment | null>(null)
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [slotChooserApptIds, setSlotChooserApptIds] = useState<string[] | null>(null)
  const [slotChoiceSlot, setSlotChoiceSlot] = useState<{ consultantId: string; date: string; time: string } | null>(
    null,
  )

  if (!profile) return null
  const isGestorView = viewingId === 'gestor'
  const team = consultants.filter((c) => c.role === 'consultor')

  const byRole = isGestorView ? appointments : appointments.filter((a) => a.consultant_id === viewingId)
  const scoped = apptTypeFilter === 'todos' ? byRole : byRole.filter((a) => a.type === apptTypeFilter)

  function openNewApptModal(consultantIds: string[], date: string, time: string) {
    setNewApptSlot({ consultantIds, date, time })
  }

  function onEmptySlotClick(consultantId: string, date: string, time: string) {
    if (isGestorView) {
      setSlotChoiceSlot({ consultantId, date, time })
    } else {
      openNewApptModal([consultantId], date, time)
    }
  }

  const selectedAppt = selectedApptId ? appointments.find((a) => a.id === selectedApptId) ?? null : null

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
        <div className="font-heading font-bold text-[17px]">Agenda</div>
        <div className="flex gap-1.5 bg-bg p-1 rounded-lg">
          {FILTER_DEFS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setApptTypeFilter(key)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                background: apptTypeFilter === key ? '#0B2D5B' : 'transparent',
                color: apptTypeFilter === key ? '#fff' : '#1A1D23',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {period === 'mes' && (
        <MonthView
          appointments={scoped}
          consultants={team}
          isGestorView={isGestorView}
          onOpenAppt={setSelectedApptId}
          onDayClickGestor={(date) => setPickerDate(date)}
          onDayClickSelf={(date, time) => openNewApptModal([viewingId], date, time)}
          onOpenSlotChooser={setSlotChooserApptIds}
        />
      )}
      {period === 'semana' && (
        <WeekView
          appointments={scoped}
          consultants={team}
          isGestorView={isGestorView}
          onOpenAppt={setSelectedApptId}
          onSlotClick={(date, time) => openNewApptModal([viewingId], date, time)}
          onConflict={setConflictAppt}
          onOpenSlotChooser={setSlotChooserApptIds}
        />
      )}
      {period === 'dia' && (
        <DayView
          appointments={appointments}
          consultants={team}
          isGestorView={isGestorView}
          viewingId={viewingId}
          apptTypeFilter={apptTypeFilter}
          onOpenAppt={setSelectedApptId}
          onEmptySlotClick={onEmptySlotClick}
          onConflict={setConflictAppt}
        />
      )}
      {period === 'ano' && <YearView appointments={scoped} />}

      {newApptSlot && (
        <NewAppointmentModal
          slot={newApptSlot}
          isGestorAggregate={isGestorView}
          onClose={() => setNewApptSlot(null)}
        />
      )}

      {selectedAppt && <ClientCardModal appt={selectedAppt} onClose={() => setSelectedApptId(null)} />}

      {conflictAppt && <ConflictAlertModal appt={conflictAppt} onClose={() => setConflictAppt(null)} />}

      {pickerDate && (
        <ConsultantPickerModal
          date={pickerDate}
          consultants={team}
          appointments={appointments}
          onClose={() => setPickerDate(null)}
          onConfirm={(ids, date, time) => {
            setPickerDate(null)
            openNewApptModal(ids, date, time)
          }}
        />
      )}

      {slotChooserApptIds && (
        <SlotChooserModal
          apptIds={slotChooserApptIds}
          appointments={appointments}
          consultants={team}
          onClose={() => setSlotChooserApptIds(null)}
          onPick={(id) => {
            setSlotChooserApptIds(null)
            setSelectedApptId(id)
          }}
        />
      )}

      {slotChoiceSlot && (
        <SlotChoiceModal
          slot={slotChoiceSlot}
          consultants={team}
          onClose={() => setSlotChoiceSlot(null)}
          onScheduleClient={() => {
            const s = slotChoiceSlot
            setSlotChoiceSlot(null)
            openNewApptModal([s.consultantId], s.date, s.time)
          }}
          onAssignTask={() => {
            const s = slotChoiceSlot
            setSlotChoiceSlot(null)
            openTaskModal(s.consultantId, s.date)
          }}
        />
      )}
    </div>
  )
}
