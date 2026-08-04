import type { Appointment } from './types'

export interface HotLeadStatus {
  label: string
  icon: string
  color: string
  bg: string
}

const NOT_SCHEDULED: HotLeadStatus = { label: 'Não agendado', icon: '🎯', color: '#6B7280', bg: '#EFEDE6' }

/** Gamified single-badge summary of a hot lead's progress, computed from
 * appointments matching this lead's name — same name-matching convention
 * already used to merge appointment-only clients into the Carteira, so a
 * lead's badge updates itself the moment the consultor schedules/advances
 * with them, with nothing to keep in sync by hand. */
export function hotLeadStatus(leadName: string, consultantId: string, appointments: Appointment[]): HotLeadStatus {
  const key = leadName.trim().toLowerCase()
  const matches = appointments.filter(
    (a) => a.consultant_id === consultantId && a.client_name.trim().toLowerCase() === key && a.type !== 'evento',
  )
  if (matches.length === 0) return NOT_SCHEDULED

  const sorted = [...matches].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const last = sorted[sorted.length - 1]

  if (matches.some((a) => a.policy_closed === true)) {
    return { label: 'Fechado! 🏆', icon: '🏆', color: '#1E7A46', bg: '#E4F5EA' }
  }
  if (last.type === 'fechamento') {
    if (last.status === 'compareceu') return { label: 'Fechamento feito, sem venda', icon: '⏳', color: '#9C6B0A', bg: '#FCEFD9' }
    return { label: 'Fechamento agendado', icon: '💼', color: '#1E7A8C', bg: '#E3F1F4' }
  }
  if (last.status === 'faltou_sem_avisar' || last.status === 'avisou_nao_ira') {
    return { label: 'Delay — não compareceu', icon: '🔁', color: '#B23030', bg: '#FBE7E7' }
  }
  if (last.status === 'compareceu') {
    return { label: 'Abordagem feita', icon: '🤝', color: '#0B2D5B', bg: '#EAF0FA' }
  }
  return { label: 'Agendado', icon: '📅', color: '#0B2D5B', bg: '#EAF0FA' }
}
