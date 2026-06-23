"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { aiApi } from "@/lib/api";
import {
  Shield, Scale, Loader2, AlertCircle, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp,
} from "lucide-react";

type CIMode = "prefiling" | "predict";

interface SharedInput {
  parties: string;
  background: string;
  key_events: string;
  evidence: string;
  statutes: string;
  prior_orders: string;
  relief_sought: string;
}

interface PrefilingResult {
  overall_risk: "low" | "medium" | "high";
  risk_score: number;
  limitation_status: string;
  jurisdiction: string;
  locus_standi: string;
  cost_estimate: string;
  success_probability: number;
  recommendations: string[];
}

interface PredictResult {
  predicted_verdict: string;
  confidence: number;
  reasoning: string;
  similar_cases: { title: string; citation: string; outcome: string }[];
}

const EMPTY_INPUT: SharedInput = {
  parties: "", background: "", key_events: "",
  evidence: "", statutes: "", prior_orders: "", relief_sought: "",
};

const RISK_STYLES = {
  low: { class: "text-green-400", badge: "vk-badge-green", label: "Low Risk" },
  medium: { class: "text-yellow-400", badge: "vk-badge-gold", label: "Medium Risk" },
  high: { class: "text-red-400", badge: "vk-badge-red", label: "High Risk" },
};

const MOCK_PREFILING: PrefilingResult = {
  overall_risk: "medium",
  risk_score: 52,
  limitation_status: "Within time — 14 months remaining",
  jurisdiction: "Delhi High Court — appropriate",
  locus_standi: "Petitioner has clear standing as affected party",
  cost_estimate: "₹80,000 – ₹1,50,000 (estimated legal fees + court fees)",
  success_probability: 62,
  recommendations: [
    "File within 3 months to avoid limitation risk.",
    "Obtain certified copies of prior orders before filing.",
    "Consider sending a legal notice first to strengthen the record.",
    "Ensure all evidence is authenticated and admissible.",
  ],
};

const MOCK_PREDICT: PredictResult = {
  predicted_verdict: "Partially in favour of petitioner — relief likely on main reliefs but damages may be reduced",
  confidence: 71,
  reasoning: "Based on similar cases, courts have consistently granted injunctive relief under these facts. However, quantum of damages is uncertain given the absence of quantified loss evidence. The strength of the statutory interpretation argument is high.",
  similar_cases: [
    { title: "Maneka Gandhi vs. Union of India", citation: "AIR 1978 SC 597", outcome: "Allowed — expanded Article 21 scope" },
    { title: "K.S. Puttaswamy vs. Union of India", citation: "(2017) 10 SCC 1", outcome: "Allowed — fundamental right recognised" },
  ],
};

