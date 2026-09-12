"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Markdown } from "@/components/Markdown";
import { aiApi, getApiErrorMessage } from "@/lib/api";
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

// Matches ai_service SafetyResult (routes/litigation_safety.py)
interface PrefilingResult {
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_score: number;
  limitation_status: string;
  limitation_risk: "ok" | "warning" | "danger";
  jurisdiction_ok: boolean;
  jurisdiction_notes: string;
  locus_standi_notes: string;
  procedural_risks: string[];
  alternative_remedies: string[];
  cost_estimate: string;
  success_probability: string;
  recommendations: string[];
}

// Matches ai_service predict_outcome() (agents/prediction_agent.py)
interface PredictResult {
  prediction: string;
  confidence: number; // 0-1
  confidence_label: string;
  reasoning: string;
  disclaimer?: string;
  similar_cases: { title?: string; citation?: string; decision?: string; year?: number }[];
}

const EMPTY_INPUT: SharedInput = {
  parties: "", background: "", key_events: "",
  evidence: "", statutes: "", prior_orders: "", relief_sought: "",
};

const RISK_STYLES = {
  low: { class: "text-green-400", badge: "vk-badge-green", label: "Low Risk" },
  medium: { class: "text-yellow-400", badge: "vk-badge-gold", label: "Medium Risk" },
  high: { class: "text-red-400", badge: "vk-badge-red", label: "High Risk" },
  critical: { class: "text-red-500", badge: "vk-badge-red", label: "Critical Risk" },
};

/** Combine the structured input fields into the single narrative the AI service expects. */
function buildCaseFacts(input: SharedInput): string {
  return [
    input.parties && `Parties: ${input.parties}`,
    input.background,
    input.key_events && `Key events: ${input.key_events}`,
    input.evidence && `Evidence available: ${input.evidence}`,
    input.statutes && `Applicable statutes: ${input.statutes}`,
    input.prior_orders && `Prior orders/judgments: ${input.prior_orders}`,
  ].filter(Boolean).join("\n\n");
}

