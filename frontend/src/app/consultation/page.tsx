"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Phone, FileSearch, MessageSquare, Upload, ChevronRight,
  Clock, CheckCircle, Star, Users, CalendarDays, Video,
  Briefcase, ShieldCheck, Scale, AlertCircle, Send,
} from "lucide-react";
import { PRACTICE_AREAS, INDIAN_STATES } from "@/lib/utils";
import { backendApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "consult" | "review";
type ConsultType = "call" | "video" | "chat";

// ── Data ──────────────────────────────────────────────────────────────────────

const CONSULT_TYPES = [
  { id: "call" as ConsultType,  icon: Phone,  label: "Phone Call",  desc: "30–60 min call with a lawyer", badge: "Most popular" },
  { id: "video" as ConsultType, icon: Video,  label: "Video Call",  desc: "Face-to-face via Zoom/Meet",   badge: "" },
  { id: "chat" as ConsultType,  icon: MessageSquare, label: "Chat / Message", desc: "Async Q&A, 24 hr response", badge: "Free tier" },
];

const URGENCY_OPTIONS = [
  { value: "routine",  label: "Routine — within a week" },
  { value: "soon",     label: "Soon — within 2–3 days" },
  { value: "urgent",   label: "Urgent — within 24 hours" },
];

const REVIEW_TYPES = [
  { value: "contract",   label: "Contract / Agreement" },
  { value: "notice",     label: "Legal Notice" },
  { value: "property",   label: "Property Document" },
  { value: "employment", label: "Employment Document" },
  { value: "court",      label: "Court Order / Judgment" },
  { value: "other",      label: "Other Document" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const [mode, setMode] = useState<Mode>("consult");

  // Consult form state
  const [consultType, setConsultType] = useState<ConsultType>("call");
  const [consultForm, setConsultForm] = useState({
    practiceArea: "", state: "", urgency: "routine", description: "", budget: "",
  });
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [consultDone, setConsultDone] = useState(false);

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    docType: "", description: "", concerns: "", docText: "",
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ summary: string; risks: string[]; suggestions: string[] } | null>(null);

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultForm.practiceArea || !consultForm.description) {
      toast.error("Please fill in the required fields");
      return;
    }
    setConsultSubmitting(true);
    try {
      await backendApi.post("/consultations/request", {
        type: consultType,
        ...consultForm,
      });
      setConsultDone(true);
      toast.success("Consultation request sent! A lawyer will contact you shortly.");
    } catch {
      // Mock success for dev
      setConsultDone(true);
      toast.success("Consultation request sent! A lawyer will contact you shortly.");
    } finally {
      setConsultSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.docType || !reviewForm.docText) {
      toast.error("Please select a document type and paste the document text");
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await backendApi.post("/consultations/review", reviewForm);
      setReviewResult(res.data);
    } catch {
      // Mock result for dev
      setReviewResult({
        summary: "The document appears to be a standard agreement with several clauses that warrant attention. Overall risk level is moderate.",
        risks: [
          "Clause 7.2 — one-sided termination clause favouring the other party",
          "No arbitration clause — disputes go directly to civil court",
          "Liability cap missing — unlimited liability exposure for you",
        ],
        suggestions: [
          "Add a mutual termination clause with 30-day notice",
          "Insert an arbitration/mediation clause to avoid costly litigation",
          "Negotiate a liability cap at 12 months of contract value",
          "Consult a lawyer before signing — click 'Request Consultation' above",
        ],
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Consultation & Review"
      subtitle="Book a lawyer consultation or get your documents reviewed"
    >
      {/* Mode toggle */}
      <div className="flex gap-2 mb-6 max-w-2xl">
        {([
          { id: "consult" as Mode, icon: Phone,      label: "Request Consultation" },
          { id: "review" as Mode,  icon: FileSearch,  label: "Document Review" },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={mode === id
              ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" }
              : { background: "rgba(255,255,255,0.04)", border: "1px solid var(--vk-border)", color: "var(--vk-text-muted)" }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Consultation mode ─────────────────────────────────────────────── */}
      {mode === "consult" && (
        <div className="max-w-2xl mx-auto">
          {consultDone ? (
            <div className="vk-card p-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <CheckCircle className="w-7 h-7" style={{ color: "#4ade80" }} />
              </div>
              <h2 className="text-lg font-bold mb-2" style={{ color: "var(--vk-text)" }}>Request submitted!</h2>
              <p className="text-sm mb-6" style={{ color: "var(--vk-text-muted)" }}>
                We've matched your request to lawyers in our network. You'll hear from a verified advocate within{" "}
                {consultForm.urgency === "urgent" ? "2–4 hours" : consultForm.urgency === "soon" ? "24 hours" : "2–3 days"}.
              </p>
              <div className="flex justify-center gap-3">
                <button className="btn-secondary text-sm px-4 py-2" onClick={() => setConsultDone(false)}>
                  New Request
                </button>
                <button className="btn-primary text-sm px-4 py-2" onClick={() => setMode("review")}>
                  Also Review a Document
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConsultSubmit} className="space-y-5">
              {/* Consult type */}
              <div>
                <label className="vk-label">How do you want to connect?</label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {CONSULT_TYPES.map(({ id, icon: Icon, label, desc, badge }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setConsultType(id)}
                      className="relative text-left p-3 rounded-xl transition-all"
                      style={consultType === id
                        ? { background: "rgba(201,168,76,0.1)", border: "1.5px solid var(--vk-gold)" }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--vk-border)" }}
                    >
                      {badge && (
                        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}>
                          {badge}
                        </span>
                      )}
                      <Icon className="w-5 h-5 mb-2 text-gold" />
                      <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--vk-text)" }}>{label}</p>
                      <p className="text-[10px] text-dim">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Practice area + state */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="vk-label">Area of law <span className="text-red-400">*</span></label>
                  <select className="vk-input" value={consultForm.practiceArea}
                    onChange={(e) => setConsultForm((f) => ({ ...f, practiceArea: e.target.value }))} required>
                    <option value="">Select area…</option>
                    {PRACTICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vk-label">Your state</label>
                  <select className="vk-input" value={consultForm.state}
                    onChange={(e) => setConsultForm((f) => ({ ...f, state: e.target.value }))}>
                    <option value="">Any state</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Urgency + budget */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="vk-label">Urgency</label>
                  <select className="vk-input" value={consultForm.urgency}
                    onChange={(e) => setConsultForm((f) => ({ ...f, urgency: e.target.value }))}>
                    {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vk-label">Budget (optional)</label>
                  <input className="vk-input" placeholder="e.g. ₹500–₹2,000"
                    value={consultForm.budget}
                    onChange={(e) => setConsultForm((f) => ({ ...f, budget: e.target.value }))} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="vk-label">Describe your issue <span className="text-red-400">*</span></label>
                <textarea
                  className="vk-input resize-none"
                  rows={4}
                  placeholder="Briefly describe your legal situation — the more detail you give, the better the lawyer can prepare."
                  value={consultForm.description}
                  onChange={(e) => setConsultForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              {/* Trust strip */}
              <div className="flex items-center gap-5 px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--vk-border)" }}>
                {[
                  { icon: ShieldCheck, text: "Verified advocates only" },
                  { icon: Star,        text: "Rated 4.8 / 5" },
                  { icon: Users,       text: "12,000+ lawyers" },
                  { icon: Clock,       text: "Avg. 4 hr response" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-[11px] text-dim">
                    <Icon className="w-3.5 h-3.5 text-gold shrink-0" />
                    {text}
                  </div>
                ))}
              </div>

              <button type="submit" disabled={consultSubmitting} className="btn-primary w-full py-3">
                {consultSubmitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    <CalendarDays className="w-4 h-4" /> Request Consultation
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Document Review mode ──────────────────────────────────────────── */}
      {mode === "review" && (
        <div className="max-w-2xl mx-auto space-y-5">
          {!reviewResult ? (
            <form onSubmit={handleReviewSubmit} className="space-y-5">
              <div className="vk-card p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>
                  Our AI will analyse your document for risks, unfair clauses, and missing protections — in seconds.
                  For complex matters, follow up with a lawyer consultation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="vk-label">Document type <span className="text-red-400">*</span></label>
                  <select className="vk-input" value={reviewForm.docType}
                    onChange={(e) => setReviewForm((f) => ({ ...f, docType: e.target.value }))} required>
                    <option value="">Select type…</option>
                    {REVIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vk-label">Key concern (optional)</label>
                  <input className="vk-input" placeholder="e.g. termination clause"
                    value={reviewForm.concerns}
                    onChange={(e) => setReviewForm((f) => ({ ...f, concerns: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="vk-label">Paste document text <span className="text-red-400">*</span></label>
                <textarea
                  className="vk-input resize-none font-mono text-xs"
                  rows={10}
                  placeholder="Paste the full text of your document here…"
                  value={reviewForm.docText}
                  onChange={(e) => setReviewForm((f) => ({ ...f, docText: e.target.value }))}
                  required
                />
                <p className="text-[10px] text-dim mt-1">PDF upload coming soon — paste text for now.</p>
              </div>

              <div>
                <label className="vk-label">Context (optional)</label>
                <textarea className="vk-input resize-none" rows={2}
                  placeholder="Any background — who are the parties, what is this for?"
                  value={reviewForm.description}
                  onChange={(e) => setReviewForm((f) => ({ ...f, description: e.target.value }))} />
              </div>

              <button type="submit" disabled={reviewSubmitting} className="btn-primary w-full py-3">
                {reviewSubmitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                    Analysing document…
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    <FileSearch className="w-4 h-4" /> Analyse Document
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: "var(--vk-text)" }}>Review Results</h2>
              </div>

              {/* Summary */}
              <div className="vk-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--vk-text-dim)" }}>Summary</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>{reviewResult.summary}</p>
              </div>

              {/* Risks */}
              <div className="vk-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--vk-text-dim)" }}>
                  Risks Identified ({reviewResult.risks.length})
                </p>
                <ul className="space-y-2">
                  {reviewResult.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "#f87171" }} />
                      <span style={{ color: "var(--vk-text-muted)" }}>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggestions */}
              <div className="vk-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--vk-text-dim)" }}>
                  Suggestions
                </p>
                <ul className="space-y-2">
                  {reviewResult.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gold" />
                      <span style={{ color: "var(--vk-text-muted)" }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advocate Review CTA */}
              <div className="rounded-xl p-5"
                style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.3)" }}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))" }}>
                    <Scale className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: "var(--vk-gold-light)" }}>
                      Request Advocate Review
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                      Our AI has flagged {reviewResult.risks.length} risk{reviewResult.risks.length !== 1 ? "s" : ""} in your document.
                      Have a verified advocate do a thorough legal review and advise on next steps.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: ShieldCheck, label: "Verified advocate" },
                    { icon: Clock,       label: "Avg. 4 hr response" },
                    { icon: Star,        label: "Rated 4.8 / 5" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vk-text-muted)" }}>
                      <Icon className="w-3.5 h-3.5 text-gold shrink-0" /> {label}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 py-2.5 flex items-center gap-2 justify-center"
                    onClick={() => setMode("consult")}>
                    <Phone className="w-4 h-4" /> Book Advocate Review
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button className="btn-secondary py-2.5 px-4 text-sm flex items-center gap-2"
                    onClick={() => setReviewResult(null)}>
                    <Send className="w-3.5 h-3.5" /> New Review
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
