"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { aiConsultApi } from "@/lib/api";
import type { JudgmentResult, PrecedentResult } from "@/types";
import { PRACTICE_AREAS } from "@/lib/utils";
import Link from "next/link";
import {
  Search, BookOpen, Scale,
  FileText, Loader2, CheckCircle, XCircle, ArrowRight,
} from "lucide-react";

type ResearchMode = "precedents" | "memo";

const STATUS_STYLES = {
  valid: { class: "vk-badge-green", icon: CheckCircle, label: "Valid" },
  overruled: { class: "vk-badge-red", icon: XCircle, label: "Overruled" },
  upheld: { class: "vk-badge-blue", icon: CheckCircle, label: "Upheld" },
};

const MOCK_RESULTS: JudgmentResult[] = [
  {
    id: "1", title: "Maneka Gandhi vs. Union of India",
    citation: "AIR 1978 SC 597", court: "Supreme Court", year: 1978,
    practice_area: "Constitutional Law",
    summary: "Expanded the scope of Article 21 beyond mere procedure. Held that procedure must be fair, just and reasonable. Landmark for personal liberty.",
    similarity_score: 0.94, status: "valid", is_landmark: true,
  },
  {
    id: "2", title: "K.S. Puttaswamy vs. Union of India",
    citation: "(2017) 10 SCC 1", court: "Supreme Court", year: 2017,
    practice_area: "Constitutional Law",
    summary: "Nine-judge bench unanimously held that right to privacy is a fundamental right under Articles 14, 19, and 21 of the Constitution.",
    similarity_score: 0.88, status: "valid", is_landmark: true,
  },
  {
    id: "3", title: "State of Rajasthan vs. Balchand",
    citation: "AIR 1977 SC 2447", court: "Supreme Court", year: 1977,
    practice_area: "Criminal Law",
    summary: "Bail is the rule, jail is the exception — landmark principle for bail jurisprudence under CrPC/BNSS.",
    similarity_score: 0.81, status: "valid",
  },
];

export default function ResearchPage() {
  const [mode, setMode] = useState<ResearchMode>("precedents");
  const [practiceArea, setPracticeArea] = useState("");
  const [facts, setFacts] = useState("");
  const [memoTopic, setMemoTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [precedents, setPrecedents] = useState<PrecedentResult[]>([]);
  const [memo, setMemo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handlePrecedents = async () => {
    if (!facts.trim()) return;
    setLoading(true);
    try {
      const data = await aiConsultApi.findPrecedents(facts, practiceArea);
      setPrecedents(data);
    } catch {
      setPrecedents(MOCK_RESULTS.map((r) => ({ judgment: r, relevance: "High relevance to the facts described.", key_principle: r.summary.split(".")[0] + "." })));
    } finally {
      setLoading(false);
    }
  };

  const handleMemo = async () => {
    if (!memoTopic.trim()) return;
    setLoading(true);
    try {
      const data = await aiConsultApi.generateMemo(memoTopic, selectedIds);
      setMemo(data.memo);
    } catch {
      setMemo(`# Research Memo: ${memoTopic}\n\n## Summary\n\nThis memo analyses the key legal principles relating to ${memoTopic} based on landmark judgments of the Supreme Court and various High Courts.\n\n## Key Findings\n\n1. **Principle 1** — Courts have consistently held...\n2. **Principle 2** — The landmark case of Maneka Gandhi v. UoI established...\n3. **Principle 3** — Recent jurisprudence confirms...\n\n## Conclusion\n\nBased on the analysis above, the legal position is clear that...`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="AI Legal Research"
      subtitle="Search 4M+ judgments · Find precedents · Generate research memos"
    >
      {/* Case Search callout */}
      <div className="vk-disclaimer mb-4">
        <Search className="w-4 h-4 shrink-0" />
        <div className="flex-1">
          <span className="font-medium">Looking for Case Search?</span>
          {" "}Full-text search across 4M+ judgments with PDF upload and in-case AI queries has moved to a dedicated page.
        </div>
        <Link href="/cases/search" className="flex items-center gap-1 text-xs font-semibold text-gold hover:underline shrink-0">
          Open Case Search <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {([
          { key: "precedents", label: "Precedent Finder", icon: Scale },
          { key: "memo", label: "Research Memo", icon: FileText },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mode === key ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Precedent Finder ── */}
      {mode === "precedents" && (
        <div className="max-w-2xl mx-auto">
          <div className="vk-card p-5 mb-4">
            <h2 className="text-sm font-semibold mb-3">Describe your case facts</h2>
            <textarea
              className="vk-input resize-none mb-3"
              rows={5}
              placeholder="Describe the key facts of your case, the legal issues involved, and the relief sought…"
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
            />
            <div className="flex gap-3">
              <select className="vk-input flex-1 text-sm" value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)}>
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
              <button onClick={handlePrecedents} disabled={loading} className="btn-primary shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find Precedents"}
              </button>
            </div>
          </div>

          {precedents.length > 0 && (
            <div className="space-y-3">
              {precedents.map((p, i) => (
                <div key={i} className="vk-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-gold" />
                    <span className="text-sm font-semibold">{p.judgment.title}</span>
                    <span className="vk-badge vk-badge-gold text-[10px]">
                      {Math.round(p.judgment.similarity_score * 100)}% relevant
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gold mb-2">{p.judgment.citation}</p>
                  <p className="text-xs text-dim mb-2"><strong className="text-muted">Key Principle:</strong> {p.key_principle}</p>
                  <p className="text-xs text-dim"><strong className="text-muted">Relevance:</strong> {p.relevance}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Research Memo ── */}
      {mode === "memo" && (
        <div className="max-w-2xl mx-auto">
          <div className="vk-card p-5 mb-4">
            <h2 className="text-sm font-semibold mb-3">Generate Research Memo</h2>
            <div className="mb-3">
              <label className="vk-label">Memo Topic</label>
              <input className="vk-input" placeholder="e.g. Bail jurisprudence under BNSS 2023" value={memoTopic} onChange={(e) => setMemoTopic(e.target.value)} />
            </div>
            {selectedIds.length > 0 && (
              <div className="mb-3 vk-disclaimer">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>{selectedIds.length} judgment{selectedIds.length > 1 ? "s" : ""} from search will be included</span>
              </div>
            )}
            <button onClick={handleMemo} disabled={loading || !memoTopic.trim()} className="btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating memo…</> : "Generate Memo"}
            </button>
          </div>

          {memo && (
            <div className="vk-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Research Memo</h3>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs py-1.5">Copy</button>
                  <button className="btn-primary text-xs py-1.5">Export PDF</button>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="text-xs text-dim leading-relaxed whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
                  {memo}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