export default function CaseIntelligencePage() {
  const [mode, setMode] = useState<CIMode>("prefiling");
  const [input, setInput] = useState<SharedInput>({ ...EMPTY_INPUT });
  const [court, setCourt] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [causeOfActionDate, setCauseOfActionDate] = useState("");
  const [clientType, setClientType] = useState("Individual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prefilingResult, setPrefilingResult] = useState<PrefilingResult | null>(null);
  const [predictResult, setPredictResult] = useState<PredictResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasResult = mode === "prefiling" ? !!prefilingResult : !!predictResult;
  const caseFacts = buildCaseFacts(input);
  const canRun = mode === "prefiling"
    ? caseFacts.length >= 50 && input.relief_sought.trim().length >= 10 && court.trim().length > 0
    : caseFacts.trim().length > 0;

  const handleRun = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "prefiling") {
        const { data } = await aiApi.post<PrefilingResult>("/ai/safety/check", {
          case_facts: caseFacts,
          proposed_relief: input.relief_sought,
          court,
          cause_of_action_date: causeOfActionDate,
          practice_area: practiceArea,
          client_type: clientType.toLowerCase().replace(/\s+/g, "_"),
        }, { timeout: 90_000 });
        setPrefilingResult(data);
      } else {
        const { data } = await aiApi.post<PredictResult>("/ai/predict", {
          case_facts: caseFacts,
          practice_area: practiceArea,
          court,
        }, { timeout: 90_000 });
        setPredictResult(data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to complete this analysis right now."));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrefilingResult(null);
    setPredictResult(null);
    setError("");
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="vk-label">Court / Forum {mode === "prefiling" && <span className="text-red-400">*</span>}</label>
                <input className="vk-input" placeholder="e.g. Delhi High Court" value={court} onChange={(e) => setCourt(e.target.value)} />
              </div>
              <div>
                <label className="vk-label">Practice Area</label>
                <input className="vk-input" placeholder="e.g. Contract Law" value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="vk-label">Relief Sought {mode === "prefiling" && <span className="text-red-400">*</span>}</label>
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

          {!canRun && input.background.trim() && (
            <p className="text-xs text-dim">
              {mode === "prefiling"
                ? "Pre-filing check needs at least 50 characters across parties/background/events, a court, and relief sought (10+ characters)."
                : "Add case background to predict an outcome."}
            </p>
          )}

          {error && (
            <div className="vk-card p-3 flex items-center gap-2" style={{ border: "1px solid rgba(248,113,113,0.3)" }}>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={loading || !canRun}
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
            const normalizedRisk = (prefilingResult.overall_risk || "").toLowerCase().trim();
            const riskStyle = RISK_STYLES[normalizedRisk as keyof typeof RISK_STYLES] ?? RISK_STYLES.medium;
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
                      background: normalizedRisk === "high" || normalizedRisk === "critical" ? "#ef4444" : normalizedRisk === "medium" ? "#f59e0b" : "#22c55e",
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs mt-4">
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Limitation Status ({prefilingResult.limitation_risk})</p>
                      <p className="font-medium">{prefilingResult.limitation_status}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Jurisdiction {prefilingResult.jurisdiction_ok ? "— OK" : "— Issue"}</p>
                      <p className="font-medium">{prefilingResult.jurisdiction_notes}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Locus Standi</p>
                      <p className="font-medium">{prefilingResult.locus_standi_notes}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: "var(--vk-navy-light)" }}>
                      <p className="text-dim mb-1">Cost Estimate</p>
                      <p className="font-medium">{prefilingResult.cost_estimate}</p>
                    </div>
                  </div>
                </div>

                <div className="vk-card p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">
                      Success Probability: <span className="text-gold">{prefilingResult.success_probability}</span>
                    </span>
                  </div>
                </div>

                {prefilingResult.procedural_risks?.length > 0 && (
                  <div className="vk-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-gold" />
                      <span className="text-sm font-semibold">Procedural Risks</span>
                    </div>
                    <ul className="space-y-2">
                      {(prefilingResult.procedural_risks || []).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-dim">
                          <span className="text-gold shrink-0 mt-0.5">→</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {prefilingResult.alternative_remedies?.length > 0 && (
                  <div className="vk-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Scale className="w-4 h-4 text-gold" />
                      <span className="text-sm font-semibold">Alternative Remedies</span>
                    </div>
                    <ul className="space-y-2">
                      {(prefilingResult.alternative_remedies || []).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-dim">
                          <span className="text-gold shrink-0 mt-0.5">→</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="vk-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-gold" />
                    <span className="text-sm font-semibold">Recommendations</span>
                  </div>
                  <ul className="space-y-2">
                    {(prefilingResult.recommendations || []).map((r, i) => (
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
                  <span className="font-semibold">Predicted Outcome</span>
                </div>
                <p className="text-sm mb-4">{predictResult.prediction}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-dim">Confidence ({predictResult.confidence_label})</span>
                  <div className="confidence-bar flex-1">
                    <div className="confidence-fill" style={{ width: `${Math.round((predictResult.confidence || 0) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gold">{Math.round((predictResult.confidence || 0) * 100)}%</span>
                </div>
                {predictResult.disclaimer && <p className="text-[11px] text-dim mt-3">{predictResult.disclaimer}</p>}
              </div>

              <div className="vk-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold">AI Reasoning</span>
                </div>
                <div className="text-xs text-dim leading-relaxed"><Markdown>{predictResult.reasoning}</Markdown></div>
              </div>

              {predictResult.similar_cases.length > 0 && (
                <div className="vk-card p-4">
                  <h3 className="text-sm font-semibold mb-3">Similar Cases</h3>
                  <div className="space-y-2">
                    {(predictResult.similar_cases || []).map((c, i) => (
                      <div key={i} className="rounded-lg p-3 text-xs" style={{ background: "var(--vk-navy-light)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{c.title || "Untitled"}{c.year ? ` (${c.year})` : ""}</p>
                            {c.citation && <p className="font-mono text-gold mt-0.5">{c.citation}</p>}
                          </div>
                          {c.decision && (
                            <span className="vk-badge vk-badge-green whitespace-normal text-left max-w-[45%]">{c.decision}</span>
                          )}
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
