import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { MusicCredit } from "../../types";

/** A song's licence and a credit line to copy when sharing the film. */
export function CreditLine({ credit }: { credit: MusicCredit }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credit.attribution);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text stays selectable */
    }
  };
  return (
    <div className="rounded-[3px] border border-line bg-surface px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Credit · {credit.license}</span>
        <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          {credit.provider} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="mt-1.5 select-all text-xs leading-relaxed text-fg/85">{credit.attribution}</p>
      <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy credit"}
      </button>
    </div>
  );
}
