import type { Citation } from "@/types";
import { ExternalLink } from "lucide-react";

interface CitationChipProps {
  citation: Citation;
  index: number;
}

export function CitationChip({ citation, index }: CitationChipProps) {
  return (
    <a
      href={citation.url ?? "#"}
      target={citation.url ? "_blank" : undefined}
      rel="noreferrer"
      className="vk-cite"
      title={citation.title}
    >
      <span>[{index + 1}]</span>
      <span className="max-w-[180px] truncate">
        {citation.court ? `${citation.court} ${citation.year ?? ""}` : citation.title}
      </span>
      {citation.url && <ExternalLink className="w-2.5 h-2.5 shrink-0" />}
    </a>
  );
}
