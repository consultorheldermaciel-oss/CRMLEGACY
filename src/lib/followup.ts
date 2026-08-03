import type { Appointment, FollowupGoals } from './types'

export function daysBetween(dateStr: string, today: Date): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((startOfToday.getTime() - date.getTime()) / 86400000)
}

export type VirtualClientBucket = 'naoProtocolado' | 'delay' | 'outros'

/** Classifies a client that only exists through their appointments (not yet
 * promoted to the real Carteira) by their most recent appointment:
 *   - naoProtocolado: had a fechamento meeting, attended, but nothing closed yet
 *   - delay: was a no-show (faltou / avisou que não iria) for a scheduled meeting
 *   - outros: anything else (still upcoming, rescheduled, etc.) */
export function classifyVirtualClient(appts: Appointment[]): { bucket: VirtualClientBucket; last: Appointment } {
  const sorted = [...appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const last = sorted[sorted.length - 1]
  if (last.type === 'fechamento' && last.status === 'compareceu' && last.policy_closed === null) {
    return { bucket: 'naoProtocolado', last }
  }
  if (last.status === 'faltou_sem_avisar' || last.status === 'avisou_nao_ira') {
    return { bucket: 'delay', last }
  }
  return { bucket: 'outros', last }
}

export interface FollowupAlert {
  overdue: boolean
  days: number
  limit: number
}

export function followupAlert(
  bucket: 'naoProtocolado' | 'delay' | 'entrega' | 'recalibrar',
  lastDate: string,
  goals: FollowupGoals,
  today: Date,
): FollowupAlert {
  const days = daysBetween(lastDate, today)
  const limit = goals[bucket]
  return { overdue: days >= limit, days, limit }
}
