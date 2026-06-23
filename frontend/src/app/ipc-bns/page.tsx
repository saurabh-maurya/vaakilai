"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeftRight, Search, ChevronRight, BookOpen, AlertCircle } from "lucide-react";
import { backendApi } from "@/lib/api";

interface BNSEntry {
  ipc: string;
  bns: string;
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

function EntryCard({ entry }: { entry: BNSEntry }) {
  const color = getCategoryColor(entry.category);
  return (
    <div className="vk-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--vk-gold)" }}>IPC</p>
            <p className="text-sm font-bold" style={{ color: "var(--vk-text)" }}>§ {entry.ipc}</p>
          </div>
          <ArrowLeftRight className="w-4 h-4 text-dim shrink-0" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#4ade80" }}>BNS 2023</p>
            <p className="text-sm font-bold" style={{ color: "#4ade80" }}>§ {entry.bns}</p>
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
      <p className="text-[10px] text-dim">Effective: {entry.effective_from}</p>
    </div>
  );
}

export default function IPCBNSPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BNSEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await backendApi.get<SearchResult>("/ipc-bns/search", { params: { q: query } });
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
              onClick={handleSearch}
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
                onClick={() => { setQuery(q); }}
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
                <EntryCard key={`${entry.ipc}-${i}`} entry={entry} />
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
