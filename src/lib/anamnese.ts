import type { Anamnese } from './types'

export type AnamneseValue = string | string[]

export interface AnamneseTextItem {
  kind: 'text'
  key: string
  label: string
  format?: 'date' | 'currency'
}
export interface AnamneseChipItem {
  kind: 'chip'
  key: string
  label: string
  options: string[]
  multi: boolean
}
export type AnamneseItem = AnamneseTextItem | AnamneseChipItem

export interface AnamneseBlock {
  title: string
  sectionLabel: string | null
  items: AnamneseItem[]
}

const T = (key: string, label: string, format?: 'date' | 'currency'): AnamneseTextItem => ({
  kind: 'text',
  key,
  label,
  format,
})
const RADIO = (key: string, label: string, options: string[]): AnamneseChipItem => ({
  kind: 'chip',
  key,
  label,
  options,
  multi: false,
})
const MULTI = (key: string, label: string, options: string[]): AnamneseChipItem => ({
  kind: 'chip',
  key,
  label,
  options,
  multi: true,
})

export function has(draft: Anamnese, key: string, val: string): boolean {
  const v = draft[key]
  if (Array.isArray(v)) return v.includes(val)
  return v === val
}

const CANCER_TIPOS = [
  'Mama',
  'Próstata',
  'Pulmão',
  'Cólon / Intestino',
  'Estômago',
  'Pele (Melanoma)',
  'Leucemia / Linfoma',
  'Outro',
]
const CARDIO_TIPOS = ['Infarto', 'Angina', 'Insuficiência Cardíaca', 'AVC', 'Hipertensão Grave', 'Outro']
const NEURO_TIPOS = [
  'Alzheimer',
  'Parkinson',
  'Esclerose Múltipla',
  'Aneurisma Cerebral',
  'Epilepsia',
  'Outro',
]

const SECTION_DADOS_PESSOAIS = 'Dados Pessoais'
const SECTION_DADOS_PROFISSIONAIS = 'Dados Profissionais'
const SECTION_DPS = 'DPS — Declaração Pessoal de Saúde'
const SECTION_PATRIMONIAL = 'Patrimonial e Sucessão'

