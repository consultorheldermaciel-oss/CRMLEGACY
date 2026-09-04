import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import { useUi } from '../../context/UiContext'
import type { Period } from '../../lib/kpi'
import { isManagerRole, type Appointment } from '../../lib/types'
import { resolveViewScope } from '../../lib/viewScope'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { YearView } from './YearView'
import { NewAppointmentModal } from '../modals/NewAppointmentModal'
import { ClientCardModal } from '../modals/ClientCardModal'
import { ConflictAlertModal } from '../modals/ConflictAlertModal'
import { ConsultantPickerModal } from '../modals/ConsultantPickerModal'
import { SlotChooserModal } from '../modals/SlotChooserModal'
import { BlockAgendaModal } from '../modals/BlockAgendaModal'

export interface NewApptSlot {
  consultantIds: string[]
  date: string
  time: string
}

const FILTER_DEFS: [Appointment['type'] | 'todos', string][] = [
  ['todos', 'Todos'],
  ['abordagem', 'Abordagem'],
  ['fechamento', 'Fechamento'],
  ['entrega', 'Entrega'],
  ['outros', 'Outros'],
]

export function AgendaPanel({
  period,
  prefillClientName,
  prefillNotes,
}: {
  period: Period
  prefillClientName?: string
  prefillNotes?: string
}) {
  const { profile } = useAuth()
  const { consultants, appointments } = useCrm()
  const { viewingId } = useUi()
  const [apptTypeFilter, setApptTypeFilter] = useState<Appointment['type'] | 'todos'>('todos')

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [newApptSlot, setNewApptSlot] = useState<NewApptSlot | null>(null)
  const [dragPrefillName, setDragPrefillName] = useState<string | null>(null)
  const [dragPrefillNotes, setDragPrefillNotes] = useState<string | null>(null)
  const [conflictAppt, setConflictAppt] = useState<Appointment | null>(null)
  const [pickerSlot, setPickerSlot] = useState<{ date: string; time?: string } | null>(null)
  const [slotChooserApptIds, setSlotChooserApptIds] = useState<string[] | null>(null)
  const [blockAgendaOpen, setBlockAgendaOpen] = useState(false)

  if (!profile) return null
  const { isGestorView, team, memberIds } = resolveViewScope(consultants, viewingId)
  // Month view labels cells by looking up consultant_id in this list — include the
  // caller so their own self-blocks ("Bloquear minha agenda") resolve to a name too.
  const monthConsultants = isManagerRole(profile.role) ? [profile, ...team] : team

  const byRole = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const scoped = apptTypeFilter === 'todos' ? byRole : byRole.filter((a) => a.type === apptTypeFilter)

  function openNewApptModal(consultantIds: string[], date: string, time: string) {
    setDragPrefillName(null)
    setDragPrefillNotes(null)
    setNewApptSlot({ consultantIds, date, time })
  }

  function handleScheduleLead(name: string, notes: string, date: string, time: string) {
    setDragPrefillName(name)
    setDragPrefillNotes(notes)
    setNewApptSlot({ consultantIds: [viewingId], date, time })
  }

  const selectedAppt = selectedApptId ? appointments.find((a) => a.id === selectedApptId) ?? null : null

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
        <div className="font-heading font-bold text-[17px]">Agenda</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {isManagerRole(profile.role) && (
            <button
              type="button"
              onClick={() => setBlockAgendaOpen(true)}
              className="bg-[#FBE7E7] text-[#B23030] border-none rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap"
            >
              🔒 Bloquear minha agenda
            </button>
          )}
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
      </div>

      {period === 'mes' && (
        <MonthView
          appointments={scoped}
          allAppointments={byRole}
          viewingId={viewingId}
          consultants={monthConsultants}
          isGestorView={isGestorView}
          onOpenAppt={setSelectedApptId}
          onDayClickGestor={(date) => setPickerSlot({ date })}
          onDayClickSelf={(date, time) => openNewApptModal([viewingId], date, time)}
          onOpenSlotChooser={setSlotChooserApptIds}
          onFullDay={setConflictAppt}
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
          onScheduleLead={!isGestorView ? handleScheduleLead : undefined}
          onEmptySlotClickGestor={isGestorView ? (date, time) => setPickerSlot({ date, time }) : undefined}
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
          onEmptySlotClick={(consultantId, date, time) => openNewApptModal([consultantId], date, time)}
          onConflict={setConflictAppt}
          onScheduleLead={!isGestorView ? handleScheduleLead : undefined}
          onOpenSlotChooser={setSlotChooserApptIds}
          onEmptySlotClickGestor={isGestorView ? (date, time) => setPickerSlot({ date, time }) : undefined}
        />
      )}
      {period === 'ano' && <YearView appointments={scoped} />}

      {blockAgendaOpen && <BlockAgendaModal onClose={() => setBlockAgendaOpen(false)} />}

      {newApptSlot && (
        <NewAppointmentModal
          slot={newApptSlot}
          isGestorAggregate={isGestorView}
          prefillClientName={dragPrefillName ?? prefillClientName}
          prefillNotes={dragPrefillNotes ?? prefillNotes}
          onClose={() => {
            setNewApptSlot(null)
            setDragPrefillName(null)
            setDragPrefillNotes(null)
          }}
        />
      )}

      {selectedAppt && <ClientCardModal appt={selectedAppt} onClose={() => setSelectedApptId(null)} />}

      {conflictAppt && <ConflictAlertModal appt={conflictAppt} onClose={() => setConflictAppt(null)} />}

      {pickerSlot && (
        <ConsultantPickerModal
          date={pickerSlot.date}
          time={pickerSlot.time}
          consultants={team}
          appointments={appointments}
          selfProfile={profile}
          onClose={() => setPickerSlot(null)}
          onConfirm={(ids, date, time) => {
            setPickerSlot(null)
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
    </div>
  )
}
