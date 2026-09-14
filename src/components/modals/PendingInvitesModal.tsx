import { useState } from 'react'
import { useCrm } from '../../context/CrmContext'
import { useUi } from '../../context/UiContext'
import { resolveViewScope } from '../../lib/viewScope'
import { apptTypeLabel } from '../../lib/domain'
import { dateLabel } from '../../lib/format'
import type { Appointment, AppointmentType } from '../../lib/types'
import { Modal, ModalHeader } from '../ui/Modal'
import { ClientCardModal } from './ClientCardModal'

type SortMode = 'proximo' | 'convidou_primeiro'

const TYPE_FILTERS: [AppointmentType | 'todos', string][] = [
  ['todos', 'Todos'],
  ['abordagem', 'Abordagem'],
  ['fechamento', 'Fechamento'],
  ['entrega', 'Entrega'],
  ['outros', 'Outros'],
  ['evento', 'Evento'],
]

/** Full browsing view of every "⭐ Chamar o líder" invite still waiting on a
 * response — a dedicated, filterable list on top of the always-visible
 * PendingInvitesPanel, for when there are enough invites piled up that the
 * líder wants to sort/filter through them instead of just skimming. */
export function PendingInvitesModal({ onClose }: { onClose: () => void }) {
  const { consultants, appointments, updateAppointment } = useCrm()
  const { viewingId } = useUi()
  const [sortMode, setSortMode] = useState<SortMode>('proximo')
  const [typeFilter, setTypeFilter] = useState<AppointmentType | 'todos'>('todos')
  const [openApptId, setOpenApptId] = useState<string | null>(null)

  const { memberIds } = resolveViewScope(consultants, viewingId)
  const scopeAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const consultantById = new Map(consultants.map((c) => [c.id, c]))

  let invites = scopeAppointments.filter((a) => a.wants_manager && (a.manager_response === 'pending' || !a.manager_response))
  if (typeFilter !== 'todos') invites = invites.filter((a) => a.type === typeFilter)

  const sorted: Appointment[] = [...invites].sort((a, b) =>
    sortMode === 'proximo' ? (a.date + a.time).localeCompare(b.date + b.time) : a.created_at.localeCompare(b.created_at),
  )

  const openAppt = openApptId ? appointments.find((a) => a.id === openApptId) ?? null : null

  return (
    <Modal onClose={onClose} maxWidth={620}>
      <ModalHeader title={`⭐ Convites pendentes (${invites.length})`} onClose={onClose} />

      <div className="mb-3">
        <div className="text-[11px] font-bold text-text-muted tracking-wide mb-1.5">ORDENAR POR</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSortMode('proximo')}
            className="rounded-full px-3 py-1.5 text-xs font-semibold border"
            style={{
              borderColor: sortMode === 'proximo' ? '#0B2D5B' : '#D8D5CD',
              background: sortMode === 'proximo' ? '#0B2D5B' : '#fff',
              color: sortMode === 'proximo' ? '#fff' : '#1A1D23',
            }}
          >
            🕐 Evento mais próximo
          </button>
          <button
            type="button"
            onClick={() => setSortMode('convidou_primeiro')}
            className="rounded-full px-3 py-1.5 text-xs font-semibold border"
            style={{
              borderColor: sortMode === 'convidou_primeiro' ? '#0B2D5B' : '#D8D5CD',
              background: sortMode === 'convidou_primeiro' ? '#0B2D5B' : '#fff',
              color: sortMode === 'convidou_primeiro' ? '#fff' : '#1A1D23',
            }}
          >
            🙋 Quem convidou primeiro
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-bold text-text-muted tracking-wide mb-1.5">TIPO DE AGENDAMENTO</div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border"
              style={{
                borderColor: typeFilter === key ? '#0B2D5B' : '#D8D5CD',
                background: typeFilter === key ? '#0B2D5B' : '#fff',
                color: typeFilter === key ? '#fff' : '#1A1D23',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto">
        {sorted.map((a) => (
          <div key={a.id} className="bg-bg rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setOpenApptId(a.id)}
              className="bg-transparent border-none p-0 text-left flex-1 min-w-[180px]"
            >
              <div className="text-[13px] font-semibold">
                {consultantById.get(a.consultant_id)?.name.split(' ')[0] ?? 'Consultor'} · {a.client_name}
              </div>
              <div className="text-[11.5px] text-text-faint">
                {apptTypeLabel(a)} · {dateLabel(a.date)} às {a.time} · convidou em {dateLabel(a.created_at.slice(0, 10))}
              </div>
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateAppointment(a.id, { manager_response: 'accepted' })}
                className="bg-[#1E7A46] text-white border-none rounded-lg px-3 py-1.5 text-[12px] font-bold"
              >
                ✅ Aceitar
              </button>
              <button
                type="button"
                onClick={() => updateAppointment(a.id, { manager_response: 'declined' })}
                className="bg-[#B23030] text-white border-none rounded-lg px-3 py-1.5 text-[12px] font-bold"
              >
                ❌ Recusar
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <div className="text-[12.5px] text-text-faint py-4 text-center">Nenhum convite com esse filtro.</div>}
      </div>

      {openAppt && <ClientCardModal appt={openAppt} onClose={() => setOpenApptId(null)} />}
    </Modal>
  )
}