/** Builds the full conditional question tree, given the current draft answers. */
export function buildAnamneseBlocks(draft: Anamnese): AnamneseBlock[] {
  const blocks: AnamneseBlock[] = []
  const sec = (label: string) => {
    let used = false
    return () => (used ? null : ((used = true), label))
  }
  const secPessoal = sec(SECTION_DADOS_PESSOAIS)
  const secProfissional = sec(SECTION_DADOS_PROFISSIONAIS)
  const secDps = sec(SECTION_DPS)
  const secPatrimonial = sec(SECTION_PATRIMONIAL)

  const dadosItems: AnamneseItem[] = [T('nascimento', 'Data de nascimento (dd/mm/aaaa)', 'date')]
  dadosItems.push(RADIO('estadoCivil', 'Estado civil', ['Solteiro', 'Casado', 'União Estável', 'Divorciado', 'Viúvo']))
  if (has(draft, 'estadoCivil', 'Casado') || has(draft, 'estadoCivil', 'União Estável')) {
    dadosItems.push(
      T('conjugeNome', 'Nome do cônjuge / parceiro(a)'),
      T('conjugeNascimento', 'Data de nascimento do cônjuge (dd/mm/aaaa)', 'date'),
      T('conjugeAltura', 'Altura do cônjuge (cm)'),
      T('conjugePeso', 'Peso do cônjuge (kg)'),
      T('conjugeHistoricoGrave', 'Histórico de doença grave do cônjuge (se houver)'),
      RADIO('regimeCasamento', 'Regime de casamento', [
        'Comunhão Parcial de Bens',
        'Comunhão Universal de Bens',
        'Separação Total de Bens',
        'Participação Final nos Aquestos',
      ]),
    )
  }
  dadosItems.push(RADIO('possuiDependentes', 'Possui dependentes financeiros?', ['Sim', 'Não']))
  if (has(draft, 'possuiDependentes', 'Sim')) {
    dadosItems.push(T('quantosDependentes', 'Quantos dependentes?'))
  }
  dadosItems.push(
    RADIO('dependenteEspecial', 'Existe dependente com necessidade especial vitalícia?', ['Sim', 'Não']),
  )
  blocks.push({ title: 'Dados Pessoais', sectionLabel: secPessoal(), items: dadosItems })

  if (has(draft, 'possuiDependentes', 'Sim')) {
    const count = Math.min(10, Math.max(0, parseInt(String(draft.quantosDependentes ?? '0')) || 0))
    for (let i = 1; i <= count; i++) {
      blocks.push({
        title: `Dependente ${i}`,
        sectionLabel: secPessoal(),
        items: [
          T(`dep${i}Nome`, 'Nome do dependente'),
          T(`dep${i}Idade`, 'Idade'),
          T(`dep${i}Custo`, 'Custo mensal com educação / atividades extras (R$, caso haja)', 'currency'),
        ],
      })
    }
  }

  const profItems: AnamneseItem[] = [
    T('profissao', 'Profissão / Cargo'),
    T('renda', 'Renda mensal média (R$)', 'currency'),
    RADIO('regimeTrabalho', 'Regime de trabalho', [
      'CLT',
      'Autônomo / Profissional Liberal',
      'Empresário',
      'Concursado',
      'Outro',
    ]),
  ]
  if (has(draft, 'regimeTrabalho', 'Concursado')) {
    profItems.push(
      T('concursadoIngresso', 'Data de ingresso no concurso (dd/mm/aaaa)', 'date'),
      RADIO(
        'concursadoSabePrevidencia',
        'Sabe se, ao se aposentar por invalidez/doença, terá garantida 100% da renda atual pelo regime previdenciário?',
        ['Sim', 'Não'],
      ),
    )
    if (has(draft, 'concursadoSabePrevidencia', 'Sim')) {
      profItems.push(T('concursadoRendaEstimada', 'Qual seria a renda nesse caso (R$)?', 'currency'))
    }
  }
  profItems.push(
    RADIO('viagensConstantes', 'A rotina exige viagens constantes (carro/avião)?', ['Sim', 'Não']),
    RADIO('afastamento15dias', 'Se o cliente se afastar por 15 dias por doença, a renda cessa?', [
      'Sim, 100%',
      'Parcialmente',
      'Não, continua estável',
    ]),
  )
  blocks.push({ title: 'Ocupação e Renda', sectionLabel: secProfissional(), items: profItems })

  const saudeItems: AnamneseItem[] = [
    T('peso', 'Peso atual (kg)'),
    T('altura', 'Altura (cm)'),
    RADIO('checkupAnual', 'Realiza check-up médico anual?', ['Sim', 'Não', 'Apenas quando tem sintomas']),
    RADIO('doencaCronica', 'Possui diagnóstico de doença crônica?', ['Sim', 'Não']),
  ]
  if (has(draft, 'doencaCronica', 'Sim')) {
    saudeItems.push(
      MULTI('doencaCronicaTipos', 'Qual(is) doença(s) crônica(s) possui? (pode marcar mais de uma)', [
        'Câncer',
        'Diabetes',
        'Pressão Alta',
        'Doença Cardiológica',
        'Doença Neurológica',
        'Outro',
      ]),
    )
    if (has(draft, 'doencaCronicaTipos', 'Câncer')) {
      saudeItems.push(MULTI('doencaCronicaCancerTipos', 'Qual tipo de câncer?', CANCER_TIPOS))
      if (has(draft, 'doencaCronicaCancerTipos', 'Outro')) {
        saudeItems.push(T('doencaCronicaCancerOutro', 'Qual outro tipo de câncer?'))
      }
    }
    if (has(draft, 'doencaCronicaTipos', 'Doença Cardiológica')) {
      saudeItems.push(MULTI('doencaCronicaCardioTipos', 'Qual doença cardiológica?', CARDIO_TIPOS))
      if (has(draft, 'doencaCronicaCardioTipos', 'Outro')) {
        saudeItems.push(T('doencaCronicaCardioOutro', 'Qual outra doença cardiológica?'))
      }
    }
    if (has(draft, 'doencaCronicaTipos', 'Doença Neurológica')) {
      saudeItems.push(MULTI('doencaCronicaNeuroTipos', 'Qual doença neurológica?', NEURO_TIPOS))
      if (has(draft, 'doencaCronicaNeuroTipos', 'Outro')) {
        saudeItems.push(T('doencaCronicaNeuroOutro', 'Qual outra doença neurológica?'))
      }
    }
    if (has(draft, 'doencaCronicaTipos', 'Outro')) {
      saudeItems.push(T('doencaCronicaOutroQual', 'Qual outra doença?'))
    }
    saudeItems.push(
      T('doencaCronicaData', 'Data do diagnóstico', 'date'),
      RADIO('doencaCronicaMedicamentoso', 'O tratamento é medicamentoso?', ['Sim', 'Não']),
    )
    if (has(draft, 'doencaCronicaMedicamentoso', 'Sim')) {
      saudeItems.push(
        T('doencaCronicaMedicamento', 'Qual medicamento toma?'),
        T('doencaCronicaGramatura', 'Gramatura do medicamento'),
        T('doencaCronicaFrequencia', 'Com que frequência toma?'),
      )
    } else if (has(draft, 'doencaCronicaMedicamentoso', 'Não')) {
      saudeItems.push(T('doencaCronicaTratamento', 'Qual o tratamento realizado?'))
    }
  }
  saudeItems.push(
    RADIO('cirurgiaRecente', 'Passou por cirurgia, internação ou exames complexos nos últimos 5 anos?', [
      'Sim',
      'Não',
    ]),
  )
  if (has(draft, 'cirurgiaRecente', 'Sim')) {
    saudeItems.push(T('cirurgiaDescricao', 'Qual foi a cirurgia, internação ou exame complexo?'))
    saudeItems.push(RADIO('cirurgiaSequela', 'Há sequela ou necessidade de tratamento contínuo?', ['Sim', 'Não']))
    if (has(draft, 'cirurgiaSequela', 'Sim')) {
      saudeItems.push(T('cirurgiaSequelaDescricao', 'Descreva o tipo de sequela'))
    }
  }
  blocks.push({ title: 'Saúde e Biometria', sectionLabel: secDps(), items: saudeItems })

  const habitosItems: AnamneseItem[] = [
    RADIO('fumante', 'Fumante ou usuário de tabaco / derivados / vape?', ['Sim', 'Não']),
    RADIO('atividadeFisica', 'Pratica atividade física regular?', ['Sim', 'Não']),
    RADIO('esporteRadical', 'Pratica esportes radicais ou de risco?', ['Sim', 'Não']),
  ]
  if (has(draft, 'esporteRadical', 'Sim')) {
    habitosItems.push(T('esporteRadicalQual', 'Qual modalidade de risco?'))
    habitosItems.push(T('esporteRadicalFrequencia', 'Com que frequência pratica?'))
  }
  habitosItems.push(RADIO('andaDeMoto', 'Anda de moto?', ['Sim', 'Não']))
  if (has(draft, 'andaDeMoto', 'Sim')) {
    habitosItems.push(T('motoCilindrada', 'Qual a cilindrada da moto?'))
  }
  blocks.push({ title: 'Hábitos e Estilo de Vida', sectionLabel: secDps(), items: habitosItems })

  blocks.push({
    title: 'Histórico Familiar',
    sectionLabel: secDps(),
    items: [MULTI('histFamiliares', 'Quem tem histórico familiar de doença grave?', ['Pai', 'Mãe', 'Irmão(s)', 'Nenhum'])],
  })

  const familiares = (Array.isArray(draft.histFamiliares) ? draft.histFamiliares : []).filter(
    (f) => f !== 'Nenhum',
  )
  familiares.forEach((familiar) => {
    const slug = familiar.replace(/[^a-zA-Zà-úÀ-Ú]/g, '')
    const doencaKey = 'histDoenca_' + slug
    const items: AnamneseItem[] = [
      MULTI(doencaKey, `Qual doença teve o(a) ${familiar}? (pode marcar mais de uma)`, [
        'Câncer',
        'Diabetes',
        'Pressão Alta',
        'Doença Cardiológica',
        'Doença Neurológica',
        'Outro',
      ]),
    ]
    if (has(draft, doencaKey, 'Câncer')) {
      items.push(MULTI(doencaKey + '_cancerTipos', 'Qual tipo de câncer?', CANCER_TIPOS))
      if (has(draft, doencaKey + '_cancerTipos', 'Outro')) {
        items.push(T(doencaKey + '_cancerOutro', 'Qual outro tipo de câncer?'))
      }
    }
    if (has(draft, doencaKey, 'Doença Cardiológica')) {
      items.push(MULTI(doencaKey + '_cardioTipos', 'Qual doença cardiológica?', CARDIO_TIPOS))
      if (has(draft, doencaKey + '_cardioTipos', 'Outro')) {
        items.push(T(doencaKey + '_cardioOutro', 'Qual outra doença cardiológica?'))
      }
    }
    if (has(draft, doencaKey, 'Doença Neurológica')) {
      items.push(MULTI(doencaKey + '_neuroTipos', 'Qual doença neurológica?', NEURO_TIPOS))
      if (has(draft, doencaKey + '_neuroTipos', 'Outro')) {
        items.push(T(doencaKey + '_neuroOutro', 'Qual outra doença neurológica?'))
      }
    }
    if (has(draft, doencaKey, 'Outro')) {
      items.push(T(doencaKey + '_qual', 'Qual foi o diagnóstico?'))
      items.push(T(doencaKey + '_data', 'Data do diagnóstico', 'date'))
    }
    blocks.push({ title: 'Histórico — ' + familiar, sectionLabel: null, items })
  })

  const patrimonioItems: AnamneseItem[] = [
    T('custoManutencaoPadraoVida', 'Qual o custo mensal para manter o padrão de vida da família (R$)?', 'currency'),
    T('representatividadeCliente', 'Sua representatividade financeira no orçamento da família (%)'),
  ]
  if (has(draft, 'estadoCivil', 'Casado') || has(draft, 'estadoCivil', 'União Estável')) {
    patrimonioItems.push(
      RADIO('conjugeContribuiFinanceiramente', 'O cônjuge/parceiro(a) contribui financeiramente para dentro do lar?', [
        'Sim',
        'Não',
      ]),
    )
    if (has(draft, 'conjugeContribuiFinanceiramente', 'Sim')) {
      patrimonioItems.push(
        T('conjugeRepresentatividade', 'Representatividade financeira do cônjuge no orçamento da família (%)'),
        T('conjugeRenda', 'Renda mensal do cônjuge (R$)', 'currency'),
        RADIO('conjugeVinculoEmpregaticio', 'Vínculo empregatício do cônjuge', [
          'CLT',
          'Autônomo / Profissional Liberal',
          'Empresário',
          'Concursado',
          'Não trabalha atualmente',
          'Outro',
        ]),
      )
    }
  }
  patrimonioItems.push(
    RADIO('possuiPatrimonio', 'Possui patrimônio (imóveis, automóveis, aplicações)?', ['Sim', 'Não']),
  )
  if (has(draft, 'possuiPatrimonio', 'Sim')) {
    patrimonioItems.push(
      T('patrimonioImoveis', 'Imóveis — valor total estimado (R$)', 'currency'),
      T('patrimonioAutomoveis', 'Automóveis — valor total estimado (R$)', 'currency'),
      T('patrimonioAplicacoes', 'Aplicações financeiras — valor total estimado (R$)', 'currency'),
      T('patrimonioOutros', 'Outros bens (ex: ações, gado) — valor e descrição'),
    )
  }
  patrimonioItems.push(
    RADIO(
      'tempoProtecaoRenda',
      'Por quanto tempo ainda pretende/precisa trabalhar para manter o padrão de vida da família?',
      ['1 a 2 anos', '3 a 5 anos', 'Mais de 5 anos'],
    ),
  )
  patrimonioItems.push(RADIO('dividasLongoPrazo', 'Possui financiamentos ou dívidas de longo prazo em aberto?', ['Sim', 'Não']))
  if (has(draft, 'dividasLongoPrazo', 'Sim')) {
    patrimonioItems.push(T('dividasDescricao', 'Descreva as dívidas/financiamentos (imóvel, carro, empréstimo...)'))
    patrimonioItems.push(T('dividasValorMensal', 'Qual o valor mensal de parcelas dessas dívidas e financiamentos (R$)', 'currency'))
    patrimonioItems.push(
      RADIO('dividasSeguroPrestamista', 'Sabe se tem seguro prestamista nessas operações de crédito?', [
        'Sim',
        'Não',
        'Não sei',
      ]),
    )
  }
  patrimonioItems.push(RADIO('possuiEmpresa', 'Possui empresa / sociedade?', ['Sim', 'Não']))
  if (has(draft, 'possuiEmpresa', 'Sim')) {
    patrimonioItems.push(T('empresaValuation', 'Valor de mercado / valuation estimado da empresa (R$)', 'currency'))
    patrimonioItems.push(RADIO('possuiSocio', 'Possui sócio(s)?', ['Sim', 'Não']))
    if (has(draft, 'possuiSocio', 'Sim')) {
      patrimonioItems.push(T('quantosSocios', 'Quantos sócios?'))
      patrimonioItems.push(T('percentualSocio', 'Qual o seu percentual de participação (%)'))
    }
  }
  blocks.push({
    title: 'Necessidades Financeiras e Sucessão',
    sectionLabel: secPatrimonial(),
    items: patrimonioItems,
  })

  return blocks
}

