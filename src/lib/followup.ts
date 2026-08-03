import type { Appointment, FollowupGoals } from './types'

export function daysBetween(dateStr: string, today: Date): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((startOfToday.getTime() - date.getTime()) / 86400000)
}

export type VirtualClientBucket = 'carteira' | 'naoConcluido' | 'delay' | 'outros'

/** Classifies a client that only exists through their appointments (not yet
 * promoted to the real Carteira) into one of the líder's 3 buckets:
 *   - carteira: some appointment already closed a policy (legacy data safety
 *     net — normally closing auto-promotes to a real Client, but this covers
 *     appointments closed before that existed, or if it ever fails)
 *   - naoConcluido: most recent meeting happened (compareceu) but no policy
 *     closed yet — "abordagens realizadas que não concluiu venda"
 *   - delay: was a no-show (faltou / avisou que não iria) — "abordagens
 *     agendadas mas não realizadas"
 *   - outros: still upcoming / rescheduled — hasn't happened yet either way */
export function classifyVirtualClient(appts: Appointment[]): { bucket: VirtualClientBucket; last: Appointment } {
  const sorted = [...appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const last = sorted[sorted.length - 1]
  const closedAppt = sorted.find((a) => a.policy_closed === true)
  if (closedAppt) return { bucket: 'carteira', last: closedAppt }
  if (last.status === 'compareceu') return { bucket: 'naoConcluido', last }
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
  bucket: keyof FollowupGoals,
  lastDate: string,
  goals: FollowupGoals,
  today: Date,
): FollowupAlert {
  const days = daysBetween(lastDate, today)
  const limit = goals[bucket]
  return { overdue: days >= limit, days, limit }
}
