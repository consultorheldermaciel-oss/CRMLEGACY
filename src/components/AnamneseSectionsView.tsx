import type { AnamneseSection } from '../lib/anamnese'

export function AnamneseSectionsView({ sections }: { sections: AnamneseSection[] }) {
  if (sections.length === 0) {
    return <div className="text-[12.5px] text-text-faint">Nenhuma informação de anamnese registrada ainda.</div>
  }
  return (
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
              <div className="text-[11.5px] font-bold text-text-muted tracking-wide mb-1.5">{g.title.toUpperCase()}</div>
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
    </div>
  )
}