// Print-only section titles. Deliberately different grouping/order from the
// live form's topic-based blocks (Dados Pessoais / Profissional / DPS /
// Patrimonial): the printed ADN groups everything about the client
// (bio + DPS/health/habits) first, then family history, then cônjuge, then
// each dependent, then the financial-needs questions — per explicit request.
const PRINT_SECTION_CLIENTE = 'Dados do Cliente'
const PRINT_SECTION_PROFISSIONAL = 'Dados Profissionais'
const PRINT_SECTION_HISTORICO = 'Histórico Familiar'
const PRINT_SECTION_CONJUGE = 'Cônjuge'
const PRINT_SECTION_DEPENDENTES = 'Dependentes'
const PRINT_SECTION_PATRIMONIAL = 'Necessidades Financeiras e Sucessão'
const PRINT_SECTION_OUTRAS = 'Outras Informações'
const PRINT_SECTION_RESUMO = 'Resumo do Compromisso'

const CLIENTE_KEYS = [
  'nascimento',
  'altura',
  'peso',
  'estadoCivil',
  'possuiDependentes',
  'quantosDependentes',
  'dependenteEspecial',
  'checkupAnual',
  'cirurgiaRecente',
  'cirurgiaDescricao',
  'cirurgiaSequela',
  'cirurgiaSequelaDescricao',
  'fumante',
  'atividadeFisica',
  'esporteRadical',
  'esporteRadicalQual',
  'esporteRadicalFrequencia',
  'andaDeMoto',
  'motoCilindrada',
]
const PROFISSIONAL_KEYS = [
  'profissao',
  'renda',
  'regimeTrabalho',
  'concursadoIngresso',
  'concursadoSabePrevidencia',
  'concursadoRendaEstimada',
  'viagensConstantes',
  'afastamento15dias',
]

