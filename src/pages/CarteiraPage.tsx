import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { resolveViewScope } from '../lib/viewScope'
import { formatCurrencyTyped, parseCurrency, toTitleCase } from '../lib/format'
import { AGENDA_START_HOUR, apptColor, apptTypeLabel, clientKey, statusColors, statusLabel } from '../lib/domain'
import { classifyVirtualClient, followupAlert } from '../lib/followup'
import type { Anamnese, Appointment, Client, Policy, PolicyStatus, Profile } from '../lib/types'
import { METLIFE_PRODUCT_LABELS } from '../lib/metlifeContract'
import { buildAnamneseSections } from '../lib/anamnese'
import { Modal, ModalHeader } from '../components/ui/Modal'
import { AnamneseForm } from '../components/modals/AnamneseForm'
import { AnamneseSectionsView } from '../components/AnamneseSectionsView'
import { NewAppointmentModal } from '../components/modals/NewAppointmentModal'
import { Avatar } from '../components/ui/Avatar'

const STATUS_LABELS: Record<PolicyStatus, string> = {
  ativa: 'Ativa',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}
const STATUS_COLORS: Record<PolicyStatus, { bg: string; color: string }> = {
  ativa: { bg: '#EAF0FA', color: '#0B2D5B' },
  entregue: { bg: '#E4F5EA', color: '#1E7A46' },
  cancelada: { bg: '#FBE7E7', color: '#B23030' },
}

type CarteiraTab = 'delay' | 'naoConcluido' | 'carteira'

