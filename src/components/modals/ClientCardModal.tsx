import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useCrm } from '../../context/CrmContext'
import type { Anamnese, Appointment } from '../../lib/types'
import { isManagerRole } from '../../lib/types'
import { METLIFE_PRODUCT_LABELS } from '../../lib/metlifeContract'
import { apptColor, apptTypeLabel, isOccupied, statusColors, statusLabel } from '../../lib/domain'
import { dateLabel, dstr, formatCurrencyTyped, parseCurrency, WEEKDAYS } from '../../lib/format'
import { buildAnamneseSections } from '../../lib/anamnese'
import { Modal } from '../ui/Modal'
import { AnamneseForm } from './AnamneseForm'

function nextDays(n: number) {
  const out: string[] = []
  const base = new Date()
  for (let i = 0; i < n; i++) {
    const dt = new Date(base)
    dt.setDate(base.getDate() + i)
    out.push(dstr(dt.getFullYear(), dt.getMonth(), dt.getDate()))
  }
  return out
}

function googleCalendarUrl(appt: Appointment) {
  const [y, m, d] = appt.date.split('-').map(Number)
  const [h] = appt.time.split(':').map(Number)
  const start = new Date(y, m - 1, d, h)
  const end = new Date(start.getTime() + appt.duration * 3600000)
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${apptTypeLabel(appt)} — ${appt.client_name}`,
    dates: `${fmt(start)}/${fmt(end)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function ClientCardModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const { profile } = useAuth()
  const { consultants, appointments, updateAppointment, deleteAppointment, createAppointment } = useCrm()
  const canDelete = (profile && isManagerRole(profile.role)) || appt.created_by === profile?.id
  const [remarcarActive, setRemarcarActive] = useState(false)
  const [remarcarDate, setRemarcarDate] = useState<string | null>(null)
  const [showAgendarFechamento, setShowAgendarFechamento] = useState(false)
  const [fechamentoDate, setFechamentoDate] = useState<string | null>(null)
  const [showAgendarEntrega, setShowAgendarEntrega] = useState(false)
  const [entregaDate, setEntregaDate] = useState<string | null>(null)
  const [editingAnamnese, setEditingAnamnese] = useState(false)
  const [draft, setDraft] = useState<Anamnese>(appt.anamnese)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [premiumInput, setPremiumInput] = useState('')

  const consultant = consultants.find((c) => c.id === appt.consultant_id)
  const sc = statusColors(appt.status)
  const days7 = nextDays(7)
  const days10 = nextDays(10)
  const activeRemarcarDate = remarcarDate || days7[0]
  const activeFechamentoDate = fechamentoDate || days10[0]
  const activeEntregaDate = entregaDate || days10[0]

  const showFecharApolicePrompt = appt.type === 'fechamento' && appt.status === 'compareceu' && appt.policy_closed === null
  const showMarkDeliveredButton = !!appt.policy_closed && !appt.policy_delivered
  const showAgendarFechamentoButton = appt.type === 'abordagem' && !appt.fechamento_agendado
  const linkedFechamento = appt.fechamento_agendado
    ? appointments.find(
        (a) => a.type === 'fechamento' && a.client_name === appt.client_name && a.consultant_id === appt.consultant_id && a.date >= appt.date,
      )
    : undefined
  const linkedEntrega = appointments.find((a) => a.type === 'entrega' && a.linked_appointment_id === appt.id)
  const showAgendarEntregaButton = appt.type === 'fechamento' && !!appt.policy_closed && !linkedEntrega

  const sections = buildAnamneseSections(appt.anamnese, appt.premium, appt.product)

  async function setStatus(status: Appointment['status']) {
    await updateAppointment(appt.id, { status })
  }

  async function confirmRemarcar(time: string) {
    await updateAppointment(appt.id, { date: activeRemarcarDate, time, status: 'remarcado' })
    setRemarcarActive(false)
    onClose()
  }

  async function confirmAgendarFechamento(time: string) {
    await updateAppointment(appt.id, { fechamento_agendado: true })
    await createAppointment({
      consultant_id: appt.consultant_id,
      client_name: appt.client_name,
      type: 'fechamento',
      event_kind: null,
      duration: 1,
      date: activeFechamentoDate,
      time,
      status: 'agendado',
      wants_manager: false,
      locked_by_lider: appt.locked_by_lider,
      anamnese: appt.anamnese,
      policy_closed: null,
      premium: null,
      product: null,
      policy_delivered: null,
      fechamento_agendado: false,
      linked_appointment_id: appt.id,
    })
    setShowAgendarFechamento(false)
  }

  async function confirmAgendarEntrega(time: string) {
    await createAppointment({
      consultant_id: appt.consultant_id,
      client_name: appt.client_name,
      type: 'entrega',
      event_kind: null,
      duration: 1,
      date: activeEntregaDate,
      time,
      status: 'agendado',
      wants_manager: false,
      locked_by_lider: appt.locked_by_lider,
      anamnese: appt.anamnese,
      policy_closed: appt.policy_closed,
      premium: appt.premium,
      product: appt.product,
      policy_delivered: null,
      fechamento_agendado: false,
      linked_appointment_id: appt.id,
    })
    setShowAgendarEntrega(false)
  }

  async function confirmPolicyClosed() {
    await updateAppointment(appt.id, {
      policy_closed: true,
      premium: parseCurrency(premiumInput),
      product: selectedProduct || METLIFE_PRODUCT_LABELS[0],
    })
  }

  async function saveAnamnese() {
    await updateAppointment(appt.id, { anamnese: draft })
    setEditingAnamnese(false)
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="font-heading font-bold text-[19px]">{appt.client_name}</div>
          <div className="text-[12.5px] text-text-muted">
            {consultant?.name} · {dateLabel(appt.date)} às {appt.time}
          </div>
        </div>
        <button type="button" onClick={onClose} className="bg-transparent border-none text-2xl text-text-faint no-print">
          ×
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4">
        <span className="text-white text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: apptColor(appt) }}>
          {apptTypeLabel(appt)}
        </span>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
          {statusLabel(appt.status)}
        </span>
        {appt.wants_manager && (
          <span className="text-white text-[11px] font-bold px-2.5 py-1 rounded-full bg-gold">
            ⭐ líder de unidade solicitado
          </span>
        )}
      </div>

      {showAgendarFechamentoButton && !appt.fechamento_agendado && (
        <button
          type="button"
          onClick={() => setShowAgendarFechamento(true)}
          className="bg-green text-white border-none rounded-lg px-3.5 py-2.5 text-[13px] font-bold mb-4 no-print"
        >
          📅 Agendar fechamento
        </button>
      )}
      {appt.fechamento_agendado && linkedFechamento && (
        <div className="bg-[#E4F5EA] text-[#1E7A46] rounded-lg px-3.5 py-2.5 text-[13px] font-bold mb-4">
          ✅ Fechamento agendado para {dateLabel(linkedFechamento.date)} às {linkedFechamento.time}
        </div>
      )}

      {showAgendarFechamento && (
        <div className="bg-bg rounded-xl p-4 mb-4.5 no-print">
          <div className="text-[12.5px] font-bold text-text-muted mb-2.5">
            AGENDAR FECHAMENTO — a abordagem de {dateLabel(appt.date)} continua no calendário
          </div>
          <div className="flex gap-1.5 mb-3.5 flex-wrap">
            {days10.map((ds) => {
              const dt = new Date(ds + 'T00:00:00')
              const active = activeFechamentoDate === ds
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setFechamentoDate(ds)}
                  className="rounded-lg py-1.5 px-2.5 text-center border min-w-[46px]"
                  style={{ borderColor: active ? '#0B2D5B' : '#D8D5CD', background: active ? '#0B2D5B' : '#fff', color: active ? '#fff' : '#1A1D23' }}
                >
                  <div className="text-[9.5px]">{WEEKDAYS[dt.getDay()]}</div>
                  <div className="text-sm font-bold">{dt.getDate()}</div>
                </button>
              )
            })}
          </div>
          <div className="text-[12.5px] font-bold text-text-muted mb-2">HORÁRIOS — {dateLabel(activeFechamentoDate)}</div>
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
            {Array.from({ length: 10 }, (_, i) => i + 8).map((h) => {
              const time = `${String(h).padStart(2, '0')}:00`
              const occ = isOccupied(appointments, appt.consultant_id, activeFechamentoDate, h)
              return (
                <button
                  key={time}
                  type="button"
                  disabled={occ}
                  onClick={() => confirmAgendarFechamento(time)}
                  className="flex justify-between border border-border rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: occ ? '#F6F5F2' : '#fff', color: occ ? '#B0B4BC' : '#1A1D23' }}
                >
                  <span>{time}</span>
                  <span className="text-[11px]">{occ ? 'ocupado' : 'livre'}</span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => setShowAgendarFechamento(false)} className="bg-transparent border-none text-text-muted text-[12.5px] font-semibold mt-2.5 p-0">
            Cancelar
          </button>
        </div>
      )}

      <div className="flex gap-3.5 flex-wrap mb-4.5 no-print text-[12.5px] font-semibold">
        <a href={googleCalendarUrl(appt)} target="_blank" rel="noreferrer">
          📅 Adicionar ao Google Agenda
        </a>
        <button type="button" onClick={() => window.print()} className="bg-transparent border-none p-0 text-navy">
          📄 Baixar PDF
        </button>
        <button type="button" onClick={() => setEditingAnamnese((v) => !v)} className="bg-transparent border-none p-0 text-navy">
          ✏️ {editingAnamnese ? 'Cancelar edição' : 'Editar anamnese'}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Excluir este agendamento? Essa ação não pode ser desfeita.')) {
                deleteAppointment(appt.id)
                onClose()
              }
            }}
            className="bg-transparent border-none p-0 text-red"
          >
            🗑️ Excluir agendamento
          </button>
        )}
      </div>

      {appt.status === 'agendado' && !remarcarActive && (
        <div className="bg-bg rounded-xl p-4 mb-4.5 no-print">
          <div className="text-[12.5px] font-bold text-text-muted mb-2.5">CONFIRMAÇÃO DO COMPROMISSO</div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setStatus('compareceu')} className="bg-green text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold">
              Compareceu
            </button>
            <button type="button" onClick={() => setStatus('faltou_sem_avisar')} className="bg-red text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold">
              Faltou sem avisar
            </button>
            <button type="button" onClick={() => setStatus('avisou_nao_ira')} className="bg-yellow text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold">
              Avisou que não iria
            </button>
            <button type="button" onClick={() => setRemarcarActive(true)} className="bg-text-muted text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold">
              Remarcar
            </button>
          </div>
        </div>
      )}

      {remarcarActive && (
        <div className="bg-bg rounded-xl p-4 mb-4.5 no-print">
          <div className="text-[12.5px] font-bold text-text-muted mb-2.5">ESCOLHA UM NOVO DIA</div>
          <div className="flex gap-1.5 mb-3.5 flex-wrap">
            {days7.map((ds) => {
              const dt = new Date(ds + 'T00:00:00')
              const active = activeRemarcarDate === ds
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setRemarcarDate(ds)}
                  className="rounded-lg py-1.5 px-2.5 text-center border min-w-[46px]"
                  style={{ borderColor: active ? '#0B2D5B' : '#D8D5CD', background: active ? '#0B2D5B' : '#fff', color: active ? '#fff' : '#1A1D23' }}
                >
                  <div className="text-[9.5px]">{WEEKDAYS[dt.getDay()]}</div>
                  <div className="text-sm font-bold">{dt.getDate()}</div>
                </button>
              )
            })}
          </div>
          <div className="text-[12.5px] font-bold text-text-muted mb-2">HORÁRIOS — {dateLabel(activeRemarcarDate)}</div>
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
            {Array.from({ length: 10 }, (_, i) => i + 8).map((h) => {
              const time = `${String(h).padStart(2, '0')}:00`
              const occ = isOccupied(appointments, appt.consultant_id, activeRemarcarDate, h, appt.id)
              return (
                <button
                  key={time}
                  type="button"
                  disabled={occ}
                  onClick={() => confirmRemarcar(time)}
                  className="flex justify-between border border-border rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: occ ? '#F6F5F2' : '#fff', color: occ ? '#B0B4BC' : '#1A1D23' }}
                >
                  <span>{time}</span>
                  <span className="text-[11px]">{occ ? 'ocupado' : 'livre'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showFecharApolicePrompt && (
        <div className="bg-bg rounded-xl p-4 mb-4.5 no-print">
          <div className="text-[13px] font-semibold mb-2.5">Fechou a apólice?</div>
          <div className="text-xs text-text-muted mb-1.5">Produto</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {METLIFE_PRODUCT_LABELS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedProduct(p)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold border"
                style={{
                  borderColor: selectedProduct === p ? '#0B2D5B' : '#D8D5CD',
                  background: selectedProduct === p ? '#0B2D5B' : '#fff',
                  color: selectedProduct === p ? '#fff' : '#1A1D23',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              value={premiumInput}
              onChange={(e) => setPremiumInput(formatCurrencyTyped(e.target.value))}
              placeholder="Valor do prêmio mensal (R$)"
              className="border border-[#D8D5CD] rounded-lg px-3 py-2 text-[13px] flex-1 min-w-[180px]"
            />
            <button type="button" onClick={confirmPolicyClosed} className="bg-green text-white border-none rounded-lg px-3.5 py-2 text-[12.5px] font-semibold">
              Confirmar fechamento
            </button>
          </div>
        </div>
      )}

      {showMarkDeliveredButton && (
        <button
          type="button"
          onClick={() => updateAppointment(appt.id, { policy_delivered: true })}
          className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold w-full mb-4.5 no-print"
        >
          Marcar apólice como entregue
        </button>
      )}

      {showAgendarEntregaButton && (
        <button
          type="button"
          onClick={() => setShowAgendarEntrega(true)}
          className="bg-[#1E7A8C] text-white border-none rounded-lg px-3.5 py-2.5 text-[13px] font-bold mb-4 no-print"
        >
          📦 Agendar entrega de apólice
        </button>
      )}
      {linkedEntrega && (
        <div className="bg-[#E3F1F4] text-[#1E7A8C] rounded-lg px-3.5 py-2.5 text-[13px] font-bold mb-4">
          📦 Entrega agendada para {dateLabel(linkedEntrega.date)} às {linkedEntrega.time}
        </div>
      )}

      {showAgendarEntrega && (
        <div className="bg-bg rounded-xl p-4 mb-4.5 no-print">
          <div className="text-[12.5px] font-bold text-text-muted mb-2.5">
            AGENDAR ENTREGA — o fechamento de {dateLabel(appt.date)} continua no calendário
          </div>
          <div className="flex gap-1.5 mb-3.5 flex-wrap">
            {days10.map((ds) => {
              const dt = new Date(ds + 'T00:00:00')
              const active = activeEntregaDate === ds
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setEntregaDate(ds)}
                  className="rounded-lg py-1.5 px-2.5 text-center border min-w-[46px]"
                  style={{ borderColor: active ? '#0B2D5B' : '#D8D5CD', background: active ? '#0B2D5B' : '#fff', color: active ? '#fff' : '#1A1D23' }}
                >
                  <div className="text-[9.5px]">{WEEKDAYS[dt.getDay()]}</div>
                  <div className="text-sm font-bold">{dt.getDate()}</div>
                </button>
              )
            })}
          </div>
          <div className="text-[12.5px] font-bold text-text-muted mb-2">HORÁRIOS — {dateLabel(activeEntregaDate)}</div>
          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
            {Array.from({ length: 10 }, (_, i) => i + 8).map((h) => {
              const time = `${String(h).padStart(2, '0')}:00`
              const occ = isOccupied(appointments, appt.consultant_id, activeEntregaDate, h)
              return (
                <button
                  key={time}
                  type="button"
                  disabled={occ}
                  onClick={() => confirmAgendarEntrega(time)}
                  className="flex justify-between border border-border rounded-lg px-3 py-2 text-[12.5px] font-semibold"
                  style={{ background: occ ? '#F6F5F2' : '#fff', color: occ ? '#B0B4BC' : '#1A1D23' }}
                >
                  <span>{time}</span>
                  <span className="text-[11px]">{occ ? 'ocupado' : 'livre'}</span>
                </button>
              )
            })}
          </div>
          <button type="button" onClick={() => setShowAgendarEntrega(false)} className="bg-transparent border-none text-text-muted text-[12.5px] font-semibold mt-2.5 p-0">
            Cancelar
          </button>
        </div>
      )}

      <div>
        <div className="text-[12.5px] font-bold text-text-muted tracking-wide mb-2.5">
          ANAMNESE — todas as informações coletadas na abordagem
        </div>
        {!editingAnamnese ? (
          <div className="flex flex-col gap-4.5">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="font-heading font-bold text-[13px] text-navy tracking-wide pb-2 mb-2.5 border-b-2 border-navy">
                  {sec.title.toUpperCase()}
                </div>
                <div className="flex flex-col gap-2.5">
                  {sec.items.map((it) => (
                    <div key={it.label} className="flex justify-between text-[13px] border-b border-[#F0EEE8] pb-2 gap-3">
                      <span className="text-text-muted">{it.label}</span>
                      <span className="font-semibold text-right">{it.value}</span>
                    </div>
                  ))}
                </div>
                {sec.groups.map((g) => (
                  <div key={g.title} className="mt-3 pl-3 border-l-2 border-[#E5E2D9]">
                    <div className="text-[11.5px] font-bold text-text-muted tracking-wide mb-1.5">
                      {g.title.toUpperCase()}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {g.items.map((it) => (
                        <div key={it.label} className="flex justify-between text-[13px] border-b border-[#F0EEE8] pb-2 gap-3">
                          <span className="text-text-muted">{it.label}</span>
                          <span className="font-semibold text-right">{it.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {sections.length === 0 && (
              <div className="text-[12.5px] text-text-faint">Nenhuma informação de anamnese registrada ainda.</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4.5">
            <AnamneseForm draft={draft} onChange={setDraft} />
            <button type="button" onClick={saveAnamnese} className="bg-navy text-white border-none rounded-lg py-2.5 text-[13px] font-bold">
              Salvar anamnese
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
