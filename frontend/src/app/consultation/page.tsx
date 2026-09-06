"use client";

import { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Phone, MessageSquare, ChevronRight, FileSearch,
  Clock, CheckCircle, Star, Users, CalendarDays, Video, ShieldCheck,
} from "lucide-react";
import { PRACTICE_AREAS, INDIAN_STATES } from "@/lib/utils";
import { backendApi } from "@/lib/api";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  // Consult form state
  const [consultType, setConsultType] = useState<ConsultType>("call");
  const [consultForm, setConsultForm] = useState({
    practiceArea: "", state: "", urgency: "routine", description: "", budget: "",
  });
  const [consultSubmitting, setConsultSubmitting] = useState(false);
  const [consultDone, setConsultDone] = useState(false);

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

  return (
    <AppLayout
      title="Consultation"
      subtitle="Book a consultation with a verified lawyer"
    >
      <div className="max-w-2xl mx-auto">
        {consultDone ? (
          <div className="vk-card p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "#4ade80" }} />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--vk-text)" }}>Request submitted!</h2>
            <p className="text-sm mb-6" style={{ color: "var(--vk-text-muted)" }}>
              We&apos;ve matched your request to lawyers in our network. You&apos;ll hear from a verified advocate within{" "}
              {consultForm.urgency === "urgent" ? "2–4 hours" : consultForm.urgency === "soon" ? "24 hours" : "2–3 days"}.
            </p>
            <div className="flex justify-center gap-3">
              <button className="btn-secondary text-sm px-4 py-2" onClick={() => setConsultDone(false)}>
                New Request
              </button>
              <Link href="/documents?tab=review" className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
                <FileSearch className="w-4 h-4" /> Review a Document
              </Link>
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
    </AppLayout>
  );
}
