import type { Appointment, DailyGoals, Profile } from './types'
import { fmtBRL } from './format'
import { ageAtFromBrDate, firstYearCommissionPct } from './metlifeContract'

export type Period = 'dia' | 'semana' | 'mes' | 'ano'

export function workdaysFor(period: Period): number {
  return period === 'dia' ? 1 : period === 'semana' ? 5 : period === 'mes' ? 22 : 250
}

export function filterByPeriod(list: Appointment[], period: Period, today: Date): Appointment[] {
  return list.filter((a) => {
    const [y, m, d] = a.date.split('-').map(Number)
    const apptDate = new Date(y, m - 1, d)
    if (period === 'dia') {
      return (
        apptDate.getFullYear() === today.getFullYear() &&
        apptDate.getMonth() === today.getMonth() &&
        apptDate.getDate() === today.getDate()
      )
    }
    if (period === 'semana') {
      const days = (apptDate.getTime() - today.getTime()) / 86400000
      return days <= 0 && days > -7
    }
    if (period === 'mes') {
      return apptDate.getFullYear() === today.getFullYear() && apptDate.getMonth() === today.getMonth()
    }
    return apptDate.getFullYear() === today.getFullYear()
  })
}

export interface KpiCard {
  key: string
  icon: string
  label: string
  value: string
  target: string
  hasTarget: boolean
  ratio: number
  dotColor: string
  barMaskPct: number // 0-100, portion still masked (gray) on the gamified bar
}

function semaphoreColor(ratio: number): string {
  return ratio >= 1 ? '#3FA66B' : ratio >= 0.7 ? '#E0A526' : '#D64545'
}

const attendanceStatuses = ['compareceu', 'faltou_sem_avisar', 'avisou_nao_ira']

function attendanceRate(apps: Appointment[]): number {
  const denom = apps.filter((a) => attendanceStatuses.includes(a.status)).length
  const num = apps.filter((a) => a.status === 'compareceu').length
  return denom ? Math.round((num / denom) * 100) : 0
}

export function computeKpis(
  appointments: Appointment[],
  consultants: Profile[],
  period: Period,
  today: Date,
): KpiCard[] {
  const wd = workdaysFor(period)
  const apps = filterByPeriod(appointments, period, today)
  const ids = consultants.map((c) => c.id)
  const goalsById = new Map(consultants.map((c) => [c.id, c.daily_goals]))

  const sumGoal = (key: keyof DailyGoals) =>
    ids.reduce((s, id) => s + (goalsById.get(id)?.[key] ?? 0), 0) * wd
  const avgGoal = (key: keyof DailyGoals) =>
    ids.length ? ids.reduce((s, id) => s + (goalsById.get(id)?.[key] ?? 0), 0) / ids.length : 0

  const abordagens = apps.filter((a) => a.type === 'abordagem')
  const fechamentos = apps.filter((a) => a.type === 'fechamento')
  const compAbordagem = attendanceRate(abordagens)
  const compFechamento = attendanceRate(fechamentos)
  const fechamentoCompareceu = fechamentos.filter((a) => a.status === 'compareceu')
  const assertividade = fechamentoCompareceu.length
    ? Math.round(
        (fechamentoCompareceu.filter((a) => a.policy_closed).length / fechamentoCompareceu.length) * 100,
      )
    : 0
  const apolicesFechadas = apps.filter((a) => a.policy_closed).length
  const apolicesEntregues = apps.filter((a) => a.policy_delivered).length
  const premiums = apps.filter((a) => a.policy_closed && a.premium).map((a) => a.premium as number)
  const premioMedio = premiums.length ? Math.round(premiums.reduce((a, b) => a + b, 0) / premiums.length) : 0
  const valorAnualizado = premiums.reduce((a, b) => a + b * 12, 0)

  const raw = [
    {
      key: 'abordagens',
      icon: '📞',
      label: 'Abordagens agendadas',
      value: String(abordagens.length),
      target: String(sumGoal('abordagens')),
      hasTarget: true,
      ratio: abordagens.length / (sumGoal('abordagens') || 1),
    },
    {
      key: 'compAbordagem',
      icon: '✅',
      label: 'Comparecimento (abordagem)',
      value: compAbordagem + '%',
      target: Math.round(avgGoal('comparecimentoAbordagem')) + '%',
      hasTarget: true,
      ratio: compAbordagem / (avgGoal('comparecimentoAbordagem') || 1),
    },
    {
      key: 'fechamentos',
      icon: '📁',
      label: 'Fechamentos agendados',
      value: String(fechamentos.length),
      target: String(sumGoal('fechamentos')),
      hasTarget: true,
      ratio: fechamentos.length / (sumGoal('fechamentos') || 1),
    },
    {
      key: 'compFechamento',
      icon: '✅',
      label: 'Comparecimento (fechamento)',
      value: compFechamento + '%',
      target: Math.round(avgGoal('comparecimentoFechamento')) + '%',
      hasTarget: true,
      ratio: compFechamento / (avgGoal('comparecimentoFechamento') || 1),
    },
    {
      key: 'assertividade',
      icon: '🎯',
      label: 'Assertividade (fechamento)',
      value: assertividade + '%',
      target: Math.round(avgGoal('assertividadeFechamento')) + '%',
      hasTarget: true,
      ratio: assertividade / (avgGoal('assertividadeFechamento') || 1),
    },
    {
      key: 'apolicesFechadas',
      icon: '📝',
      label: 'Apólices fechadas',
      value: String(apolicesFechadas),
      target: String(Math.round(sumGoal('apolicesFechadas'))),
      hasTarget: true,
      ratio: apolicesFechadas / (sumGoal('apolicesFechadas') || 1),
    },
    {
      key: 'apolicesEntregues',
      icon: '📦',
      label: 'Apólices entregues',
      value: String(apolicesEntregues),
      target: String(Math.round(sumGoal('apolicesEntregues'))),
      hasTarget: true,
      ratio: apolicesEntregues / (sumGoal('apolicesEntregues') || 1),
    },
    {
      key: 'premioMedio',
      icon: '💰',
      label: 'Prêmio médio',
      value: fmtBRL(premioMedio),
      target: fmtBRL(avgGoal('premioMedio')),
      hasTarget: true,
      ratio: premioMedio / (avgGoal('premioMedio') || 1),
    },
    {
      key: 'valorAnualizado',
      icon: '📈',
      label: 'Valor anualizado',
      value: fmtBRL(valorAnualizado),
      target: '',
      hasTarget: false,
      ratio: 1,
    },
  ]

  return raw.map((k) => ({
    ...k,
    dotColor: semaphoreColor(k.ratio),
    barMaskPct: 100 - Math.min(100, Math.max(0, k.ratio * 100)),
  }))
}

