// Real product line + 1st-year commission table from the MetLife "Programa
// de Relacionamento" contract (Corretora de Seguros, versão maio/2025) the
// user uploaded. Commission % depends on product AND the client's age at
// the time the policy is closed.
//
// Deliberately NOT automated here (would need data this app doesn't track
// yet — see note at the bottom of this file):
//   - Comissão de renovação (2º ao 4º ano) and PR de Permanência: both need
//     monthly premium-payment history per policy across multiple years.
//   - PR de Evolução / PR de Desempenho: need 12-18 months of trailing
//     premium volume, persistence and productivity per consultor.
//   - Vida Total 5's special rule (only 50% of the "cobertura morte básica"
//     portion of the premium counts): needs the premium broken down by
//     coverage, which the app only stores as one lump sum today.
// Those are flagged to the user rather than guessed at.

export interface AgeBand {
  maxAge: number
  pct: number
}

export interface MetlifeProduct {
  label: string
  minAge: number
  bands: AgeBand[] // ascending maxAge; first band where age <= maxAge applies
}

export const METLIFE_PRODUCTS: MetlifeProduct[] = [
  { label: 'Vida Total 5', minAge: 18, bands: [{ maxAge: 75, pct: 15 }] },
  { label: 'Vida Total 10', minAge: 18, bands: [{ maxAge: 75, pct: 30 }] },
  { label: 'Vida Total 20', minAge: 18, bands: [{ maxAge: 75, pct: 40 }] },
  {
    label: 'Vida Total 65',
    minAge: 18,
    bands: [
      { maxAge: 35, pct: 50 },
      { maxAge: 40, pct: 45 },
      { maxAge: 45, pct: 40 },
      { maxAge: 55, pct: 30 },
    ],
  },
  {
    label: 'Vida Total 99',
    minAge: 18,
    bands: [
      { maxAge: 35, pct: 50 },
      { maxAge: 45, pct: 50 },
      { maxAge: 75, pct: 45 },
    ],
  },
  { label: 'Vida Total Legado 10', minAge: 18, bands: [{ maxAge: 70, pct: 30 }] },
  { label: 'Vida Total Legado 20', minAge: 18, bands: [{ maxAge: 60, pct: 35 }] },
  { label: 'Vida Total Singular', minAge: 18, bands: [{ maxAge: 75, pct: 4 }] },
  { label: 'Vida Total Singular Legado', minAge: 30, bands: [{ maxAge: 75, pct: 4 }] },
  { label: 'Vida Segura 5', minAge: 18, bands: [{ maxAge: 70, pct: 20 }] },
  {
    label: 'Vida Segura 10',
    minAge: 18,
    bands: [
      { maxAge: 35, pct: 25 },
      { maxAge: 40, pct: 30 },
      { maxAge: 45, pct: 40 },
      { maxAge: 65, pct: 45 },
    ],
  },
  {
    label: 'Vida Segura 15',
    minAge: 18,
    bands: [
      { maxAge: 35, pct: 30 },
      { maxAge: 40, pct: 40 },
      { maxAge: 60, pct: 45 },
    ],
  },
  { label: 'Vida Segura 20', minAge: 18, bands: [{ maxAge: 55, pct: 45 }] },
  { label: 'Vida Segura 25', minAge: 18, bands: [{ maxAge: 50, pct: 45 }] },
  { label: 'Vida Segura 75', minAge: 18, bands: [{ maxAge: 70, pct: 45 }] },
]

export const METLIFE_PRODUCT_LABELS = METLIFE_PRODUCTS.map((p) => p.label)

/** 1st-year commission %, or null if the product is unknown. Ages outside a
 * product's table clamp to the nearest band rather than failing — this tool
 * is for the lider's own estimate, not the insurer's official payout. */
export function firstYearCommissionPct(productLabel: string, age: number): number | null {
  const product = METLIFE_PRODUCTS.find((p) => p.label === productLabel)
  if (!product) return null
  const band = product.bands.find((b) => age <= b.maxAge)
  return (band ?? product.bands[product.bands.length - 1]).pct
}

/** Parses the anamnese's "nascimento" field (typed as dd/mm/aaaa text, not an ISO date). */
export function ageAtFromBrDate(birthDateBr: string | undefined, atDate: Date): number | null {
  const m = birthDateBr?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  let age = atDate.getFullYear() - year
  const hadBirthdayThisYear = atDate.getMonth() + 1 > month || (atDate.getMonth() + 1 === month && atDate.getDate() >= day)
  if (!hadBirthdayThisYear) age--
  return age >= 0 ? age : null
}
