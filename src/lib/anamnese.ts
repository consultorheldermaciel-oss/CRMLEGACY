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
      T('doencaCronicaQual', 'Qual o diagnóstico?'),
      T('doencaCronicaData', 'Data do diagnóstico', 'date'),
      T('doencaCronicaTratamento', 'Qual o tratamento realizado?'),
      T('doencaCronicaMedicamento', 'Qual medicamento toma?'),
      T('doencaCronicaGramatura', 'Gramatura do medicamento'),
      T('doencaCronicaFrequencia', 'Com que frequência toma?'),
    )
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
    RADIO('possuiPatrimonio', 'Possui patrimônio (imóveis, automóveis, aplicações)?', ['Sim', 'Não']),
  ]
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

/** Section a given answer key belongs to, for the grouped read-only view. */
export function sectionForKey(key: string): string {
  if (key === 'premium' || key === 'product') return 'Resumo do Compromisso'
  if (
    /^(dep\d|conjuge)/.test(key) ||
    ['nascimento', 'estadoCivil', 'regimeCasamento', 'possuiDependentes', 'quantosDependentes', 'dependenteEspecial'].includes(key)
  )
    return SECTION_DADOS_PESSOAIS
  if (
    [
      'profissao',
      'renda',
      'regimeTrabalho',
      'concursadoIngresso',
      'concursadoSabePrevidencia',
      'concursadoRendaEstimada',
      'viagensConstantes',
      'afastamento15dias',
    ].includes(key)
  )
    return SECTION_DADOS_PROFISSIONAIS
  if (
    /^hist/.test(key) ||
    [
      'peso',
      'altura',
      'checkupAnual',
      'doencaCronica',
      'doencaCronicaQual',
      'doencaCronicaData',
      'doencaCronicaTratamento',
      'doencaCronicaMedicamento',
      'doencaCronicaGramatura',
      'doencaCronicaFrequencia',
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
    ].includes(key)
  )
    return SECTION_DPS
  if (/^(patrimonio|dividas|tempoProtecaoRenda|possuiPatrimonio|possuiEmpresa|empresa|possuiSocio|quantosSocios|percentualSocio|bensInventario)/.test(key))
    return SECTION_PATRIMONIAL
  return 'Outras Informações'
}

function prettifyKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const labelIndex = new Map<string, string>()
function labelFor(key: string): string {
  if (labelIndex.has(key)) return labelIndex.get(key) as string
  // populate the index once from a throwaway build of the full question tree
  buildAnamneseBlocks({}).forEach((b) =>
    b.items.forEach((it) => labelIndex.set(it.key, it.label)),
  )
  return labelIndex.get(key) ?? prettifyKey(key)
}

export interface AnamneseSection {
  title: string
  items: { label: string; value: string }[]
}

const SECTION_ORDER = [
  SECTION_DADOS_PESSOAIS,
  SECTION_DADOS_PROFISSIONAIS,
  SECTION_DPS,
  SECTION_PATRIMONIAL,
  'Outras Informações',
  'Resumo do Compromisso',
]

/** Groups a saved anamnese record into the 4 (+ summary) sections for the read/print view. */
export function buildAnamneseSections(
  anamnese: Anamnese,
  premium?: number | null,
  product?: string | null,
): AnamneseSection[] {
  const grouped: Record<string, { label: string; value: string }[]> = {}
  Object.entries(anamnese || {}).forEach(([key, value]) => {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return
    const label = labelFor(key)
    const sec = sectionForKey(key)
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
    ;(grouped[sec] = grouped[sec] || []).push({ label, value: displayValue })
  })
  if (premium) {
    ;(grouped['Resumo do Compromisso'] = grouped['Resumo do Compromisso'] || []).push(
      { label: 'Prêmio mensal', value: `R$ ${premium.toLocaleString('pt-BR')}` },
      { label: 'Produto', value: product || '—' },
    )
  }
  return SECTION_ORDER.filter((s) => grouped[s]?.length).map((s) => ({ title: s, items: grouped[s] }))
}