/** PR Cadastro: 17-month declining bonus curve, month 1 = full strength. */
export function prCadastroMonth(contractStart: string, today: Date): number {
  const start = new Date(contractStart)
  const months = today.getFullYear() * 12 + today.getMonth() - (start.getFullYear() * 12 + start.getMonth()) + 1
  return Math.min(17, Math.max(1, months))
}

export function prCadastroProgress(contractStart: string, today: Date) {
  const month = prCadastroMonth(contractStart, today)
  const decline = Math.max(0, 1 - (month - 1) / 17)
  return {
    month,
    policiesPct: Math.round(60 + decline * 20),
    premiumPct: Math.round(50 + decline * 25),
    bonusValue: Math.round(1800 * decline),
  }
}

/** Comissão de 1º ano per the MetLife contract: product + client age (at
 * closing) determine the %, applied to the premium of each closed policy. */
function metlifeFirstYearCommission(closed: Appointment[], today: Date) {
  let total = 0
  let unresolved = 0
  for (const a of closed) {
    const age = ageAtFromBrDate(a.anamnese?.nascimento as string | undefined, today)
    const pct = a.product && age !== null ? firstYearCommissionPct(a.product, age) : null
    if (pct === null) {
      unresolved++
      continue
    }
    total += ((a.premium || 0) * pct) / 100
  }
  return { total, unresolved }
}

export function remuneracaoProjetada(
  consultant: Profile,
  appointmentsThisMonth: Appointment[],
  today: Date,
) {
  const closed = appointmentsThisMonth.filter((a) => a.policy_closed)
  const pr = prCadastroProgress(consultant.contract_start, today)

  if (consultant.contract_template === 'metlife_2025') {
    const { total: commission, unresolved } = metlifeFirstYearCommission(closed, today)
    const total = Math.round(commission + pr.bonusValue)
    return {
      total,
      breakdown: [
        { label: 'Comissão de 1º ano', value: fmtBRL(Math.round(commission)) },
        { label: 'PR Cadastro', value: fmtBRL(pr.bonusValue) },
      ],
      pr,
      commissionNote:
        unresolved > 0
          ? `${unresolved} apólice${unresolved > 1 ? 's' : ''} sem idade do cliente ou produto reconhecido — não entraram no cálculo.`
          : undefined,
    }
  }

  const commission = closed.reduce((sum, a) => sum + ((a.premium || 0) * consultant.commission_pct) / 100, 0)
  const bonusPolicy = closed.length * consultant.bonus_per_policy
  const bonusMetas = consultant.extra_goals.reduce((sum, g) => sum + (g.pct >= 100 ? 120 : 0), 0) || 480
  const total = Math.round(commission + bonusPolicy + bonusMetas + pr.bonusValue)
  return {
    total,
    breakdown: [
      { label: 'Comissão', value: fmtBRL(Math.round(commission)) },
      { label: 'Bônus por apólice', value: fmtBRL(bonusPolicy) },
      { label: 'Bônus por metas', value: fmtBRL(bonusMetas) },
      { label: 'PR Cadastro', value: fmtBRL(pr.bonusValue) },
    ],
    pr,
    commissionNote: undefined as string | undefined,
  }
}
