"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarChart2, Sparkles, AlertCircle, TrendingUp, Scale, BookOpen, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { aiApi } from "@/lib/api";

const COURTS = [
  "", "Supreme Court of India", "Delhi High Court", "Bombay High Court",
  "Madras High Court", "Calcutta High Court", "Allahabad High Court",
  "Karnataka High Court", "Gujarat High Court",
];

const PRACTICE_AREAS = [
  "", "Criminal Law", "Constitutional Law", "Civil Law", "Family Law",
  "Corporate Law", "Taxation", "Labour Law", "Property Law",
];

// Section title → display config
const SECTION_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  "grant rate":        { icon: TrendingUp,  color: "#4ade80" },
  "key tendencies":    { icon: BarChart2,   color: "#60a5fa" },
  "preferred":         { icon: BookOpen,    color: "var(--vk-gold)" },
  "notable":           { icon: Scale,       color: "#a78bfa" },
  "strategic":         { icon: Lightbulb,   color: "#fbbf24" },
  "disclaimer":        { icon: AlertCircle, color: "#94a3b8" },
};

function getSectionConfig(title: string) {
  const lower = title.toLowerCase();
  for (const [key, cfg] of Object.entries(SECTION_CONFIG)) {
    if (lower.includes(key)) return cfg;
  }
  return { icon: BarChart2, color: "var(--vk-gold)" };
}

/** Parse numbered-section raw_analysis into [{title, body}] */
function parseSections(text: string): { title: string; body: string }[] {
  const lines = text.split("\n");
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(\d+)\.\s+(.+?)[:.]?\s*$/);
    if (headingMatch) {
      if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      current = { title: headingMatch[2], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });

  // If no numbered sections found, return the raw text as a single section
  if (sections.length === 0 && text.trim()) {
    return [{ title: "Analysis", body: text.trim() }];
  }
  return sections;
}

function AnalysisSection({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(true);
  const { icon: Icon, color } = getSectionConfig(title);
  const bullets = body.split("\n").filter(l => l.trim().startsWith("-") || l.trim().startsWith("•") || l.trim().startsWith("*"));
  const prose = body.split("\n").filter(l => !l.trim().startsWith("-") && !l.trim().startsWith("•") && !l.trim().startsWith("*") && l.trim());

  return (
    <div className="vk-card overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
        <span className="flex-1 font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-dim" /> : <ChevronDown className="w-3.5 h-3.5 text-dim" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "var(--vk-border)" }}>
          {prose.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed pt-2" style={{ color: "var(--vk-text-muted)" }}>{p}</p>
          ))}
          {bullets.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: color }} />
                  <span className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                    {b.replace(/^[-•*]\s*/, "")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function JudgeAnalyticsPage() {
  const [form, setForm] = useState({ judge_name: "", court: "", practice_area: "", top_k: 20 });
  const [result, setResult] = useState<{ raw_analysis: string; cases_sampled: number; powered_by: string; court?: string; practice_area?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyse = async () => {
    if (!form.judge_name.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const { data } = await aiApi.post("/judge-analytics/judge", form);
      setResult(data);
    } catch {
      setError("Unable to analyse. Please ensure cases are indexed or try again.");
    } finally {
      setLoading(false);
    }
  };

  const sections = result?.raw_analysis ? parseSections(result.raw_analysis) : [];

  return (
    <AppLayout
      requirePro
      requiredFeature="judge_analytics"
      title="Judge Analytics"
      subtitle="Analyse judicial tendencies, grant rates, and preferred reasoning for any Indian judge"
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Input card */}
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
            <h3 className="font-semibold text-sm">Judge Details</h3>
            <span className="vk-badge vk-badge-gold text-[10px] ml-auto">AI Analytics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="vk-label">Judge Name *</label>
              <input
                className="vk-input w-full"
                placeholder="e.g. Justice D.Y. Chandrachud, Justice B.V. Nagarathna"
                value={form.judge_name}
                onChange={e => setForm(f => ({ ...f, judge_name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAnalyse()}
              />
            </div>
            <div>
              <label className="vk-label">Court (optional)</label>
              <select className="vk-input w-full" value={form.court} onChange={e => setForm(f => ({ ...f, court: e.target.value }))}>
                {COURTS.map(c => <option key={c} value={c}>{c || "All Courts"}</option>)}
              </select>
            </div>
            <div>
              <label className="vk-label">Practice Area (optional)</label>
              <select className="vk-input w-full" value={form.practice_area} onChange={e => setForm(f => ({ ...f, practice_area: e.target.value }))}>
                {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a || "All Areas"}</option>)}
              </select>
            </div>
          </div>

          <button
            className="btn-primary py-2.5 px-6 flex items-center gap-2"
            onClick={handleAnalyse}
            disabled={loading || !form.judge_name.trim()}
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Analysing…" : "Analyse Judge"}
          </button>
        </div>

        {/* Skeletons */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="vk-skeleton h-14 rounded-xl" />)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="vk-card p-4 flex items-center gap-2" style={{ border: "1px solid rgba(248,113,113,0.3)" }}>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Meta row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{form.judge_name}</p>
                {(form.court || form.practice_area) && (
                  <p className="text-xs text-dim">
                    {[form.court || "All Courts", form.practice_area || "All Areas"].join(" · ")}
                  </p>
                )}
              </div>
              <p className="text-xs text-dim">
                {result.cases_sampled > 0
                  ? <>{result.cases_sampled} cases sampled · <span style={{ color: "var(--vk-gold)" }}>{result.powered_by}</span></>
                  : <span style={{ color: "var(--vk-gold)" }}>{result.powered_by}</span>
                }
              </p>
            </div>

            {result.cases_sampled === 0 ? (
              <div className="vk-card p-8 text-center space-y-3">
                <BarChart2 className="w-10 h-10 mx-auto text-dim" />
                <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>No cases indexed yet</p>
                <p className="text-xs text-dim max-w-sm mx-auto">
                  Run the NyayaAnumana ingester to build the case index for rich judge analytics.
                </p>
                <code className="block text-xs px-4 py-2 rounded-lg mx-auto w-fit" style={{ background: "rgba(255,255,255,0.05)", color: "var(--vk-gold)" }}>
                  python -m rag.nyayaanumana_ingester
                </code>
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((s, i) => <AnalysisSection key={i} title={s.title} body={s.body} />)}
              </div>
            )}

            <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
              AI-generated judicial analytics are based on indexed case data and may not reflect current judicial views. Use for research purposes only.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
