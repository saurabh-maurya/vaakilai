"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Scale, Sparkles, ChevronDown, ChevronUp, AlertCircle, Copy, Check } from "lucide-react";
import { aiApi } from "@/lib/api";

const PRACTICE_AREAS = [
  "Criminal Law", "Civil Law", "Family Law", "Property Law", "Contract Law",
  "Consumer Protection", "Labour Law", "Constitutional Law", "Taxation",
  "Corporate Law", "Banking Law", "Motor Accident",
];

interface ArgumentResult {
  petitioner_arguments: string[];
  respondent_arguments: string[];
  key_principles: string[];
  powered_by: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-white/10 text-dim transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ArgSection({
  title, items, color, bg, border, collapsed, onToggle,
}: {
  title: string; items: string[]; color: string; bg: string; border: string;
  collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: bg }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-sm" style={{ color }}>{title}</span>
          <span className="text-xs text-dim">({items.length} arguments)</span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-dim" />
          : <ChevronUp className="w-4 h-4 text-dim" />}
      </button>
      {!collapsed && (
        <div className="divide-y" style={{ borderColor: border }}>
          {items.map((arg, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.15)" }}>
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: bg, color, border: `1px solid ${border}` }}>
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--vk-text-muted)" }}>{arg}</p>
              <CopyButton text={arg} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArgumentBuilderPage() {
  const [form, setForm] = useState({
    case_facts: "",
    issues: "",
    statutes: "",
    practice_area: "Criminal Law",
  });
  const [result, setResult] = useState<ArgumentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [petCollapsed, setPetCollapsed] = useState(false);
  const [resCollapsed, setResCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!form.case_facts.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await aiApi.post("/legal-tasks/argument-builder", form);
      setResult(data);
    } catch {
      setResult({
        petitioner_arguments: ["Unable to generate arguments. Please try again."],
        respondent_arguments: [],
        key_principles: [],
        powered_by: "Error",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    const text = [
      "PETITIONER ARGUMENTS",
      "=".repeat(40),
      ...result.petitioner_arguments.map((a, i) => `${i + 1}. ${a}`),
      "",
      "RESPONDENT COUNTER-ARGUMENTS",
      "=".repeat(40),
      ...result.respondent_arguments.map((a, i) => `${i + 1}. ${a}`),
      "",
      "KEY LEGAL PRINCIPLES",
      "=".repeat(40),
      ...result.key_principles.map((p, i) => `${i + 1}. ${p}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AppLayout requirePro title="Argument Builder" subtitle="Generate petitioner &amp; respondent arguments powered by Aalap (OpenNyAI)">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Input */}
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
            <h3 className="font-semibold text-sm">Case Details</h3>
            <span className="vk-badge vk-badge-gold text-[10px] ml-auto">Aalap AI</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="vk-label">Case Facts *</label>
              <textarea
                className="vk-input w-full h-32 resize-none"
                placeholder="Describe the key facts — what happened, parties involved, sequence of events, evidence..."
                value={form.case_facts}
                onChange={e => setForm(f => ({ ...f, case_facts: e.target.value }))}
              />
            </div>
            <div>
              <label className="vk-label">Legal Issues (optional)</label>
              <textarea
                className="vk-input w-full h-20 resize-none"
                placeholder="List key legal issues — or leave blank and use Issue Spotter first"
                value={form.issues}
                onChange={e => setForm(f => ({ ...f, issues: e.target.value }))}
              />
            </div>
            <div>
              <label className="vk-label">Relevant Statutes / Sections (optional)</label>
              <textarea
                className="vk-input w-full h-20 resize-none"
                placeholder="e.g. Section 420 IPC, Section 138 NI Act, Article 21..."
                value={form.statutes}
                onChange={e => setForm(f => ({ ...f, statutes: e.target.value }))}
              />
            </div>
            <div>
              <label className="vk-label">Practice Area</label>
              <select className="vk-input w-full" value={form.practice_area} onChange={e => setForm(f => ({ ...f, practice_area: e.target.value }))}>
                {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <button
            className="btn-primary py-2.5 px-6 flex items-center gap-2"
            onClick={handleGenerate}
            disabled={loading || !form.case_facts.trim()}
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Generating Arguments..." : "Generate Arguments"}
          </button>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="vk-skeleton h-40 rounded-xl" />
            <div className="vk-skeleton h-40 rounded-xl" />
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-dim">
                Generated by <span style={{ color: "var(--vk-gold)" }}>{result.powered_by}</span>
              </p>
              <button
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                onClick={copyAll}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy All
              </button>
            </div>

            <ArgSection
              title="Petitioner / Appellant Arguments"
              items={result.petitioner_arguments}
              color="#4ade80"
              bg="rgba(34,197,94,0.06)"
              border="rgba(34,197,94,0.2)"
              collapsed={petCollapsed}
              onToggle={() => setPetCollapsed(p => !p)}
            />

            <ArgSection
              title="Respondent / Defendant Counter-Arguments"
              items={result.respondent_arguments}
              color="#f87171"
              bg="rgba(239,68,68,0.06)"
              border="rgba(239,68,68,0.2)"
              collapsed={resCollapsed}
              onToggle={() => setResCollapsed(p => !p)}
            />

            {result.key_principles.length > 0 && (
              <div className="vk-card p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--vk-gold)" }}>
                  Key Legal Principles
                </p>
                <div className="space-y-2">
                  {result.key_principles.map((p, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: "var(--vk-gold)" }} />
                      <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
              AI-generated arguments are a drafting aid only. Review, verify, and adapt before use in court proceedings. Consult a qualified advocate.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
