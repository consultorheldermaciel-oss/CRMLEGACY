import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { resolveViewScope } from '../lib/viewScope'
import { formatCurrencyTyped, parseCurrency, toTitleCase } from '../lib/format'
import type { Anamnese, Appointment, Client, Policy, PolicyStatus } from '../lib/types'
import { METLIFE_PRODUCT_LABELS } from '../lib/metlifeContract'
import { buildAnamneseSections } from '../lib/anamnese'
import { Modal, ModalHeader } from '../components/ui/Modal'
import { AnamneseForm } from '../components/modals/AnamneseForm'
import { AnamneseSectionsView } from '../components/AnamneseSectionsView'

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

function clientKey(consultantId: string, name: string) {
  return `${consultantId}::${name.trim().toLowerCase()}`
}

export function CarteiraPage() {
  const { profile } = useAuth()
  const { consultants, clients, policies, appointments, removeClient } = useCrm()
  const { viewingId } = useUi()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)

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

  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div className="font-heading font-bold text-[17px]">Carteira de Clientes</div>
        {canAddClient && (
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

      <div className="flex flex-col gap-2.5">
        {scopedClients.map((client) => {
          const clientPolicies = policies.filter((p) => p.client_id === client.id)
          const consultant = consultants.find((c) => c.id === client.consultant_id)
          const expanded = expandedId === client.id
          return (
            <div key={client.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : client.id)}
                  className="bg-transparent border-none text-left flex-1 min-w-0"
                >
                  <div className="text-[14px] font-semibold">{client.name}</div>
                  <div className="text-[11.5px] text-text-faint">
                    {[client.phone, client.birth_date ? dateBr(client.birth_date) : null, isGestorView ? consultant?.name : null]
                      .filter(Boolean)
                      .join(' · ')}
                    {clientPolicies.length > 0 && ` · ${clientPolicies.length} apólice${clientPolicies.length > 1 ? 's' : ''}`}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : client.id)} className="bg-transparent border-none text-[15px] p-1">
                    {expanded ? '▲' : '▼'}
                  </button>
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
              </div>

              {expanded && (
                <div className="mt-3.5 pt-3.5 border-t border-border">
                  {client.notes && <div className="text-[12.5px] text-text-muted mb-3">{client.notes}</div>}
                  <PolicyList clientId={client.id} consultantId={client.consultant_id} policies={clientPolicies} />
                  <ClientAnamneseSection client={client} />
                </div>
              )}
            </div>
          )
        })}
        {scopedClients.length === 0 && canAddClient && (
          <div className="text-[12.5px] text-text-faint">Nenhum cliente cadastrado ainda.</div>
        )}
      </div>

      {virtualClients.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="font-heading font-bold text-[14px] text-text-muted mt-2">
            Clientes de agendamentos (ainda não estão na carteira)
          </div>
          {virtualClients.map((v) => (
            <VirtualClientRow
              key={clientKey(v.consultantId, v.name)}
              virtualClient={v}
              isGestorView={isGestorView}
              consultantName={consultants.find((c) => c.id === v.consultantId)?.name}
            />
          ))}
        </div>
      )}

      {newClientOpen && <NewClientModal consultantId={viewingId} onClose={() => setNewClientOpen(false)} />}
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
}: {
  virtualClient: { consultantId: string; name: string; appts: Appointment[] }
  isGestorView: boolean
  consultantName: string | undefined
}) {
  const { createClient, updateClient } = useCrm()
  const [promoting, setPromoting] = useState(false)
  const [promoted, setPromoted] = useState(false)

  const sorted = [...virtualClient.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const last = sorted[sorted.length - 1]
  const sourceAnamnese = [...sorted].reverse().find((a) => a.anamnese && Object.keys(a.anamnese).length > 0)?.anamnese

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
    setPromoting(false)
    setPromoted(true)
  }

  if (promoted) return null

  return (
    <div className="bg-card border border-dashed border-border rounded-2xl p-4 flex items-center justify-between gap-2.5 flex-wrap">
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
      <button
        type="button"
        disabled={promoting}
        onClick={handlePromote}
        className="bg-bg border border-[#D8D5CD] rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60"
      >
        {promoting ? 'Adicionando…' : '📥 Adicionar à carteira'}
      </button>
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

function PolicyList({ clientId, consultantId, policies }: { clientId: string; consultantId: string; policies: Policy[] }) {
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
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 border border-border rounded-[10px] px-3 py-2.5 flex-wrap">
              <div>
                <div className="text-[13px] font-semibold">{p.product}</div>
                <div className="text-[11px] text-text-faint">
                  {[p.policy_number ? `nº ${p.policy_number}` : null, p.premium ? `R$ ${p.premium.toLocaleString('pt-BR')}` : null, p.issued_date ? dateBr(p.issued_date) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
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