/** Where a key prints, and — for cônjuge / dependentes / histórico familiar —
 * which named sub-group within that section it belongs to. */
function classifyForPrint(key: string): { section: string; group: string | null } {
  if (key === 'premium' || key === 'product') return { section: PRINT_SECTION_RESUMO, group: null }
  if (key.startsWith('conjuge') || key === 'regimeCasamento') return { section: PRINT_SECTION_CONJUGE, group: null }
  const depMatch = key.match(/^dep(\d+)/)
  if (depMatch) return { section: PRINT_SECTION_DEPENDENTES, group: `Dependente ${depMatch[1]}` }
  if (key === 'histFamiliares') return { section: PRINT_SECTION_HISTORICO, group: null }
  if (key.startsWith('histDoenca_')) {
    const slug = key.slice('histDoenca_'.length).split('_')[0]
    return { section: PRINT_SECTION_HISTORICO, group: `Histórico — ${slug}` }
  }
  if (key.startsWith('doencaCronica') || CLIENTE_KEYS.includes(key)) return { section: PRINT_SECTION_CLIENTE, group: null }
  if (PROFISSIONAL_KEYS.includes(key)) return { section: PRINT_SECTION_PROFISSIONAL, group: null }
  if (
    /^(patrimonio|dividas|tempoProtecaoRenda|possuiPatrimonio|possuiEmpresa|empresa|possuiSocio|quantosSocios|percentualSocio|bensInventario|custoManutencaoPadraoVida|representatividadeCliente)/.test(
      key,
    )
  )
    return { section: PRINT_SECTION_PATRIMONIAL, group: null }
  return { section: PRINT_SECTION_OUTRAS, group: null }
}

function prettifyKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// A draft that satisfies every conditional branch at once, so labelFor's
// index below picks up every question's real label — not just the ones
// visible from an empty draft.
const MAXIMAL_DRAFT: Anamnese = {
  estadoCivil: 'Casado',
  possuiDependentes: 'Sim',
  quantosDependentes: '1',
  conjugeContribuiFinanceiramente: 'Sim',
  regimeTrabalho: 'Concursado',
  concursadoSabePrevidencia: 'Sim',
  doencaCronica: 'Sim',
  doencaCronicaTipos: ['Câncer', 'Doença Cardiológica', 'Doença Neurológica', 'Outro'],
  doencaCronicaCancerTipos: ['Outro'],
  doencaCronicaCardioTipos: ['Outro'],
  doencaCronicaNeuroTipos: ['Outro'],
  doencaCronicaMedicamentoso: 'Sim',
  cirurgiaRecente: 'Sim',
  cirurgiaSequela: 'Sim',
  esporteRadical: 'Sim',
  andaDeMoto: 'Sim',
  histFamiliares: ['Pai'],
  histDoenca_Pai: ['Câncer', 'Doença Cardiológica', 'Doença Neurológica', 'Outro'],
  possuiPatrimonio: 'Sim',
  dividasLongoPrazo: 'Sim',
  possuiEmpresa: 'Sim',
  possuiSocio: 'Sim',
}

