import { buildAnamneseBlocks, has } from '../../lib/anamnese'
import { formatCurrencyTyped, formatDateTyped } from '../../lib/format'
import type { Anamnese } from '../../lib/types'
import { Chip } from '../ui/Chip'

export function AnamneseForm({
  draft,
  onChange,
}: {
  draft: Anamnese
  onChange: (next: Anamnese) => void
}) {
  const blocks = buildAnamneseBlocks(draft)

  function setText(key: string, value: string) {
    onChange({ ...draft, [key]: value })
  }
  function toggleMulti(key: string, val: string) {
    const arr = Array.isArray(draft[key]) ? (draft[key] as string[]) : []
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
    onChange({ ...draft, [key]: next })
  }
  function setRadio(key: string, val: string) {
    onChange({ ...draft, [key]: [val] })
  }

  return (
    <div className="flex flex-col gap-[18px] border-t border-border pt-4">
      {blocks.map((block, bi) => (
        <div key={bi}>
          {block.sectionLabel && (
            <div className="font-heading font-bold text-[13px] text-navy tracking-wide pb-2 mb-3 border-b-2 border-navy">
              {block.sectionLabel.toUpperCase()}
            </div>
          )}
          <div className="text-[11.5px] font-bold text-text-muted tracking-wide mb-2.5">
            {block.title.toUpperCase()}
          </div>
          <div className="flex flex-col gap-3.5">
            {block.items.map((item) => {
              if (item.kind === 'text') {
                const raw = (draft[item.key] as string) || ''
                return (
                  <label key={item.key} className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-muted">{item.label}</span>
                    <input
                      value={raw}
                      onChange={(e) => {
                        const v = e.target.value
                        if (item.format === 'date') setText(item.key, formatDateTyped(v))
                        else if (item.format === 'currency') setText(item.key, formatCurrencyTyped(v))
                        else setText(item.key, v)
                      }}
                      className="border border-[#D8D5CD] rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-navy"
                    />
                  </label>
                )
              }
              return (
                <div key={item.key}>
                  <div className="text-xs text-text-muted mb-1.5">{item.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.options.map((opt) => (
                      <Chip
                        key={opt}
                        label={opt}
                        active={has(draft, item.key, opt)}
                        onClick={() =>
                          item.multi ? toggleMulti(item.key, opt) : setRadio(item.key, opt)
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
