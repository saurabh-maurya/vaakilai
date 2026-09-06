"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeftRight, Search, BookOpen, AlertCircle, Sparkles, ChevronDown, ExternalLink, Send } from "lucide-react";
import { backendApi, aiConsultApi } from "@/lib/api";
import { Markdown } from "@/components/Markdown";
import { AiThinking } from "@/components/AiThinking";

interface BNSEntry {
  ipc_section: string;
  bns_section: string;
  title: string;
  category: string;
  notes: string;
  effective_from: string;
}

interface SearchResult {
  results: BNSEntry[];
  total: number;
  query: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Homicide":           "#f87171",
  "Hurt":               "#fb923c",
  "Sexual Offences":    "#a78bfa",
  "Kidnapping":         "#fbbf24",
  "Theft":              "#60a5fa",
  "Cheating":           "#4ade80",
  "Forgery":            "#34d399",
  "Public Tranquillity":"#f472b6",
  "Criminal Breach":    "#c084fc",
  "Defamation":         "#94a3b8",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "var(--vk-gold)";
}

// Official government full-act sources (verified reachable). India Code serves
// its per-section pages via an unscrapeable SPA, so we link the authoritative
// bare-act PDFs and layer AI explanation + Q&A on top.
const IPC_OFFICIAL_PDF = "https://www.indiacode.nic.in/bitstream/123456789/15289/1/ipc_act.pdf";
const BNS_OFFICIAL_PDF = "https://www.mha.gov.in/sites/default/files/250883_english_01042024.pdf";