// doencaCronicaMedicamentoso forks two mutually exclusive branches, and each
// histFamiliares option produces its own dynamically-worded question ("Qual
// doença teve o(a) Mãe?") — build the index from all of them so every
// family member's label resolves to the real authored text.
const ALL_DOENCAS = ['Câncer', 'Diabetes', 'Pressão Alta', 'Doença Cardiológica', 'Doença Neurológica', 'Outro']
const MAXIMAL_DRAFT_VARIANTS: Anamnese[] = [
  MAXIMAL_DRAFT,
  { ...MAXIMAL_DRAFT, doencaCronicaMedicamentoso: 'Não' },
  { ...MAXIMAL_DRAFT, histFamiliares: ['Mãe'], histDoenca_Mãe: ALL_DOENCAS },
  { ...MAXIMAL_DRAFT, histFamiliares: ['Irmão(s)'], histDoenca_Irmãos: ALL_DOENCAS },
]

// The label text for dep{n}Nome/Idade/Custo never varies by n, so a fixed
// index built from one dependent (above) already covers every index.
const DEP_FIELD_LABELS: Record<string, string> = {
  Nome: 'Nome do dependente',
  Idade: 'Idade',
  Custo: 'Custo mensal com educação / atividades extras (R$, caso haja)',
}

const labelIndex = new Map<string, string>()
function labelFor(key: string): string {
  if (labelIndex.size === 0) {
    MAXIMAL_DRAFT_VARIANTS.forEach((draft) =>
      buildAnamneseBlocks(draft).forEach((b) => b.items.forEach((it) => labelIndex.set(it.key, it.label))),
    )
  }
  if (labelIndex.has(key)) return labelIndex.get(key) as string
  const depMatch = key.match(/^dep\d+(Nome|Idade|Custo)$/)
  if (depMatch) return DEP_FIELD_LABELS[depMatch[1]]
  return prettifyKey(key)
}

