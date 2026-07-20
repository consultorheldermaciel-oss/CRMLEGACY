export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function fmtBRL(n: number): string {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function dstr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

export function parseDstr(ds: string): { y: number; m: number; d: number } {
  const [y, m, d] = ds.split('-').map(Number)
  return { y, m: m - 1, d }
}

export function dateLabel(ds: string): string {
  const { m, d } = parseDstr(ds)
  return `${d} de ${MONTHS[m]}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function formatDateTyped(raw: string): string {
  const digits = String(raw).replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
}

export function formatCurrencyTyped(raw: string): string {
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return ''
  digits = digits.replace(/^0+(?=\d)/, '')
  while (digits.length < 3) digits = '0' + digits
  const cents = digits.slice(-2)
  const intPart = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return 'R$ ' + intPart + ',' + cents
}

export function parseCurrency(str: string): number {
  const digits = String(str).replace(/\D/g, '')
  return digits ? Number(digits) / 100 : 0
}
