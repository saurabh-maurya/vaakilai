"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { AiThinking } from "@/components/AiThinking";
import { Markdown } from "@/components/Markdown";
import { backendApi, aiApi, getApiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Case, CaseStatus } from "@/types";
import {
  ArrowLeft, Briefcase, Calendar, Users, Gavel, FileText, Upload, Download,
  Sparkles, Shield, ListChecks, GanttChartSquare, BookOpen, Swords, Mail,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, MessageSquareText,
} from "lucide-react";

const STATUS_STYLES: Record<CaseStatus, { label: string; class: string }> = {
  active: { label: "Active", class: "vk-badge-green" },
  pending: { label: "Pending", class: "vk-badge-gold" },
  closed: { label: "Closed", class: "vk-badge-muted" },
  on_hold: { label: "On Hold", class: "vk-badge-blue" },
  appealed: { label: "Appealed", class: "vk-badge-red" },
};

type TabKey = "overview" | "intelligence" | "issues" | "timeline" | "statute" | "arguments" | "notices" | "documents";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Briefcase },
  { key: "intelligence", label: "Case Intelligence", icon: Shield },
  { key: "issues", label: "Issue Spotter", icon: ListChecks },
  { key: "timeline", label: "Event Timeline", icon: GanttChartSquare },
  { key: "statute", label: "Statute Breakdown", icon: BookOpen },
  { key: "arguments", label: "Argument Builder", icon: Swords },
  { key: "notices", label: "Notice Drafting", icon: Mail },
  { key: "documents", label: "Documents", icon: FileText },
];

/** Retry with backoff so a cold-started AI service (Render free tier spins down
 * when idle) self-heals instead of failing on the first request in every tab. */
async function aiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await aiApi.post<T>(path, body, { timeout: 90_000 });
      return data;
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } }).response?.status;
      const transient = status === undefined || status === 502 || status === 503 || status === 504;
      if (!transient || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ── Small shared building blocks ────────────────────────────────────────────

function RunButton({ onClick, loading, disabled, label = "Analyse" }: { onClick: () => void; loading: boolean; disabled?: boolean; label?: string }) {
  return (
    <button className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5" onClick={onClick} disabled={loading || disabled}>
      <Sparkles className="w-3.5 h-3.5" />
      {loading ? "Working…" : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="vk-card p-4 flex items-center gap-2" style={{ border: "1px solid rgba(248,113,113,0.3)" }}>
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{message}</p>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-xs text-dim">None found.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--vk-text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--vk-gold)" }} />
          {it}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, icon: Icon, color = "var(--vk-gold)", children }: { title: string; icon: React.ElementType; color?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="vk-card overflow-hidden">
      <button className="w-full flex items-center gap-2.5 px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
        <span className="flex-1 font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-dim" /> : <ChevronDown className="w-3.5 h-3.5 text-dim" />}
      </button>
      {open && <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--vk-border)" }}><div className="pt-3">{children}</div></div>}
    </div>
  );
}

// ── Case facts — shared across the AI tabs ──────────────────────────────────

