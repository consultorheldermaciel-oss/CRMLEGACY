export type UserRole = 'diretor' | 'lider' | 'consultor'
export function isManagerRole(role: UserRole): boolean {
  return role === 'lider' || role === 'diretor'
}
export type AppointmentType = 'abordagem' | 'fechamento' | 'entrega' | 'outros' | 'evento'
export type AppointmentStatus =
  | 'agendado'
  | 'compareceu'
  | 'faltou_sem_avisar'
  | 'avisou_nao_ira'
  | 'remarcado'

export interface DailyGoals {
  abordagens: number
  fechamentos: number
  comparecimentoAbordagem: number
  comparecimentoFechamento: number
  assertividadeFechamento: number
  apolicesFechadas: number
  apolicesEntregues: number
  premioMedio: number
}

export interface ExtraGoal {
  icon: string
  name: string
  pct: number
  barColor: string
}

export interface FollowupGoals {
  naoProtocolado: number
  delay: number
  entrega: number
  recalibrar: number
}

export interface Profile {
  id: string
  role: UserRole
  manager_id: string | null
  hierarchy_enabled: boolean
  name: string
  color: string
  phone: string | null
  email: string | null
  avatar_url: string | null
  birth_date: string | null
  spouse_name: string | null
  spouse_birth_date: string | null
  spouse_phone: string | null
  contract_start: string
  commission_pct: number
  bonus_per_policy: number
  contract_template: string | null
  daily_goals: DailyGoals
  extra_goals: ExtraGoal[]
  followup_goals: FollowupGoals
  notify_lead_minutes: number
  notify_whatsapp: boolean
  created_at: string
}

export interface Dependent {
  id: string
  consultant_id: string
  name: string
  birth_date: string | null
  created_at: string
}

export interface Client {
  id: string
  consultant_id: string
  name: string
  phone: string | null
  birth_date: string | null
  notes: string | null
  anamnese: Anamnese
  created_at: string
}

export type HotLeadSource = 'mercado' | 'recomendacao'

export interface HotLead {
  id: string
  consultant_id: string
  name: string
  phone: string | null
  source: HotLeadSource
  recommended_by: string | null
  notes: string | null
  created_at: string
}

export type PolicyStatus = 'ativa' | 'entregue' | 'cancelada'

export interface Policy {
  id: string
  client_id: string
  consultant_id: string
  product: string
  premium: number | null
  policy_number: string | null
  issued_date: string | null
  status: PolicyStatus
  document_path: string | null
  created_at: string
}

export type Anamnese = Record<string, string | string[] | undefined>

export interface Appointment {
  id: string
  consultant_id: string
  created_by: string
  client_name: string
  type: AppointmentType
  event_kind: string | null
  duration: number
  date: string // YYYY-MM-DD
  time: string // HH:00
  status: AppointmentStatus
  wants_manager: boolean
  locked_by_lider: boolean
  anamnese: Anamnese
  policy_closed: boolean | null
  premium: number | null
  product: string | null
  capital_segurado: number | null
  recommendations: number
  notes: string | null
  policy_delivered: boolean | null
  fechamento_agendado: boolean
  linked_appointment_id: string | null
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  consultant_id: string
  assigned_by: string
  text: string
  deadline: string
  done: boolean
  auto_kind: 'entrega' | 'recalibrar' | null
  auto_policy_id: string | null
  created_at: string
}

export interface Reminder {
  id: string
  icon: string
  title: string
  date: string
  created_by: string
  created_at: string
}

export const DEFAULT_DAILY_GOALS: DailyGoals = {
  abordagens: 2,
  fechamentos: 1,
  comparecimentoAbordagem: 80,
  comparecimentoFechamento: 85,
  assertividadeFechamento: 60,
  apolicesFechadas: 0.5,
  apolicesEntregues: 0.4,
  premioMedio: 250,
}

// Kept clearly distinct from the lider's own navy (#0B2D5B) so avatars never look alike.
export const CONSULTANT_COLORS = ['#2E7DD1', '#3FA66B', '#B5622A', '#6B4FA0', '#1E7A8C']

// Extra options offered in the color-swatch picker (Equipe > editar consultor).
export const CONSULTANT_COLOR_SWATCHES = [
  '#2E7DD1',
  '#3FA66B',
  '#1E7A8C',
  '#6B4FA0',
  '#B5622A',
  '#5C6BC0',
  '#0E8A6D',
  '#946200',
]