function EntryCard({ entry }: { entry: BNSEntry }) {
  const color = getCategoryColor(entry.category);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [qa, setQa] = useState<{ q: string; a: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const context =
    `IPC Section ${entry.ipc_section} ("${entry.title}"), its Bharatiya Nyaya Sanhita 2023 ` +
    `equivalent BNS Section ${entry.bns_section}, category ${entry.category}` +
    `${entry.notes ? `. Note: ${entry.notes}` : ""}`;

  const toggleDetail = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (detail) return; // already fetched
    setLoadingDetail(true);
    try {
      const prompt =
        `Explain ${context}. Cover: (1) what the provision states, (2) essential ingredients, ` +
        `(3) punishment/sentence, (4) key differences between the IPC and BNS versions, and ` +
        `(5) a short practical example. Use clear headings and keep it concise.`;
      const data = await aiConsultApi.consult(prompt, "Criminal Law");
      setDetail(data.answer || "No additional details available.");
    } catch {
      setDetail("Couldn't fetch an explanation right now — the AI service may be waking up. Please try again in a moment.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const askQuestion = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setQuestion("");
    setAsking(true);
    setQa((prev) => [...prev, { q, a: "" }]);
    try {
      const prompt = `Regarding ${context}\n\nQuestion: ${q}\n\nAnswer clearly and concisely, grounded in Indian criminal law.`;
      const data = await aiConsultApi.consult(prompt, "Criminal Law");
      const answer = data.answer || "No answer available.";
      setQa((prev) => prev.map((item, i) => (i === prev.length - 1 ? { ...item, a: answer } : item)));
    } catch {
      setQa((prev) => prev.map((item, i) => (i === prev.length - 1 ? { ...item, a: "Couldn't answer right now. Please try again in a moment." } : item)));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="vk-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--vk-gold)" }}>IPC</p>
            <p className="text-sm font-bold" style={{ color: "var(--vk-text)" }}>§ {entry.ipc_section}</p>
          </div>
          <ArrowLeftRight className="w-4 h-4 text-dim shrink-0" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#4ade80" }}>BNS 2023</p>
            <p className="text-sm font-bold" style={{ color: "#4ade80" }}>§ {entry.bns_section}</p>
          </div>
        </div>
        <span
          className="vk-badge text-[10px] shrink-0"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {entry.category}
        </span>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>{entry.title}</p>
      {entry.notes && (
        <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>{entry.notes}</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-dim">Effective: {entry.effective_from}</p>
        <button
          onClick={toggleDetail}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: "var(--vk-gold)" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {open ? "Hide details" : "More detail"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="mt-2 pt-3 space-y-4" style={{ borderTop: "1px solid var(--vk-border)" }}>
          {/* Official government sources */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dim">Official Sources</p>
            <a href={IPC_OFFICIAL_PDF} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--vk-gold)" }}>
              <ExternalLink className="w-3 h-3 shrink-0" />
              IPC § {entry.ipc_section} — Indian Penal Code (India Code, Govt. of India · full-act PDF)
            </a>
            <a href={BNS_OFFICIAL_PDF} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "#4ade80" }}>
              <ExternalLink className="w-3 h-3 shrink-0" />
              BNS § {entry.bns_section} — Bharatiya Nyaya Sanhita 2023 (MHA · official PDF)
            </a>
          </div>

          {/* AI explanation */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dim mb-1.5">
              AI Explanation <span className="normal-case font-normal">(unofficial — verify against the official text above)</span>
            </p>
            {loadingDetail ? (
              <AiThinking />
            ) : (
              <div className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                <Markdown>{detail}</Markdown>
              </div>
            )}
          </div>

          {/* Q&A on top of the section */}
          {qa.length > 0 && (
            <div className="space-y-3">
              {qa.map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--vk-text)" }}>Q: {item.q}</p>
                  {item.a ? (
                    <div className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                      <Markdown>{item.a}</Markdown>
                    </div>
                  ) : (
                    <AiThinking />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Ask a question */}
          <div className="flex gap-2">
            <input
              className="vk-input flex-1 text-sm"
              placeholder="Ask a question about this section…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
              disabled={asking}
            />
            <button
              onClick={askQuestion}
              disabled={asking || !question.trim()}
              className="btn-primary px-3 text-sm flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IPCBNSPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BNSEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const handleSearch = async (term?: string) => {
    const searchTerm = (term ?? query).trim();
    if (!searchTerm) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await backendApi.get<SearchResult>("/ipc-bns/search", { params: { q: searchTerm } });
      setResults(data.results);
      setTotalResults(data.total);
    } catch {
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const EXAMPLE_QUERIES = ["420", "302 murder", "498A cruelty", "cheating", "theft"];

  return (
    <AppLayout title="IPC → BNS Converter" subtitle="Convert Indian Penal Code sections to Bharatiya Nyaya Sanhita 2023 (effective 1 July 2024)">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Search */}
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
            <h3 className="font-semibold text-sm">Search IPC / BNS Section</h3>
            <span className="vk-badge vk-badge-muted text-[10px] ml-auto">Updated 1 July 2024</span>
          </div>

          <div className="flex gap-3">
            <input
              className="vk-input flex-1"
              placeholder="Enter IPC section number or keyword e.g. 420, murder, cheating..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="btn-primary px-5 flex items-center gap-2"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
            >
              <Search className="w-4 h-4" />
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <p className="text-xs text-dim">Try:</p>
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                className="vk-badge vk-badge-muted text-xs py-1 px-2.5 hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => { setQuery(q); handleSearch(q); }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Context card */}
        <div className="vk-card p-4 flex items-start gap-3" style={{ border: "1px solid rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)" }}>
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--vk-gold)" }} />
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--vk-gold)" }}>About BNS 2023</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
              The Bharatiya Nyaya Sanhita, 2023 replaced the Indian Penal Code, 1860 with effect from 1 July 2024.
              Section numbers have changed significantly. Use this tool to map old IPC sections to their BNS equivalents
              for updated pleadings, FIRs, and legal advice.
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-24 rounded-xl" />)}
          </div>
        )}

        {searched && !loading && (
          results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-dim">{totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;</p>
              {results.map((entry, i) => (
                <EntryCard key={`${entry.ipc_section}-${i}`} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="vk-card p-8 text-center space-y-2">
              <Search className="w-8 h-8 mx-auto text-dim" />
              <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>No results found</p>
              <p className="text-xs text-dim">Try a different section number or keyword</p>
            </div>
          )
        )}

        <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
          This mapping is for reference only. Always verify against the official Bharatiya Nyaya Sanhita, 2023 gazette notification. Some sections have been restructured, merged, or have modified ingredients.
        </div>
      </div>
    </AppLayout>
  );
}
