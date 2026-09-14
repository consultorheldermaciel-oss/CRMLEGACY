import { useState } from 'react'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { resolveViewScope } from '../lib/viewScope'
import { apptTypeLabel } from '../lib/domain'
import { dateLabel } from '../lib/format'
import { ClientCardModal } from './modals/ClientCardModal'

/** In-app fallback for the "⭐ Chamar o líder" invite (migration 0027): shown
 * to a líder/diretor whenever a consultor is waiting on a response,
 * independent of whether the push notification actually arrived. Used on
 * both the Dashboard and Lembretes screens so it's hard to miss. */
export function PendingInvitesPanel() {
  const { consultants, appointments, updateAppointment } = useCrm()
  const { viewingId } = useUi()
  const [inviteApptId, setInviteApptId] = useState<string | null>(null)

  const { isGestorView, memberIds } = resolveViewScope(consultants, viewingId)
  const scopeAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const pendingInvites = isGestorView
    ? scopeAppointments.filter((a) => a.wants_manager && (a.manager_response === 'pending' || !a.manager_response))
    : []
  const consultantById = new Map(consultants.map((c) => [c.id, c]))
  const invitedAppt = inviteApptId ? appointments.find((a) => a.id === inviteApptId) ?? null : null

  if (pendingInvites.length === 0) return null

  return (
    <div className="bg-[#FCEFD9] border border-[#F0D9A6] rounded-2xl p-4.5 mb-6">
      <div className="font-heading font-bold text-[15px] mb-3 text-[#9C6B0A]">
        ⭐ Convites pendentes ({pendingInvites.length})
      </div>
      <div className="flex flex-col gap-2.5">
        {pendingInvites.map((a) => (
          <div key={a.id} className="bg-white rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setInviteApptId(a.id)}
              className="bg-transparent border-none p-0 text-left flex-1 min-w-[180px]"
            >
              <div className="text-[13px] font-semibold">
                {consultantById.get(a.consultant_id)?.name.split(' ')[0] ?? 'Consultor'} · {a.client_name}
              </div>
              <div className="text-[11.5px] text-text-faint">
                {apptTypeLabel(a)} · {dateLabel(a.date)} às {a.time}
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
      </div>

      {invitedAppt && <ClientCardModal appt={invitedAppt} onClose={() => setInviteApptId(null)} />}
    </div>
  )
}

/** Count for badges (header bell) — same scoping rules as the panel above. */
export function usePendingInviteCount(): number {
  const { consultants, appointments } = useCrm()
  const { viewingId } = useUi()
  const { isGestorView, memberIds } = resolveViewScope(consultants, viewingId)
  if (!isGestorView) return 0
  const scopeAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  return scopeAppointments.filter((a) => a.wants_manager && (a.manager_response === 'pending' || !a.manager_response)).length
}
