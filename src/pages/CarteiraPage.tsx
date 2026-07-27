import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCrm } from '../context/CrmContext'
import { useUi } from '../context/UiContext'
import { resolveViewScope } from '../lib/viewScope'
import { formatCurrencyTyped, parseCurrency, toTitleCase } from '../lib/format'
import type { Policy, PolicyStatus } from '../lib/types'
import { METLIFE_PRODUCT_LABELS } from '../lib/metlifeContract'
import { Modal, ModalHeader } from '../components/ui/Modal'

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

export function CarteiraPage() {
  const { profile } = useAuth()
  const { consultants, clients, policies, removeClient } = useCrm()
  const { viewingId } = useUi()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)

  if (!profile) return null
  const { isGestorView, memberIds } = resolveViewScope(consultants, viewingId)
  const scopedClients = memberIds ? clients.filter((c) => memberIds.includes(c.consultant_id)) : clients
  const targetConsultant = consultants.find((c) => c.id === viewingId)
  const canAddClient = viewingId !== 'gestor' && (targetConsultant ? targetConsultant.role === 'consultor' : true)

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
                </div>
              )}
            </div>
          )
        })}
        {scopedClients.length === 0 && canAddClient && (
          <div className="text-[12.5px] text-text-faint">Nenhum cliente cadastrado ainda.</div>
        )}
      </div>

      {newClientOpen && <NewClientModal consultantId={viewingId} onClose={() => setNewClientOpen(false)} />}
    </div>
  )
}

function dateBr(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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
    setPremiumInput('')
    setPolicyNumber('')
    setIssuedDate('')
    setDocumentFile(null)
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
                      accept="application/pdf,image/*"
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
        <form onSubmit={handleAdd} className="flex flex-col gap-2.5 bg-bg rounded-xl p-3">
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
          <div className="flex gap-2 flex-wrap">
            <input
              value={premiumInput}
              onChange={(e) => setPremiumInput(formatCurrencyTyped(e.target.value))}
              placeholder="Prêmio mensal (R$)"
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px] flex-1 min-w-[130px]"
            />
            <input
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="Número da apólice (opcional)"
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px] flex-1 min-w-[130px]"
            />
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="border border-[#D8D5CD] rounded-lg px-2.5 py-2 text-[13px]"
            />
          </div>
          <label className="text-xs text-text-muted flex flex-col gap-1">
            Anexar apólice (PDF ou foto, opcional)
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              className="text-[12.5px]"
            />
          </label>
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
