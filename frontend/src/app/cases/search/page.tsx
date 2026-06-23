"use client";

import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Upload, FileText, ExternalLink, ChevronDown, ChevronUp, Sparkles, Filter, X, BookOpen } from "lucide-react";
import { aiApi } from "@/lib/api";

interface CaseResult {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  summary: string;
  key_points: string;
  decision: string;
  relevance_score: number;
  url: string;
  practice_areas: string[];
}

interface SearchResponse {
  query: string;
  total: number;
  results: CaseResult[];
  ai_summary: string;
}

interface CaseSearchResult {
  answer: string;
  excerpts: string[];
}

const PRACTICE_AREAS = [
  "Criminal Law", "Family Law", "Property Law", "Contract Law",
  "Consumer Protection", "Labour Law", "Constitutional Law",
  "Taxation", "Corporate Law", "Banking Law",
];

export default function CaseSearchPage() {
  const [query, setQuery] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [inCaseQuery, setInCaseQuery] = useState("");
  const [inCaseResult, setInCaseResult] = useState<Record<string, CaseSearchResult>>({});
  const [inCaseLoading, setInCaseLoading] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexMsg, setIndexMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const params = new URLSearchParams({ q: query, k: "10" });
      if (practiceArea) params.set("practice_area", practiceArea);
      if (yearFrom) params.set("year_from", yearFrom);
      if (yearTo) params.set("year_to", yearTo);
      const { data } = await aiApi.get(`/cases/search?${params}`);
      setResults(data);
    } catch {
      setResults({ query, total: 0, results: [], ai_summary: "Search failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleInCaseSearch = async (caseId: string) => {
    if (!inCaseQuery.trim()) return;
    setInCaseLoading(caseId);
    try {
      const { data } = await aiApi.post(`/cases/${caseId}/search`, { query: inCaseQuery });
      setInCaseResult(prev => ({ ...prev, [caseId]: data }));
    } catch {
      setInCaseResult(prev => ({ ...prev, [caseId]: { answer: "Search failed.", excerpts: [] } }));
    } finally {
      setInCaseLoading(null);
    }
  };

  const handleIndexQuery = async () => {
    if (!query.trim()) return;
    setIndexing(true);
    setIndexMsg("");
    try {
      const { data } = await aiApi.post("/cases/index/url", { queries: [query], cases_per_query: 5 });
      setIndexMsg(`Indexed ${data.indexed} cases from Indian Kanoon. Total: ${data.total}`);
    } catch {
      setIndexMsg("Failed to index cases.");
    } finally {
      setIndexing(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIndexing(true);
    setIndexMsg("");
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await aiApi.post("/cases/index/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIndexMsg(`Indexed: "${data.title}" (ID: ${data.case_id})`);
    } catch {
      setIndexMsg("PDF upload failed.");
    } finally {
      setIndexing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppLayout title="Case Search" subtitle="RAG-powered semantic search over Indian judgments">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Search bar */}
        <div className="vk-card p-5">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input
                  className="vk-input pl-9 w-full"
                  placeholder="e.g. wrongful termination without notice period, Section 138 NI Act..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary px-5" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                className="btn-secondary px-3"
                onClick={() => setShowFilters(f => !f)}
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <select className="vk-input" value={practiceArea} onChange={e => setPracticeArea(e.target.value)}>
                  <option value="">All Practice Areas</option>
                  {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input className="vk-input" type="number" placeholder="Year from" value={yearFrom} onChange={e => setYearFrom(e.target.value)} />
                <input className="vk-input" type="number" placeholder="Year to" value={yearTo} onChange={e => setYearTo(e.target.value)} />
              </div>
            )}
          </form>

          {/* Index actions */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: "var(--vk-border)" }}>
            <span className="text-xs text-dim">Add cases to index:</span>
            <button
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              onClick={handleIndexQuery}
              disabled={indexing || !query.trim()}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {indexing ? "Indexing..." : "Fetch from Indian Kanoon"}
            </button>
            <button
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={indexing}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PDF
            </button>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            {indexMsg && <span className="text-xs text-green-400">{indexMsg}</span>}
          </div>
        </div>

        {/* AI Summary */}
        {results && (
          <div className="vk-disclaimer rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--vk-gold)" }} />
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--vk-gold)" }}>
                  AI Summary — {results.total} cases found for &ldquo;{results.query}&rdquo;
                </p>
                <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{results.ai_summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results?.results.map(c => (
          <div key={c.id} className="vk-card p-5 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-snug" style={{ color: "var(--vk-text)" }}>{c.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {c.citation && <span className="vk-badge vk-badge-gold text-[10px]">{c.citation}</span>}
                  {c.court && <span className="vk-badge vk-badge-blue text-[10px]">{c.court}</span>}
                  {c.year > 0 && <span className="vk-badge vk-badge-muted text-[10px]">{c.year}</span>}
                  {c.practice_areas?.map(a => (
                    <span key={a} className="vk-badge vk-badge-muted text-[10px]">{a}</span>
                  ))}
                  <span className="text-[10px] text-dim">
                    Relevance: {Math.round(c.relevance_score * 100)}%
                  </span>
                </div>
              </div>
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 rounded hover:bg-white/10 text-dim">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Summary */}
            {c.summary && <p className="text-xs text-dim leading-relaxed">{c.summary}</p>}

            {/* Key Points */}
            {c.key_points && (
              <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="font-semibold text-[11px] mb-1" style={{ color: "var(--vk-gold)" }}>Key Legal Points</p>
                {c.key_points.split("\n").filter(Boolean).map((pt, i) => (
                  <p key={i} className="text-dim">{pt}</p>
                ))}
              </div>
            )}

            {/* Decision */}
            {c.decision && (
              <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-green-400 mt-0.5 shrink-0">Decision</span>
                <p className="text-xs text-green-300">{c.decision}</p>
              </div>
            )}

            {/* Expand for full case + AI search */}
            <button
              className="flex items-center gap-1.5 text-xs text-dim hover:text-white transition-colors"
              onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
            >
              {expandedCase === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expandedCase === c.id ? "Collapse" : "Show full case + AI search"}
            </button>

            {expandedCase === c.id && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--vk-border)" }}>
                {/* AI search within case */}
                <div className="flex gap-2">
                  <input
                    className="vk-input flex-1 text-xs"
                    placeholder="Search within this case... e.g. 'what did court say about burden of proof'"
                    value={inCaseQuery}
                    onChange={e => setInCaseQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleInCaseSearch(c.id)}
                  />
                  <button
                    className="btn-secondary text-xs px-3"
                    onClick={() => handleInCaseSearch(c.id)}
                    disabled={inCaseLoading === c.id}
                  >
                    {inCaseLoading === c.id ? "Searching..." : "Ask AI"}
                  </button>
                </div>

                {inCaseResult[c.id] && (
                  <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--vk-gold)" }}>AI Answer</p>
                    <p className="text-xs text-dim leading-relaxed">{inCaseResult[c.id].answer}</p>
                    {inCaseResult[c.id].excerpts?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <p className="text-[10px] font-semibold text-dim uppercase tracking-wide">Relevant Excerpts</p>
                        {inCaseResult[c.id].excerpts.map((ex, i) => (
                          <p key={i} className="text-[11px] text-dim italic border-l-2 pl-2" style={{ borderColor: "var(--vk-gold)" }}>
                            &ldquo;{ex}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {results && results.total === 0 && (
          <div className="vk-card p-10 text-center text-dim">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No cases found</p>
            <p className="text-sm mt-1">Try fetching cases from Indian Kanoon first using the button above.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