// Keeps nascimento/altura/peso together and first within Dados do Cliente,
// regardless of the order the consultor happened to fill in the live form.
const PRIORITY_KEYS = ['nascimento', 'altura', 'peso']
function sortByPriority(items: { key: string; label: string; value: string }[]) {
  return [...items].sort((a, b) => {
    const ra = PRIORITY_KEYS.indexOf(a.key)
    const rb = PRIORITY_KEYS.indexOf(b.key)
    return (ra === -1 ? PRIORITY_KEYS.length : ra) - (rb === -1 ? PRIORITY_KEYS.length : rb)
  })
}

export interface AnamneseGroup {
  title: string
  items: { label: string; value: string }[]
}
export interface AnamneseSection {
  title: string
  items: { label: string; value: string }[]
  groups: AnamneseGroup[]
}

const PRINT_SECTION_ORDER = [
  PRINT_SECTION_CLIENTE,
  PRINT_SECTION_PROFISSIONAL,
  PRINT_SECTION_HISTORICO,
  PRINT_SECTION_CONJUGE,
  PRINT_SECTION_DEPENDENTES,
  PRINT_SECTION_PATRIMONIAL,
  PRINT_SECTION_OUTRAS,
  PRINT_SECTION_RESUMO,
]

function groupSortKey(title: string): number {
  const dep = title.match(/^Dependente (\d+)$/)
  if (dep) return Number(dep[1])
  return 0
}

/** Groups a saved anamnese record for the read/print view, in a fixed order:
 * client's own data first, then family history, cônjuge, dependentes, and
 * finally financial-needs questions. */
export function buildAnamneseSections(
  anamnese: Anamnese,
  premium?: number | null,
  product?: string | null,
): AnamneseSection[] {
  const flat: Record<string, { key: string; label: string; value: string }[]> = {}
  const groups: Record<string, Record<string, { key: string; label: string; value: string }[]>> = {}

  Object.entries(anamnese || {}).forEach(([key, value]) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return
    const label = labelFor(key)
    const { section: sec, group: groupTitle } = classifyForPrint(key)
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
    if (groupTitle) {
      groups[sec] = groups[sec] || {}
      ;(groups[sec][groupTitle] = groups[sec][groupTitle] || []).push({ key, label, value: displayValue })
    } else {
      ;(flat[sec] = flat[sec] || []).push({ key, label, value: displayValue })
    }
  })

  if (premium) {
    ;(flat[PRINT_SECTION_RESUMO] = flat[PRINT_SECTION_RESUMO] || []).push(
      { key: 'premium', label: 'Prêmio mensal', value: `R$ ${premium.toLocaleString('pt-BR')}` },
      { key: 'product', label: 'Produto', value: product || '—' },
    )
  }

  return PRINT_SECTION_ORDER.filter((s) => flat[s]?.length || groups[s]).map((s) => ({
    title: s,
    items: sortByPriority(flat[s] ?? []).map(({ label, value }) => ({ label, value })),
    groups: Object.entries(groups[s] ?? {})
      .sort(([a], [b]) => groupSortKey(a) - groupSortKey(b) || a.localeCompare(b))
      .map(([title, items]) => ({ title, items: items.map(({ label, value }) => ({ label, value })) })),
  }))
}
