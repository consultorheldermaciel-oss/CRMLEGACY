import type { Appointment, AppointmentStatus } from './types'
import { MONTHS } from './format'

export function apptColor(a: Pick<Appointment, 'type'>): string {
  if (a.type === 'abordagem') return '#0B2D5B'
  if (a.type === 'fechamento') return '#3FA66B'
  if (a.type === 'entrega') return '#1E7A8C'
  if (a.type === 'outros') return '#A05A2C'
  return '#6B4FA0'
}

export function apptTypeLabel(a: Pick<Appointment, 'type' | 'event_kind'>): string {
  if (a.type === 'abordagem') return 'Abordagem'
  if (a.type === 'fechamento') return 'Fechamento'
  if (a.type === 'entrega') return 'Entrega de apólice'
  if (a.type === 'outros') return 'Outros'
  return a.event_kind || 'Evento interno'
}

export function apptSpan(a: Pick<Appointment, 'time' | 'duration'>) {
  const start = parseInt(a.time)
  const dur = a.duration || 1
  return { start, end: start + dur }
}

export function statusLabel(s: AppointmentStatus): string {
  return (
    {
      agendado: 'Agendado',
      compareceu: 'Compareceu',
      faltou_sem_avisar: 'Faltou sem avisar',
      avisou_nao_ira: 'Avisou que não iria',
      remarcado: 'Remarcado',
    }[s] || s
  )
}

export function statusColors(s: AppointmentStatus): { bg: string; color: string } {
  return (
    {
      agendado: { bg: '#EAF0FA', color: '#0B2D5B' },
      compareceu: { bg: '#E4F5EA', color: '#1E7A46' },
      faltou_sem_avisar: { bg: '#FBE7E7', color: '#B23030' },
      avisou_nao_ira: { bg: '#FCEFD9', color: '#9C6B0A' },
      remarcado: { bg: '#EFEDE6', color: '#6B7280' },
    }[s] || { bg: '#EFEDE6', color: '#6B7280' }
  )
}

export interface TaskUrgency {
  label: string
  bg: string
  color: string
}

export function taskUrgency(deadlineStr: string, today: Date): TaskUrgency {
  const [y, m, d] = deadlineStr.split('-').map(Number)
  const deadline = new Date(y, m - 1, d)
  const days = (deadline.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
  if (days <= 0) return { label: '🔥 Pra ontem, hein?!', bg: '#FBE0E0', color: '#B23030' }
  if (days <= 2) return { label: '⏰ Corre que o tempo não para', bg: '#FCE3D2', color: '#B25A1A' }
  if (days <= 5) return { label: '😅 Melhor não deixar pra depois', bg: '#FCEFD9', color: '#9C6B0A' }
  return { label: '😌 De boa, mas não esquece', bg: '#E4F5EA', color: '#1E7A46' }
}

export function isOccupied(
  appointments: Appointment[],
  consultantId: string,
  date: string,
  hour: number,
  excludeId?: string,
): boolean {
  return appointments.some((a) => {
    if (excludeId && a.id === excludeId) return false
    if (a.consultant_id !== consultantId || a.date !== date) return false
    const { start, end } = apptSpan(a)
    return hour >= start && hour < end
  })
}

export function findApptCovering(
  appointments: Appointment[],
  consultantId: string,
  date: string,
  hour: number,
): Appointment | undefined {
  return appointments.find((a) => {
    if (a.consultant_id !== consultantId || a.date !== date) return false
    const { start, end } = apptSpan(a)
    return hour >= start && hour < end
  })
}

export function monthYearLabel(y: number, m: number): string {
  return `${MONTHS[m]} de ${y}`
}