function FactsPanel({ facts, setFacts, defaultFacts }: { facts: string; setFacts: (v: string) => void; defaultFacts: string }) {
  return (
    <div className="vk-card p-4 mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="vk-label mb-0">Case Facts <span className="text-dim font-normal">(shared with Issue Spotter, Timeline, Argument Builder, Notice Drafting &amp; Case Intelligence)</span></label>
        {facts !== defaultFacts && (
          <button className="text-[11px] text-gold hover:underline" onClick={() => setFacts(defaultFacts)}>Reset to case description</button>
        )}
      </div>
      <textarea
        className="vk-input w-full text-sm resize-none"
        rows={4}
        placeholder="Describe the facts of this case — parties, key events, evidence, what happened…"
        value={facts}
        onChange={(e) => setFacts(e.target.value)}
      />
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

interface Hearing { id: string; date: string; purpose?: string; court_room?: string; notes?: string }
interface TimelineEvent { event: string; timestamp: string }

function OverviewTab({ caseData, caseId }: { caseData: Case; caseId: string }) {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [activity, setActivity] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, t] = await Promise.all([
          backendApi.get(`/cases/${caseId}/hearings`),
          backendApi.get(`/cases/${caseId}/timeline`),
        ]);
        if (!cancelled) { setHearings(h.data || []); setActivity(t.data || []); }
      } catch {
        if (!cancelled) { setHearings([]); setActivity([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 space-y-5">
        <div className="vk-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-gold" />Description</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
            {caseData.description || "No description on file for this case."}
          </p>
        </div>

        <div className="vk-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-gold" />Case Activity</h3>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-8 rounded-lg" />)}</div>
          ) : activity.length === 0 ? (
            <p className="text-xs text-dim">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--vk-gold)" }} />
                  <div>
                    <p style={{ color: "var(--vk-text)" }}>{a.event}</p>
                    <p className="text-[11px] text-dim">{a.timestamp ? new Date(a.timestamp).toLocaleString("en-IN") : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="vk-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-gold" />Hearings</h3>
          {loading ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="vk-skeleton h-10 rounded-lg" />)}</div>
          ) : hearings.length === 0 ? (
            <p className="text-xs text-dim">No hearings scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {hearings.map((h) => (
                <li key={h.id} className="text-xs p-2.5 rounded-lg" style={{ background: "var(--vk-navy-light)" }}>
                  <p className="font-medium text-gold">{formatDate(h.date)}</p>
                  {h.purpose && <p className="text-dim mt-0.5">{h.purpose}</p>}
                  {h.court_room && <p className="text-dim">{h.court_room}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Case Intelligence tab (safety-check / predict) ──────────────────────────

interface PredictResult {
  prediction: string;
  confidence: number;
  confidence_label: string;
  reasoning: string;
  disclaimer?: string;
  similar_cases: { title?: string; citation?: string; decision?: string; year?: number }[];
}

interface SafetyResult {
  overall_risk: string;
  risk_score: number;
  limitation_status: string;
  limitation_risk: string;
  jurisdiction_ok: boolean;
  jurisdiction_notes: string;
  locus_standi_notes: string;
  procedural_risks: string[];
  alternative_remedies: string[];
  cost_estimate: string;
  success_probability: string;
  recommendations: string[];
}

const RISK_COLOR: Record<string, string> = { low: "#4ade80", medium: "#fbbf24", high: "#f87171", critical: "#ef4444" };

function IntelligenceTab({ caseData, facts }: { caseData: Case; facts: string }) {
  const [mode, setMode] = useState<"prefiling" | "predict">("predict");
  const [reliefSought, setReliefSought] = useState("");
  const [court, setCourt] = useState(caseData.court || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [predictResult, setPredictResult] = useState<PredictResult | null>(null);
  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);

  const canRun = mode === "predict" ? facts.trim().length > 0 : facts.trim().length >= 50 && reliefSought.trim().length >= 10 && court.trim().length > 0;

  const run = async () => {
    setLoading(true); setError(""); setPredictResult(null); setSafetyResult(null);
    try {
      if (mode === "predict") {
        const data = await aiPost<PredictResult>("/ai/predict", {
          case_facts: facts, practice_area: caseData.practice_area || "", court,
        });
        setPredictResult(data);
      } else {
        const data = await aiPost<SafetyResult>("/ai/safety/check", {
          case_facts: facts, proposed_relief: reliefSought, court,
          practice_area: caseData.practice_area || "", client_type: "individual",
        });
        setSafetyResult(data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to analyse this case right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5 space-y-3">
        <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
          {(["predict", "prefiling"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className="px-3 py-1.5 text-xs rounded-md font-medium capitalize"
              style={mode === m ? { background: "var(--vk-gold)", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}>
              {m === "predict" ? "Outcome Prediction" : "Pre-filing Risk Check"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="vk-label">Court / Forum {mode === "prefiling" && <span className="text-red-400">*</span>}</label>
            <input className="vk-input w-full text-sm" placeholder="e.g. Delhi High Court" value={court} onChange={(e) => setCourt(e.target.value)} />
          </div>
          {mode === "prefiling" && (
            <div>
              <label className="vk-label">Relief Sought <span className="text-red-400">*</span> <span className="text-dim font-normal">(min 10 chars)</span></label>
              <input className="vk-input w-full text-sm" placeholder="e.g. Injunction restraining…" value={reliefSought} onChange={(e) => setReliefSought(e.target.value)} />
            </div>
          )}
        </div>
        <RunButton onClick={run} loading={loading} disabled={!canRun} label={mode === "predict" ? "Predict Outcome" : "Run Risk Check"} />
        {!canRun && (
          <p className="text-[11px] text-dim">
            {mode === "predict" ? "Add case facts above first." : "Risk check needs at least 50 characters of case facts, a court, and relief sought."}
          </p>
        )}
      </div>

      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}

      {predictResult && !loading && (
        <div className="space-y-3">
          <div className="vk-card p-5">
            <p className="text-[11px] uppercase tracking-wide text-dim mb-1">Predicted Outcome</p>
            <p className="text-lg font-bold" style={{ color: "var(--vk-text)" }}>{predictResult.prediction}</p>
            <p className="text-xs text-dim mt-1">Confidence: {predictResult.confidence_label} ({Math.round((predictResult.confidence || 0) * 100)}%)</p>
          </div>
          <Section title="Reasoning" icon={Shield} color="#60a5fa"><p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{predictResult.reasoning}</p></Section>
          {predictResult.similar_cases?.length > 0 && (
            <Section title="Similar Cases" icon={BookOpen} color="var(--vk-gold)">
              <Bullets items={predictResult.similar_cases.map((c) => `${c.title || "Untitled"}${c.citation ? ` — ${c.citation}` : ""}${c.decision ? ` (${c.decision})` : ""}`)} />
            </Section>
          )}
          {predictResult.disclaimer && <p className="text-[11px] text-dim">{predictResult.disclaimer}</p>}
        </div>
      )}

      {safetyResult && !loading && (
        <div className="space-y-3">
          <div className="vk-card p-5 flex items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-dim mb-1">Overall Risk</p>
              <p className="text-lg font-bold capitalize" style={{ color: RISK_COLOR[safetyResult.overall_risk] || "var(--vk-text)" }}>{safetyResult.overall_risk}</p>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--vk-navy-light)" }}>
                <div className="h-full rounded-full" style={{ width: `${safetyResult.risk_score}%`, background: RISK_COLOR[safetyResult.overall_risk] || "var(--vk-gold)" }} />
              </div>
              <p className="text-[11px] text-dim mt-1">Risk score: {safetyResult.risk_score}/100 · Success probability: {safetyResult.success_probability}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Section title="Limitation" icon={Clock} color={safetyResult.limitation_risk === "danger" ? "#f87171" : "#4ade80"}>
              <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{safetyResult.limitation_status}</p>
            </Section>
            <Section title="Jurisdiction" icon={Gavel} color={safetyResult.jurisdiction_ok ? "#4ade80" : "#f87171"}>
              <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{safetyResult.jurisdiction_notes}</p>
            </Section>
          </div>
          <Section title="Locus Standi" icon={Users} color="#60a5fa"><p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{safetyResult.locus_standi_notes}</p></Section>
          <Section title="Procedural Risks" icon={AlertCircle} color="#fbbf24"><Bullets items={safetyResult.procedural_risks} /></Section>
          <Section title="Alternative Remedies" icon={ListChecks} color="#a78bfa"><Bullets items={safetyResult.alternative_remedies} /></Section>
          <Section title="Recommendations" icon={CheckCircle} color="var(--vk-gold)"><Bullets items={safetyResult.recommendations} /></Section>
          <p className="text-[11px] text-dim">Estimated cost: {safetyResult.cost_estimate}</p>
        </div>
      )}
    </div>
  );
}

// ── Issue Spotter tab ────────────────────────────────────────────────────────

function IssuesTab({ caseData, facts }: { caseData: Case; facts: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ issues: string[]; primary_issue?: string; applicable_laws: string[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await aiPost<typeof result>("/ai/legal-tasks/issue-spotter", {
        case_facts: facts, practice_area: caseData.practice_area, court: caseData.court,
      });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to spot issues right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5">
        <RunButton onClick={run} loading={loading} disabled={!facts.trim()} label="Spot Issues" />
        {!facts.trim() && <p className="text-[11px] text-dim mt-2">Add case facts above first.</p>}
      </div>
      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="space-y-3">
          {result.primary_issue && (
            <div className="vk-card p-4" style={{ border: "1px solid rgba(201,168,76,0.3)" }}>
              <p className="text-[11px] uppercase tracking-wide text-dim mb-1">Primary Issue</p>
              <p className="text-sm font-medium" style={{ color: "var(--vk-text)" }}>{result.primary_issue}</p>
            </div>
          )}
          <Section title="Legal Issues" icon={ListChecks} color="#60a5fa"><Bullets items={result.issues} /></Section>
          <Section title="Applicable Laws" icon={BookOpen} color="#4ade80"><Bullets items={result.applicable_laws} /></Section>
        </div>
      )}
    </div>
  );
}

// ── Event Timeline tab ───────────────────────────────────────────────────────

const DOT_COLORS = ["#60a5fa", "#4ade80", "#fbbf24", "#a78bfa", "#f87171"];

function EventTimelineTab({ facts }: { facts: string }) {
  const [sourceType, setSourceType] = useState<"case" | "fir">("case");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ events: { date: string; event: string; significance?: string }[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await aiPost<typeof result>("/ai/legal-tasks/event-timeline", { case_description: facts, source_type: sourceType });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to build a timeline right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5 space-y-3">
        <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
          {(["case", "fir"] as const).map((s) => (
            <button key={s} onClick={() => setSourceType(s)} className="px-3 py-1.5 text-xs rounded-md font-medium uppercase"
              style={sourceType === s ? { background: "var(--vk-gold)", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}>
              {s === "case" ? "Case Facts" : "FIR Text"}
            </button>
          ))}
        </div>
        <RunButton onClick={run} loading={loading} disabled={!facts.trim()} label="Extract Timeline" />
        {!facts.trim() && <p className="text-[11px] text-dim">Add case facts above first.</p>}
      </div>
      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="vk-card p-5">
          {result.events.length === 0 ? <p className="text-xs text-dim">No events extracted.</p> : (
            <div className="space-y-0">
              {result.events.map((ev, i) => (
                <div key={i} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                    {i < result.events.length - 1 && <div className="w-px flex-1" style={{ background: "var(--vk-border)" }} />}
                  </div>
                  <div className="pb-1">
                    <p className="text-xs font-semibold text-gold">{ev.date}</p>
                    <p className="text-sm" style={{ color: "var(--vk-text)" }}>{ev.event}</p>
                    {ev.significance && <p className="text-xs text-dim mt-0.5">{ev.significance}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Statute Breakdown tab (standalone — not case-facts driven) ─────────────

function StatuteTab() {
  const [statuteName, setStatuteName] = useState("");
  const [statuteText, setStatuteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ingredients: string[]; burden_of_proof?: string; exceptions: string[]; punishment?: string; landmark_cases: string[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await aiPost<typeof result>("/ai/legal-tasks/statute-breakdown", { statute_name: statuteName, statute_text: statuteText });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to analyse this statute right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5 space-y-3">
        <p className="text-xs text-dim">Statute Breakdown works from the statute text itself, not this case&apos;s facts — paste the section relevant to this matter.</p>
        <div>
          <label className="vk-label">Statute Name</label>
          <input className="vk-input w-full text-sm" placeholder="e.g. Section 138, Negotiable Instruments Act" value={statuteName} onChange={(e) => setStatuteName(e.target.value)} />
        </div>
        <div>
          <label className="vk-label">Statute Text</label>
          <textarea className="vk-input w-full text-sm resize-none" rows={4} placeholder="Paste the statute text…" value={statuteText} onChange={(e) => setStatuteText(e.target.value)} />
        </div>
        <RunButton onClick={run} loading={loading} disabled={!statuteText.trim()} label="Break Down Statute" />
      </div>
      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="space-y-3">
          <Section title="Essential Ingredients" icon={ListChecks} color="#4ade80"><Bullets items={result.ingredients} /></Section>
          <Section title="Burden of Proof" icon={Shield} color="#60a5fa"><p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{result.burden_of_proof || "Not specified."}</p></Section>
          <Section title="Exceptions" icon={AlertCircle} color="#fbbf24"><Bullets items={result.exceptions} /></Section>
          <Section title="Punishment" icon={Gavel} color="#f87171"><p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{result.punishment || "Not specified."}</p></Section>
          <Section title="Landmark Cases" icon={BookOpen} color="var(--vk-gold)"><Bullets items={result.landmark_cases} /></Section>
        </div>
      )}
    </div>
  );
}

// ── Argument Builder tab ─────────────────────────────────────────────────────

function ArgumentsTab({ caseData, facts }: { caseData: Case; facts: string }) {
  const [issues, setIssues] = useState("");
  const [statutes, setStatutes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ petitioner_arguments: string[]; respondent_arguments: string[]; key_principles: string[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await aiPost<typeof result>("/ai/legal-tasks/argument-builder", {
        case_facts: facts, issues, statutes, practice_area: caseData.practice_area,
      });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to build arguments right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="vk-label">Key Issues (optional)</label>
            <input className="vk-input w-full text-sm" placeholder="Comma-separated issues" value={issues} onChange={(e) => setIssues(e.target.value)} />
          </div>
          <div>
            <label className="vk-label">Statutes (optional)</label>
            <input className="vk-input w-full text-sm" placeholder="e.g. Section 138 NI Act" value={statutes} onChange={(e) => setStatutes(e.target.value)} />
          </div>
        </div>
        <RunButton onClick={run} loading={loading} disabled={!facts.trim()} label="Build Arguments" />
        {!facts.trim() && <p className="text-[11px] text-dim">Add case facts above first.</p>}
      </div>
      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Section title="Petitioner / Appellant" icon={Swords} color="#4ade80"><Bullets items={result.petitioner_arguments} /></Section>
            <Section title="Respondent" icon={Swords} color="#f87171"><Bullets items={result.respondent_arguments} /></Section>
          </div>
          <Section title="Key Principles" icon={BookOpen} color="var(--vk-gold)"><Bullets items={result.key_principles} /></Section>
        </div>
      )}
    </div>
  );
}

// ── Notice Drafting tab ──────────────────────────────────────────────────────

function NoticesTab({ caseData, facts }: { caseData: Case; facts: string }) {
  const [noticeType, setNoticeType] = useState("legal_notice");
  const [recipientName, setRecipientName] = useState("");
  const [demand, setDemand] = useState("");
  const [complianceDays, setComplianceDays] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ notice_text: string; local_only?: boolean } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await aiPost<typeof result>("/ai/notices/draft", {
        notice_type: noticeType,
        sender_name: "",
        sender_details: "",
        recipient_name: recipientName || caseData.client_name,
        recipient_details: "",
        facts,
        demand,
        compliance_days: complianceDays,
        advocate_name: "",
        extra_instructions: "",
      });
      setResult(data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(status === 503
        ? "The local drafting model isn't configured on this device yet."
        : getApiErrorMessage(err, "Unable to draft this notice right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5 space-y-3">
        <p className="text-xs text-dim flex items-center gap-1.5"><Shield className="w-3 h-3" />Runs on a local AI model on your device — never a cloud API.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="vk-label">Recipient Name</label>
            <input className="vk-input w-full text-sm" placeholder={caseData.client_name} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </div>
          <div>
            <label className="vk-label">Compliance Days</label>
            <input type="number" min={1} className="vk-input w-full text-sm" value={complianceDays} onChange={(e) => setComplianceDays(Number(e.target.value) || 15)} />
          </div>
        </div>
        <div>
          <label className="vk-label">Demand</label>
          <textarea className="vk-input w-full text-sm resize-none" rows={2} placeholder="What the notice demands…" value={demand} onChange={(e) => setDemand(e.target.value)} />
        </div>
        <RunButton onClick={run} loading={loading} disabled={!facts.trim() || !demand.trim()} label="Draft Notice" />
        {(!facts.trim() || !demand.trim()) && <p className="text-[11px] text-dim">Case facts above and a demand are both required.</p>}
      </div>
      {loading && <AiThinking />}
      {error && !loading && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="vk-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>Draft ready</p>
          </div>
          <div className="text-sm" style={{ color: "var(--vk-text-muted)" }}>
            <Markdown>{result.notice_text}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Documents tab ────────────────────────────────────────────────────────────

interface CaseDocument { id: string; filename: string; content_type: string; size_bytes: number; created_at: string }

function DocumentsTab({ caseId }: { caseId: string }) {
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.get("/documents/", { params: { case_id: caseId } });
      setDocs(data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file: File) => {
    setUploading(true); setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await backendApi.post("/documents/upload", form, {
        params: { case_id: caseId },
        headers: { "Content-Type": "multipart/form-data" },
      });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="vk-card p-5">
        <label className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5 cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload Document"}
          <input type="file" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
        </label>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-12 rounded-lg" />)}</div>
      ) : docs.length === 0 ? (
        <div className="vk-card p-8 text-center text-dim">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-semibold">No documents yet</p>
        </div>
      ) : (
        <div className="vk-card divide-y" style={{ borderColor: "var(--vk-border)" }}>
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-gold shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--vk-text)" }}>{d.filename}</p>
                  <p className="text-[11px] text-dim">{Math.round((d.size_bytes || 0) / 1024)} KB · {formatDate(d.created_at)}</p>
                </div>
              </div>
              <a href={`/api/backend/documents/file/${d.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2 shrink-0" title="Download">
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [facts, setFacts] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await backendApi.get(`/cases/${caseId}`);
        if (cancelled) return;
        setCaseData(data);
        setFacts(data.description || "");
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <AppLayout requirePro title="Loading case…">
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="vk-skeleton h-16 rounded-xl" />)}</div>
      </AppLayout>
    );
  }

  if (notFound || !caseData) {
    return (
      <AppLayout requirePro title="Case not found">
        <div className="vk-card p-10 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-dim" />
          <p className="text-sm font-semibold mb-1">This case doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link href="/pro/cases" className="text-xs text-gold hover:underline">Back to Cases</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      requirePro
      title={caseData.title}
      subtitle={`${caseData.case_number || "No case number"} · ${caseData.client_name}`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/pro/cases")} className="btn-ghost flex items-center gap-1.5 text-xs text-dim">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
          </button>
          <Link href={`/chat?q=${encodeURIComponent(`Regarding my case "${caseData.title}" (${caseData.practice_area || "general"}): `)}`}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" /> Ask AI about this case
          </Link>
        </div>
      }
    >
      {/* Key facts strip */}
      <div className="vk-card p-4 mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className={`vk-badge ${STATUS_STYLES[caseData.status].class}`}>{STATUS_STYLES[caseData.status].label}</span>
        <span className="flex items-center gap-1.5 text-dim"><Users className="w-3.5 h-3.5" />{caseData.client_name}</span>
        {caseData.court && <span className="flex items-center gap-1.5 text-dim"><Gavel className="w-3.5 h-3.5" />{caseData.court}</span>}
        {caseData.judge && <span className="flex items-center gap-1.5 text-dim">Judge: {caseData.judge}</span>}
        {caseData.practice_area && <span className="vk-badge vk-badge-muted">{caseData.practice_area}</span>}
        {caseData.next_hearing && (
          <span className="flex items-center gap-1.5 text-gold"><Calendar className="w-3.5 h-3.5" />Next hearing {formatDate(caseData.next_hearing)}</span>
        )}
      </div>

      {tab !== "overview" && tab !== "statute" && tab !== "documents" && (
        <FactsPanel facts={facts} setFacts={setFacts} defaultFacts={caseData.description || ""} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit flex-wrap" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
            style={tab === t.key ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab caseData={caseData} caseId={caseId} />}
      {tab === "intelligence" && <IntelligenceTab caseData={caseData} facts={facts} />}
      {tab === "issues" && <IssuesTab caseData={caseData} facts={facts} />}
      {tab === "timeline" && <EventTimelineTab facts={facts} />}
      {tab === "statute" && <StatuteTab />}
      {tab === "arguments" && <ArgumentsTab caseData={caseData} facts={facts} />}
      {tab === "notices" && <NoticesTab caseData={caseData} facts={facts} />}
      {tab === "documents" && <DocumentsTab caseId={caseId} />}
    </AppLayout>
  );
}