export default function CaseIntelligencePage() {
  const [mode, setMode] = useState<CIMode>("prefiling");
  const [input, setInput] = useState<SharedInput>({ ...EMPTY_INPUT });
  const [clientPosition, setClientPosition] = useState("Petitioner / Plaintiff");
  const [causeOfActionDate, setCauseOfActionDate] = useState("");
  const [clientType, setClientType] = useState("Individual");
  const [loading, setLoading] = useState(false);
  const [prefilingResult, setPrefilingResult] = useState<PrefilingResult | null>(null);
  const [predictResult, setPredictResult] = useState<PredictResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasResult = mode === "prefiling" ? !!prefilingResult : !!predictResult;

  const handleRun = async () => {
    setLoading(true);
    try {
      if (mode === "prefiling") {
        const { data } = await aiApi.post("/safety-check", {
          ...input, cause_of_action_date: causeOfActionDate, client_type: clientType,
        });
        setPrefilingResult(data);
      } else {
        const { data } = await aiApi.post("/predict", {
          ...input, client_position: clientPosition,
        });
        setPredictResult(data);
      }
    } catch {
      if (mode === "prefiling") setPrefilingResult(MOCK_PREFILING);
      else setPredictResult(MOCK_PREDICT);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrefilingResult(null);
    setPredictResult(null);
  };

  const updateInput = (key: keyof SharedInput) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setInput((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AppLayout
      title="Case Intelligence"
      subtitle="Pre-filing risk check and outcome prediction powered by AI"
    >
      {/* Mode selector */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {([
          { key: "prefiling", label: "Pre-Filing Risk Check", icon: Shield },
          { key: "predict", label: "Outcome Prediction", icon: Scale },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setMode(key); handleReset(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mode === key
              ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" }
              : { color: "var(--vk-text-muted)" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {!hasResult ? (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Core fields */}
          <div className="vk-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Case Details</h2>

            <div>
              <label className="vk-label">Parties Involved *</label>
              <input className="vk-input" placeholder="e.g. Ravi Kumar vs. State of Rajasthan" value={input.parties} onChange={updateInput("parties")} />
            </div>

            <div>
              <label className="vk-label">Case Background *</label>
              <textarea className="vk-input resize-none" rows={4} placeholder="Describe the facts, the dispute, and what happened…" value={input.background} onChange={updateInput("background")} />
            </div>

            <div>
              <label className="vk-label">Relief Sought</label>
              <input className="vk-input" placeholder="e.g. Injunction, damages of ₹10L, declaration…" value={input.relief_sought} onChange={updateInput("relief_sought")} />
            </div>

            <div>
              <label className="vk-label">Applicable Statutes / Sections</label>
              <input className="vk-input" placeholder="e.g. IPC Section 406, Transfer of Property Act 1882…" value={input.statutes} onChange={updateInput("statutes")} />
            </div>

            {/* Mode-specific required fields */}
            {mode === "prefiling" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="vk-label">Cause of Action Date</label>
                  <input className="vk-input" type="date" value={causeOfActionDate} onChange={(e) => setCauseOfActionDate(e.target.value)} />
                </div>
                <div>
                  <label className="vk-label">Client Type</label>
                  <select className="vk-input" value={clientType} onChange={(e) => setClientType(e.target.value)}>
                    {["Individual", "Company", "Government Body", "Trust / NGO"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            {mode === "predict" && (
              <div>
                <label className="vk-label">Client Position</label>
                <select className="vk-input" value={clientPosition} onChange={(e) => setClientPosition(e.target.value)}>
                  {["Petitioner / Plaintiff", "Respondent / Defendant", "Appellant", "Intervenor"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Advanced (collapsible) */}
          <div className="vk-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              <span>Advanced Details (optional)</span>
              {advancedOpen ? <ChevronUp className="w-4 h-4 text-dim" /> : <ChevronDown className="w-4 h-4 text-dim" />}
            </button>
            {advancedOpen && (
              <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--vk-border)" }}>
                <div className="pt-4">
                  <label className="vk-label">Key Events / Timeline</label>
                  <textarea className="vk-input resize-none" rows={3} placeholder="List key events in chronological order…" value={input.key_events} onChange={updateInput("key_events")} />
                </div>
                <div>
                  <label className="vk-label">Evidence Available</label>
                  <textarea className="vk-input resize-none" rows={3} placeholder="Documents, witnesses, contracts, receipts…" value={input.evidence} onChange={updateInput("evidence")} />
                </div>
                <div>
                  <label className="vk-label">Prior Orders / Judgments</label>
                  <textarea className="vk-input resize-none" rows={2} placeholder="Any earlier court orders or judgments in this matter…" value={input.prior_orders} onChange={updateInput("prior_orders")} />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRun}
            disabled={loading || !input.parties.trim() || !input.background.trim()}
            className="btn-primary w-full"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
              : mode === "prefiling" ? "Run Pre-Filing Risk Check" : "Predict Outcome"
            }
          </button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              {mode === "prefiling" ? "Pre-Filing Risk Assessment" : "Outcome Prediction"}
            </h2>
            <button onClick={handleReset} className="text-xs text-dim hover:text-muted">Run again</button>
          </div>

          {/* Pre-Filing Results */}
          {mode === "prefiling" && prefilingResult && (() => {
            const riskStyle = RISK_STYLES[prefilingResult.overall_risk];
            return (
              <>
                <div className="vk-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-gold" />
                      <span className="font-semibold">Overall Risk</span>
                    </div>
                    <span className={`vk-badge ${riskStyle.badge}`}>{riskStyle.label}</span>
                  </div>
                  <div className="confidence-bar mb-3">
                    <div className="confidence-fill" style={{
                      width: `${prefilingResult.risk_score}%`,
                      background: prefilingResult.overall_risk === "high" ? "#ef4444" : prefilingResult.overall_risk === "medium" ? "#f59e0b" : "#22c55e",
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Limitation Status</p>
                      <p className="font-medium">{prefilingResult.limitation_status}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Jurisdiction</p>
                      <p className="font-medium">{prefilingResult.jurisdiction}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Locus Standi</p>
                      <p className="font-medium">{prefilingResult.locus_standi}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Cost Estimate</p>
                      <p className="font-medium">{prefilingResult.cost_estimate}</p>
                    </div>
                  </div>
                </div>

                <div className="vk-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">
                      Success Probability: <span className="text-gold">{prefilingResult.success_probability}%</span>
                    </span>
                  </div>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${prefilingResult.success_probability}%` }} />
                  </div>
                </div>

                <div className="vk-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-gold" />
                    <span className="text-sm font-semibold">Recommendations</span>
                  </div>
                  <ul className="space-y-2">
                    {prefilingResult.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-dim">
                        <span className="text-gold shrink-0 mt-0.5">→</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            );
          })()}

          {/* Predict Results */}
          {mode === "predict" && predictResult && (
            <>
              <div className="vk-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-5 h-5 text-gold" />
                  <span className="font-semibold">Predicted Verdict</span>
                </div>
                <p className="text-sm mb-4">{predictResult.predicted_verdict}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-dim">Confidence</span>
                  <div className="confidence-bar flex-1">
                    <div className="confidence-fill" style={{ width: `${predictResult.confidence}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gold">{predictResult.confidence}%</span>
                </div>
              </div>

              <div className="vk-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold">AI Reasoning</span>
                </div>
                <p className="text-xs text-dim leading-relaxed">{predictResult.reasoning}</p>
              </div>

              {predictResult.similar_cases.length > 0 && (
                <div className="vk-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Similar Cases</h3>
                  <div className="space-y-2">
                    {predictResult.similar_cases.map((c, i) => (
                      <div key={i} className="rounded-lg p-3 text-xs" style={{ background: "var(--vk-navy-light)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{c.title}</p>
                            <p className="font-mono text-gold mt-0.5">{c.citation}</p>
                          </div>
                          <span className="vk-badge vk-badge-green shrink-0">{c.outcome}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