export function CarteiraPage() {
  const { profile } = useAuth()
  const { consultants, clients, policies, appointments, removeClient } = useCrm()
  const { viewingId } = useUi()
  const [activeTab, setActiveTab] = useState<CarteiraTab>('carteira')
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [retornoFor, setRetornoFor] = useState<{ consultantId: string; name: string } | null>(null)
  const [search, setSearch] = useState('')

  if (!profile) return null
  const { isGestorView, memberIds } = resolveViewScope(consultants, viewingId)
  const scopedClients = memberIds ? clients.filter((c) => memberIds.includes(c.consultant_id)) : clients
  const targetConsultant = consultants.find((c) => c.id === viewingId)
  const canAddClient = viewingId !== 'gestor' && (targetConsultant ? targetConsultant.role === 'consultor' : true)

  const scopedAppointments = memberIds ? appointments.filter((a) => memberIds.includes(a.consultant_id)) : appointments
  const realKeys = new Set(scopedClients.map((c) => clientKey(c.consultant_id, c.name)))
  const virtualMap = new Map<string, { consultantId: string; name: string; appts: Appointment[] }>()
  scopedAppointments
    .filter((a) => a.type !== 'evento')
    .forEach((a) => {
      const key = clientKey(a.consultant_id, a.client_name)
      if (realKeys.has(key)) return
      if (!virtualMap.has(key)) virtualMap.set(key, { consultantId: a.consultant_id, name: a.client_name, appts: [] })
      virtualMap.get(key)!.appts.push(a)
    })
  const virtualClients = [...virtualMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const naoConcluido: { consultantId: string; name: string; last: Appointment }[] = []
  const delay: { consultantId: string; name: string; last: Appointment }[] = []
  const virtualCarteira: { consultantId: string; name: string; appts: Appointment[] }[] = []
  virtualClients.forEach((v) => {
    const { bucket, last } = classifyVirtualClient(v.appts)
    if (bucket === 'naoConcluido') naoConcluido.push({ consultantId: v.consultantId, name: v.name, last })
    else if (bucket === 'delay') delay.push({ consultantId: v.consultantId, name: v.name, last })
    else if (bucket === 'carteira') virtualCarteira.push(v)
    // 'outros' (still upcoming / rescheduled) hasn't happened yet — nothing to show here.
  })

  function openRetorno(consultantId: string, name: string) {
    setRetornoFor({ consultantId, name })
  }

  const searchNorm = search.trim().toLowerCase()
  const matchesSearch = (name: string) => !searchNorm || name.toLowerCase().includes(searchNorm)
  const filteredDelay = delay.filter((i) => matchesSearch(i.name))
  const filteredNaoConcluido = naoConcluido.filter((i) => matchesSearch(i.name))
  const filteredScopedClients = scopedClients.filter((c) => matchesSearch(c.name))
  const filteredVirtualCarteira = virtualCarteira.filter((v) => matchesSearch(v.name))

  function renderClientCard(client: Client) {
    const clientPolicies = policies.filter((p) => p.client_id === client.id)
    const consultant = consultants.find((c) => c.id === client.consultant_id)
    return (
      <div key={client.id} className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2.5 flex-wrap mb-3">
          <div className="flex items-center gap-2.5">
            {isGestorView && consultant && <Avatar profile={consultant} size={30} />}
            <div>
              <div className="text-[14px] font-semibold">{client.name}</div>
              <div className="text-[11.5px] text-text-faint">
                {[client.phone, client.birth_date ? dateBr(client.birth_date) : null, isGestorView ? consultant?.name : null]
                  .filter(Boolean)
                  .join(' · ')}
                {clientPolicies.length > 0 && ` · ${clientPolicies.length} apólice${clientPolicies.length > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remover ${client.name} da carteira? Isso também apaga as apólices dele.`)) removeClient(client.id)
            }}
            className="bg-transparent border-none text-[15px] p-1"
          >
            🗑️
          </button>
        </div>
        {client.notes && <div className="text-[12.5px] text-text-muted mb-3">{client.notes}</div>}
        <PolicyList clientId={client.id} consultantId={client.consultant_id} policies={clientPolicies} consultants={consultants} />
        <ClientTimeline
          consultantId={client.consultant_id}
          clientName={client.name}
          appointments={scopedAppointments}
          consultants={consultants}
          onSolicitarRetorno={() => openRetorno(client.consultant_id, client.name)}
        />
        <ClientAnamneseSection client={client} />
      </div>
    )
  }

  const TABS: [CarteiraTab, string, number, string, string][] = [
    ['delay', '🔁 Delays', filteredDelay.length, '#B23030', '#FBE7E7'],
    ['naoConcluido', '⏳ Realizadas, sem venda', filteredNaoConcluido.length, '#9C6B0A', '#FCEFD9'],
    ['carteira', '👥 Carteira Cliente', filteredScopedClients.length + filteredVirtualCarteira.length, '#1E7A46', '#E4F5EA'],
  ]

  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div className="font-heading font-bold text-[17px]">Carteira de Clientes</div>
        {canAddClient && activeTab === 'carteira' && (
          <button
            type="button"
            onClick={() => setNewClientOpen(true)}
            className="bg-navy text-white border-none rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          >
            + Novo cliente
          </button>
        )}
      </div>

      {!canAddClient && (
        <div className="text-[12px] text-text-faint">
          Selecione um consultor específico no cabeçalho pra ver e cadastrar clientes dele.
        </div>
      )}

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint text-[13px]">🔎</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar cliente pelo nome…"
          className="w-full border border-[#D8D5CD] rounded-lg pl-9 pr-3.5 py-2.5 text-[13px]"
        />
      </div>

      <div className="flex gap-2.5 flex-wrap">
        {TABS.map(([key, label, count, color, tint]) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className="rounded-xl px-5 py-3.5 text-[14px] font-bold whitespace-nowrap border-2 transition-transform"
              style={{
                background: active ? color : tint,
                borderColor: color,
                color: active ? '#fff' : color,
                boxShadow: active ? `0 3px 10px ${color}55` : undefined,
                transform: active ? 'scale(1.03)' : undefined,
              }}
            >
              {label}
              <span
                className="ml-2 inline-flex items-center justify-center rounded-full text-[12px] font-extrabold px-2 py-0.5"
                style={{ background: active ? 'rgba(255,255,255,0.25)' : '#fff', color: active ? '#fff' : color }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {activeTab === 'delay' && (
        <FollowupSection
          hint="Agendou mas o cliente não apareceu — abordagem agendada, mas não realizada. Vale a pena retomar contato."
          items={filteredDelay}
          bucket="delay"
          consultants={consultants}
          isGestorView={isGestorView}
          appointments={scopedAppointments}
          onSolicitarRetorno={openRetorno}
        />
      )}

      {activeTab === 'naoConcluido' && (
        <FollowupSection
          hint="A reunião aconteceu, mas ainda não fechou venda. Não deixa esfriar."
          items={filteredNaoConcluido}
          bucket="naoProtocolado"
          consultants={consultants}
          isGestorView={isGestorView}
          appointments={scopedAppointments}
          onSolicitarRetorno={openRetorno}
        />
      )}

      {activeTab === 'carteira' && (
        <div className="flex flex-col gap-2.5">
          {filteredScopedClients.map(renderClientCard)}
          {filteredVirtualCarteira.map((v) => (
            <VirtualClientRow
              key={clientKey(v.consultantId, v.name)}
              virtualClient={v}
              isGestorView={isGestorView}
              consultantName={consultants.find((c) => c.id === v.consultantId)?.name}
              consultants={consultants}
            />
          ))}
          {filteredScopedClients.length === 0 && filteredVirtualCarteira.length === 0 && (
            <div className="text-[12.5px] text-text-faint">
              {searchNorm ? 'Nenhum cliente encontrado com esse nome.' : 'Nenhum cliente na carteira ainda.'}
            </div>
          )}
        </div>
      )}

      {newClientOpen && <NewClientModal consultantId={viewingId} onClose={() => setNewClientOpen(false)} />}

      {retornoFor && (
        <NewAppointmentModal
          slot={{ consultantIds: [retornoFor.consultantId], date: todayStr(), time: `${String(AGENDA_START_HOUR).padStart(2, '0')}:00` }}
          isGestorAggregate={false}
          prefillClientName={retornoFor.name}
          onClose={() => setRetornoFor(null)}
        />
      )}
    </div>
  )
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function FollowupSection({
  hint,
  items,
  bucket,
  consultants,
  isGestorView,
  appointments,
  onSolicitarRetorno,
}: {
  hint: string
  items: { consultantId: string; name: string; last: Appointment }[]
  bucket: keyof Profile['followup_goals']
  consultants: Profile[]
  isGestorView: boolean
  appointments: Appointment[]
  onSolicitarRetorno: (consultantId: string, name: string) => void
}) {
  const today = new Date()
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11px] text-text-faint">{hint}</div>
      {items.map((item) => {
        const consultant = consultants.find((c) => c.id === item.consultantId)
        const alert = followupAlert(bucket, item.last.date, consultant?.followup_goals ?? { naoProtocolado: 7, delay: 3, entrega: 30, recalibrar: 365 }, today)
        return (
          <div
            key={`${item.consultantId}::${item.name}`}
            className="bg-card border border-border rounded-2xl p-4"
            style={{ borderColor: alert.overdue ? '#E0A526' : undefined }}
          >
            <div className="flex items-center justify-between gap-2.5 flex-wrap mb-3">
              <div className="flex items-center gap-2.5">
                {isGestorView && consultant && <Avatar profile={consultant} size={30} />}
                <div>
                  <div className="text-[14px] font-semibold">{item.name}</div>
                  <div className="text-[11.5px] text-text-faint">
                    {[isGestorView ? consultant?.name : null, `última reunião em ${dateBr(item.last.date)}`, `há ${alert.days} dia${alert.days !== 1 ? 's' : ''}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {alert.overdue && (
                    <div className="text-[11px] font-bold text-[#9C6B0A] mt-1">
                      ⚠️ Passou do prazo de {alert.limit} dias pra recontatar
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSolicitarRetorno(item.consultantId, item.name)}
                className="bg-navy text-white border-none rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap"
              >
                📅 Agendar retorno
              </button>
            </div>
            <ClientTimeline
              consultantId={item.consultantId}
              clientName={item.name}
              appointments={appointments}
              consultants={consultants}
              onSolicitarRetorno={() => onSolicitarRetorno(item.consultantId, item.name)}
              hideHeader
            />
          </div>
        )
      })}
      {items.length === 0 && <div className="text-[12.5px] text-text-faint">Nada por aqui.</div>}
    </div>
  )
}

const TIMELINE_LABELS: Record<string, (n: number) => string> = {
  abordagem: () => 'AB',
  fechamento: (n) => (n <= 1 ? 'F' : `F${n}`),
  entrega: () => 'Entrega',
  outros: () => 'Outros',
}

const PENDING_ENTREGA_ID = 'pending-entrega'

type TimelineStep =
  | { kind: 'real'; id: string; label: string; color: string; date: string; appt: Appointment }
  | { kind: 'pendingEntrega'; id: typeof PENDING_ENTREGA_ID; label: string; date: string; overdue: boolean; limit: number; closingApptId: string }

function ClientTimeline({
  consultantId,
  clientName,
  appointments,
  consultants,
  onSolicitarRetorno,
  hideHeader,
}: {
  consultantId: string
  clientName: string
  appointments: Appointment[]
  consultants: Profile[]
  onSolicitarRetorno: () => void
  hideHeader?: boolean
}) {
  const { updateAppointment } = useCrm()
  const [openId, setOpenId] = useState<string | null>(null)
  const key = clientKey(consultantId, clientName)
  const timelineAppts = appointments
    .filter((a) => a.type !== 'evento' && clientKey(a.consultant_id, a.client_name) === key)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  if (timelineAppts.length === 0) return null

  let fechamentoCount = 0
  const steps: TimelineStep[] = timelineAppts.map((a) => {
    if (a.type === 'fechamento') fechamentoCount++
    const label = a.type === 'fechamento' ? TIMELINE_LABELS.fechamento(fechamentoCount) : (TIMELINE_LABELS[a.type]?.(0) ?? a.type)
    return { kind: 'real', id: a.id, label, color: apptColor(a), date: a.date, appt: a }
  })

  // A closed policy that hasn't been delivered yet gets a placeholder step —
  // uncolored, with the delivery deadline — until the consultor either marks
  // it delivered or a real "entrega" appointment shows up in the timeline.
  const closingAppt = [...timelineAppts].reverse().find((a) => a.policy_closed === true)
  const hasEntregaStep = timelineAppts.some((a) => a.type === 'entrega')
  if (closingAppt && !closingAppt.policy_delivered && !hasEntregaStep) {
    const goals = consultants.find((c) => c.id === consultantId)?.followup_goals ?? { naoProtocolado: 7, delay: 3, entrega: 30, recalibrar: 365 }
    const alert = followupAlert('entrega', closingAppt.date, goals, new Date())
    steps.push({
      kind: 'pendingEntrega',
      id: PENDING_ENTREGA_ID,
      label: 'Entrega',
      date: closingAppt.date,
      overdue: alert.overdue,
      limit: alert.limit,
      closingApptId: closingAppt.id,
    })
  }

  const openStep = steps.find((s) => s.id === openId)

  return (
    <div className="mb-4">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold text-text-muted tracking-wide">LINHA DO TEMPO</div>
          <button
            type="button"
            onClick={onSolicitarRetorno}
            className="bg-transparent border-none text-[11.5px] font-semibold text-navy p-0"
          >
            📅 Solicitar retorno
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch" style={{ minWidth: steps.length * 92 }}>
          {steps.map((step, i) => {
            const color = step.kind === 'real' ? step.color : step.overdue ? '#E0A526' : '#C7CAD1'
            return (
              <div key={step.id} className="flex items-stretch" style={{ flex: i < steps.length - 1 ? '1 1 auto' : '0 0 auto' }}>
                <div className="flex flex-col items-center" style={{ width: 92 }}>
                  <div className="h-[34px] flex items-end justify-center px-1">
                    {i % 2 === 0 && (
                      <span className="text-[10px] font-semibold text-center leading-tight">{step.label}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === step.id ? null : step.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold border-2 border-white shrink-0"
                    style={{
                      background: step.kind === 'pendingEntrega' ? '#fff' : color,
                      color: step.kind === 'pendingEntrega' ? color : '#fff',
                      boxShadow: openId === step.id ? `0 0 0 3px ${color}55` : `0 0 0 1px ${step.kind === 'pendingEntrega' ? color : '#D8D5CD'}`,
                    }}
                  >
                    {step.kind === 'pendingEntrega' ? '!' : i + 1}
                  </button>
                  <div className="text-[9.5px] text-text-faint mt-1 whitespace-nowrap">
                    {step.kind === 'pendingEntrega' ? `prazo ${step.limit}d` : dateBr(step.date)}
                  </div>
                  <div className="h-[24px] flex items-start justify-center px-1">
                    {i % 2 === 1 && (
                      <span className="text-[10px] font-semibold text-center leading-tight">{step.label}</span>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && <div className="h-[3px] self-center flex-1 min-w-[16px]" style={{ background: color }} />}
              </div>
            )
          })}
        </div>
      </div>

      {openStep?.kind === 'real' && (
        <div className="border border-border rounded-[10px] px-3 py-2.5 mt-2.5">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: openStep.color }}>
              {openStep.label} · {apptTypeLabel(openStep.appt)}
            </span>
            <input
              type="date"
              defaultValue={openStep.appt.date}
              onChange={(e) => e.target.value && updateAppointment(openStep.appt.id, { date: e.target.value })}
              className="border border-[#D8D5CD] rounded-lg px-2 py-1 text-[11.5px]"
            />
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: statusColors(openStep.appt.status).bg, color: statusColors(openStep.appt.status).color }}
            >
              {statusLabel(openStep.appt.status)}
            </span>
            {openStep.appt.policy_closed && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#E4F5EA] text-[#1E7A46]">
                ✅ Protocolo — venda concluída
              </span>
            )}
          </div>
          <textarea
            defaultValue={openStep.appt.notes ?? ''}
            onBlur={(e) => updateAppointment(openStep.appt.id, { notes: e.target.value.trim() || null })}
            placeholder={`Relato do consultor sobre a ${apptTypeLabel(openStep.appt).toLowerCase()}…`}
            rows={2}
            className="w-full border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[12.5px] resize-none"
          />
        </div>
      )}

      {openStep?.kind === 'pendingEntrega' && (
        <div className="border border-border rounded-[10px] px-3 py-2.5 mt-2.5">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: openStep.overdue ? '#E0A526' : '#9AA0A8' }}
            >
              Entrega pendente
            </span>
            <span className="text-[11.5px] text-text-faint">venda fechada em {dateBr(openStep.date)}</span>
          </div>
          {openStep.overdue ? (
            <div className="text-[11.5px] font-bold text-[#9C6B0A] mb-2">
              ⚠️ Passou do prazo de {openStep.limit} dias pra entregar essa apólice.
            </div>
          ) : (
            <div className="text-[11.5px] text-text-muted mb-2">
              Prazo de {openStep.limit} dias pra entregar essa apólice ainda não venceu.
            </div>
          )}
          <button
            type="button"
            onClick={() => updateAppointment(openStep.closingApptId, { policy_delivered: true })}
            className="bg-green text-white border-none rounded-lg px-3 py-2 text-[12.5px] font-semibold"
          >
            ✅ Marcar apólice como entregue
          </button>
        </div>
      )}
    </div>
  )
}

function dateBr(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function VirtualClientRow({
  virtualClient,
  isGestorView,
  consultantName,
  consultants,
}: {
  virtualClient: { consultantId: string; name: string; appts: Appointment[] }
  isGestorView: boolean
  consultantName: string | undefined
  consultants: Profile[]
}) {
  const { createClient, updateClient, createPolicy } = useCrm()
  const [promoting, setPromoting] = useState(false)
  const [promoted, setPromoted] = useState(false)

  const sorted = [...virtualClient.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const last = sorted[sorted.length - 1]
  const sourceAnamnese = [...sorted].reverse().find((a) => a.anamnese && Object.keys(a.anamnese).length > 0)?.anamnese
  const closedAppt = sorted.find((a) => a.policy_closed === true)

  async function handlePromote() {
    setPromoting(true)
    const created = await createClient({
      consultant_id: virtualClient.consultantId,
      name: toTitleCase(virtualClient.name),
      phone: null,
      birth_date: null,
      notes: null,
    })
    if (created && sourceAnamnese) {
      await updateClient(created.id, { anamnese: sourceAnamnese })
    }
    if (created && closedAppt) {
      await createPolicy({
        client_id: created.id,
        consultant_id: virtualClient.consultantId,
        product: closedAppt.product ?? 'Não informado',
        premium: closedAppt.premium,
        policy_number: null,
        issued_date: null,
        status: 'ativa',
        document_path: null,
      })
    }
    setPromoting(false)
    setPromoted(true)
  }

  if (promoted) return null

  return (
    <div className="bg-card border border-dashed border-border rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2.5 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          {isGestorView &&
            (() => {
              const consultant = consultants.find((c) => c.id === virtualClient.consultantId)
              return consultant ? <Avatar profile={consultant} size={30} /> : null
            })()}
          <div>
            <div className="text-[14px] font-semibold">{virtualClient.name}</div>
            <div className="text-[11.5px] text-text-faint">
              {[
                isGestorView ? consultantName : null,
                `${virtualClient.appts.length} agendamento${virtualClient.appts.length > 1 ? 's' : ''}`,
                last ? `último em ${dateBr(last.date)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={promoting}
          onClick={handlePromote}
          className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {promoting ? 'Adicionando…' : '📥 Adicionar à carteira'}
        </button>
      </div>
      <ClientTimeline
        consultantId={virtualClient.consultantId}
        clientName={virtualClient.name}
        appointments={virtualClient.appts}
        consultants={consultants}
        onSolicitarRetorno={() => {}}
        hideHeader
      />
    </div>
  )
}

function NewClientModal({ consultantId, onClose }: { consultantId: string; onClose: () => void }) {
  const { createClient } = useCrm()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await createClient({
      consultant_id: consultantId,
      name: toTitleCase(name),
      phone: phone.trim() || null,
      birth_date: birthDate || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} align="center" maxWidth={420}>
      <ModalHeader title="Novo cliente" onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Telefone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Data de nascimento
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
          />
        </label>
        <label className="text-xs text-text-muted flex flex-col gap-1">
          Observações (opcional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px] resize-none"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold w-full disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar cliente'}
        </button>
      </form>
    </Modal>
  )
}

function PolicyList({
  clientId,
  consultantId,
  policies,
  consultants,
}: {
  clientId: string
  consultantId: string
  policies: Policy[]
  consultants: Profile[]
}) {
  const consultant = consultants.find((c) => c.id === consultantId)
  const followupGoals = consultant?.followup_goals ?? { naoProtocolado: 7, delay: 3, entrega: 30, recalibrar: 365 }
  const today = new Date()
  const { createPolicy, updatePolicy, removePolicy, uploadPolicyDocument, getPolicyDocumentUrl } = useCrm()
  const [adding, setAdding] = useState(false)
  const [product, setProduct] = useState(METLIFE_PRODUCT_LABELS[0])
  const [premiumInput, setPremiumInput] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [autoDetected, setAutoDetected] = useState(false)

  async function handleDocumentSelected(file: File | null) {
    setDocumentFile(file)
    setAutoDetected(false)
    if (!file || file.type !== 'application/pdf') return
    setExtracting(true)
    try {
      const { extractPdfText, guessProduct, guessPremium, guessVigenciaInicio } = await import('../lib/policyPdfExtract')
      const text = await extractPdfText(file)
      const detectedProduct = guessProduct(text)
      const detectedPremium = guessPremium(text)
      const detectedVigencia = await guessVigenciaInicio(file)
      if (detectedProduct) setProduct(detectedProduct)
      if (detectedPremium) setPremiumInput(formatCurrencyTyped(String(Math.round(detectedPremium * 100))))
      if (detectedVigencia) {
        const [d, m, y] = detectedVigencia.split('/')
        setIssuedDate(`${y}-${m}-${d}`)
      }
      if (detectedProduct || detectedPremium || detectedVigencia) setAutoDetected(true)
    } catch (err) {
      console.error(err) // eslint-disable-line no-console
    } finally {
      setExtracting(false)
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const created = await createPolicy({
      client_id: clientId,
      consultant_id: consultantId,
      product,
      premium: premiumInput ? parseCurrency(premiumInput) : null,
      policy_number: policyNumber.trim() || null,
      issued_date: issuedDate || null,
      status: 'ativa',
      document_path: null,
    })
    if (created && documentFile) {
      await uploadPolicyDocument(consultantId, created.id, documentFile)
    }
    setSaving(false)
    setAdding(false)
    setProduct(METLIFE_PRODUCT_LABELS[0])
    setPremiumInput('')
    setPolicyNumber('')
    setIssuedDate('')
    setDocumentFile(null)
    setAutoDetected(false)
  }

  async function handleAttach(policyId: string, file: File) {
    setAttachingId(policyId)
    await uploadPolicyDocument(consultantId, policyId, file)
    setAttachingId(null)
  }

  async function handleOpen(policyId: string, path: string) {
    setOpeningId(policyId)
    const url = await getPolicyDocumentUrl(path)
    setOpeningId(null)
    if (url) window.open(url, '_blank')
    else alert('Não foi possível abrir o documento.')
  }

  return (
    <div>
      <div className="text-[11px] font-bold text-text-muted tracking-wide mb-2">APÓLICES</div>
      <div className="flex flex-col gap-2 mb-3">
        {policies.map((p) => {
          const sc = STATUS_COLORS[p.status]
          const entregaAlert =
            p.status === 'ativa' && p.issued_date ? followupAlert('entrega', p.issued_date, followupGoals, today) : null
          const recalibrarAlert =
            p.status !== 'cancelada' && p.issued_date ? followupAlert('recalibrar', p.issued_date, followupGoals, today) : null
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 border border-border rounded-[10px] px-3 py-2.5 flex-wrap">
              <div>
                <div className="text-[13px] font-semibold">{p.product}</div>
                <div className="text-[11px] text-text-faint">
                  {[p.policy_number ? `nº ${p.policy_number}` : null, p.premium ? `R$ ${p.premium.toLocaleString('pt-BR')}` : null, p.issued_date ? dateBr(p.issued_date) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {entregaAlert?.overdue && (
                  <div className="text-[10.5px] font-bold text-[#9C6B0A] mt-1">
                    ⚠️ Entregar apólice — passou de {entregaAlert.limit} dias sem entrega
                  </div>
                )}
                {recalibrarAlert?.overdue && (
                  <div className="text-[10.5px] font-bold text-[#0B2D5B] mt-1">🔄 Hora de retornar pra recalibrar essa apólice</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={p.status}
                  onChange={(e) => updatePolicy(p.id, { status: e.target.value as PolicyStatus })}
                  className="text-[11px] font-bold rounded-full px-2.5 py-1 border-none"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  {(Object.keys(STATUS_LABELS) as PolicyStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {p.document_path ? (
                  <button
                    type="button"
                    disabled={openingId === p.id}
                    onClick={() => handleOpen(p.id, p.document_path as string)}
                    className="bg-transparent border-none text-[13px] p-1"
                    title="Ver apólice anexada"
                  >
                    {openingId === p.id ? '…' : '📎'}
                  </button>
                ) : (
                  <label className="text-[13px] p-1 cursor-pointer" title="Anexar apólice (PDF)">
                    {attachingId === p.id ? '…' : '📎'}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleAttach(p.id, file)
                      }}
                    />
                  </label>
                )}
                <button type="button" onClick={() => removePolicy(p.id)} className="bg-transparent border-none text-[13px] p-1">
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
        {policies.length === 0 && <div className="text-[12px] text-text-faint">Nenhuma apólice cadastrada ainda.</div>}
      </div>

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold"
        >
          + Adicionar apólice
        </button>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 bg-bg rounded-xl p-3">
          <label
            className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-5 px-3 cursor-pointer text-center"
            style={{ borderColor: documentFile ? '#1E7A8C' : '#C7CAD1', background: documentFile ? '#E3F1F4' : '#fff' }}
          >
            <div className="text-[26px] leading-none">📎</div>
            <div className="text-[13px] font-bold text-navy">
              {documentFile ? documentFile.name : 'Anexar apólice em PDF'}
            </div>
            <div className="text-[11px] text-text-faint">
              {documentFile ? 'Toque pra trocar o arquivo' : 'Preenche produto e prêmio sozinho a partir do PDF'}
            </div>
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleDocumentSelected(e.target.files?.[0] ?? null)} />
          </label>
          {extracting && <div className="text-[11px] text-text-faint text-center">🔍 Lendo o PDF pra preencher produto e prêmio…</div>}
          {autoDetected && !extracting && (
            <div className="text-[11px] text-[#1E7A46] font-semibold text-center">
              ✅ Produto e prêmio preenchidos automaticamente a partir do PDF — confira antes de salvar.
            </div>
          )}

          <div>
            <div className="text-[11px] text-text-muted mb-1.5">Produto vendido (opcional)</div>
            <div className="flex flex-wrap gap-1.5">
              {METLIFE_PRODUCT_LABELS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProduct(p)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold border"
                  style={{
                    borderColor: product === p ? '#0B2D5B' : '#D8D5CD',
                    background: product === p ? '#0B2D5B' : '#fff',
                    color: product === p ? '#fff' : '#1A1D23',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <label className="text-xs text-text-muted flex flex-col gap-1 flex-1 min-w-[130px]">
              Prêmio mensal (opcional)
              <input
                value={premiumInput}
                onChange={(e) => setPremiumInput(formatCurrencyTyped(e.target.value))}
                placeholder="R$"
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="text-xs text-text-muted flex flex-col gap-1 flex-1 min-w-[130px]">
              Número da apólice (opcional)
              <input
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
            <label className="text-xs text-text-muted flex flex-col gap-1">
              Início de vigência (opcional)
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-navy text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-60">
              {saving ? 'Salvando…' : 'Salvar apólice'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="bg-transparent border-none text-text-muted text-[12.5px] font-semibold">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function ClientAnamneseSection({ client }: { client: Client }) {
  const { updateClient } = useCrm()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Anamnese>(client.anamnese)
  const [saving, setSaving] = useState(false)

  const sections = buildAnamneseSections(client.anamnese)

  async function handleSave() {
    setSaving(true)
    await updateClient(client.id, { anamnese: draft })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="mt-3.5 pt-3.5 border-t border-border">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-bold text-text-muted tracking-wide">ANAMNESE</div>
        <button
          type="button"
          onClick={() => {
            setDraft(client.anamnese)
            setEditing((v) => !v)
          }}
          className="bg-transparent border-none text-navy text-[12.5px] font-semibold"
        >
          {editing ? 'Cancelar' : sections.length > 0 ? '✏️ Editar anamnese' : '📋 Preencher anamnese'}
        </button>
      </div>
      {!editing ? (
        <AnamneseSectionsView sections={sections} />
      ) : (
        <div className="flex flex-col gap-4.5">
          <AnamneseForm draft={draft} onChange={setDraft} />
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar anamnese'}
          </button>
        </div>
      )}
    </div>
  )
}
