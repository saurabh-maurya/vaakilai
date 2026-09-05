"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScrollText, Sparkles, AlertCircle, Copy, Check, ShieldCheck, WifiOff } from "lucide-react";
import { aiApi } from "@/lib/api";

const NOTICE_TYPES = [
  { value: "demand", label: "Legal Demand Notice" },
  { value: "cheque_bounce", label: "Cheque Bounce (S.138 NI Act)" },
  { value: "money_recovery", label: "Recovery of Money" },
  { value: "eviction", label: "Eviction / Vacate Premises" },
  { value: "breach_of_contract", label: "Breach of Contract" },
  { value: "consumer", label: "Consumer — Deficiency in Service" },
  { value: "employment", label: "Employment / Unpaid Dues" },
  { value: "defamation", label: "Defamation" },
];

interface NoticeResult {
  notice_text: string;
  notice_type: string;
  compliance_days: number;
  powered_by: string;
  backend: string;
  local_only: boolean;
}

export default function NoticeDrafterPage() {
  const [noticeType, setNoticeType] = useState("demand");
  const [senderName, setSenderName] = useState("");
  const [senderDetails, setSenderDetails] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientDetails, setRecipientDetails] = useState("");
  const [facts, setFacts] = useState("");
  const [demand, setDemand] = useState("");
  const [complianceDays, setComplianceDays] = useState(15);
  const [advocateName, setAdvocateName] = useState("");
  const [extra, setExtra] = useState("");

  const [result, setResult] = useState<NoticeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit =
    senderName.trim().length >= 2 &&
    recipientName.trim().length >= 2 &&
    facts.trim().length >= 30 &&
    demand.trim().length >= 5;

  const handleDraft = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data } = await aiApi.post<NoticeResult>("/ai/notices/draft", {
        notice_type: noticeType,
        sender_name: senderName,
        sender_details: senderDetails,
        recipient_name: recipientName,
        recipient_details: recipientDetails,
        facts,
        demand,
        compliance_days: complianceDays,
        advocate_name: advocateName,
        extra_instructions: extra,
      });
      setResult(data);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      if (err.response?.status === 503) {
        setError(
          err.response?.data?.detail ??
            "The drafting model is not configured. Set a hosted API key (or switch to local Ollama) to use the notice drafter."
        );
      } else {
        setError(err.response?.data?.detail ?? "Unable to draft the notice. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.notice_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout
      requirePro
      title="Notice Drafting Helper"
      subtitle="Draft formal legal notices on your device — powered by a local AI model, never a cloud API"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Model banner */}
        <div className="vk-card p-4 flex items-start gap-3" style={{ borderColor: "rgba(34,197,94,0.3)" }}>
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
          <p className="text-xs leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
            <span className="font-semibold" style={{ color: "#4ade80" }}>Open-model drafting.</span>{" "}
            This tool uses a configurable open LLM — a hosted open model (e.g. Mistral via
            HuggingFace) or a local model (Ollama), set by your admin. It{" "}
            <span className="font-semibold">does not use Claude</span>.
          </p>
        </div>

        {/* Input */}
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
            <h3 className="font-semibold text-sm">Notice Details</h3>
            <span className="vk-badge vk-badge-muted text-[10px] ml-auto">Local AI</span>
          </div>

          <div>
            <label className="vk-label">Notice Type</label>
            <select
              className="vk-input w-full"
              value={noticeType}
              onChange={(e) => setNoticeType(e.target.value)}
            >
              {NOTICE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="vk-label">Client / Sender Name *</label>
              <input
                className="vk-input w-full"
                placeholder="e.g. Mr. Rakesh Sharma"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
              />
            </div>
            <div>
              <label className="vk-label">Client Address / Details</label>
              <input
                className="vk-input w-full"
                placeholder="Address, PAN, etc. (optional)"
                value={senderDetails}
                onChange={(e) => setSenderDetails(e.target.value)}
              />
            </div>
            <div>
              <label className="vk-label">Recipient / Noticee Name *</label>
              <input
                className="vk-input w-full"
                placeholder="e.g. M/s ABC Traders"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div>
              <label className="vk-label">Recipient Address / Details</label>
              <input
                className="vk-input w-full"
                placeholder="Address (optional)"
                value={recipientDetails}
                onChange={(e) => setRecipientDetails(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="vk-label">Facts / Background *</label>
            <textarea
              className="vk-input w-full h-28 resize-none"
              placeholder="Describe the dispute: what happened, dates, amounts, cheque numbers, agreement terms, etc."
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
            />
          </div>

          <div>
            <label className="vk-label">Demand / Relief Sought *</label>
            <textarea
              className="vk-input w-full h-20 resize-none"
              placeholder="e.g. Pay ₹4,50,000 with interest, vacate the premises, cure the breach within the notice period."
              value={demand}
              onChange={(e) => setDemand(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="vk-label">Compliance Period (days)</label>
              <input
                type="number"
                min={1}
                max={90}
                className="vk-input w-full"
                value={complianceDays}
                onChange={(e) => setComplianceDays(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="vk-label">Issuing Advocate Name</label>
              <input
                className="vk-input w-full"
                placeholder="Your name (optional)"
                value={advocateName}
                onChange={(e) => setAdvocateName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="vk-label">Additional Instructions</label>
            <input
              className="vk-input w-full"
              placeholder="e.g. Mention the earlier reminder dated 01/01/2026 (optional)"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </div>

          <button
            className="btn-primary py-2.5 px-6 flex items-center gap-2"
            onClick={handleDraft}
            disabled={loading || !canSubmit}
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Drafting locally…" : "Draft Notice"}
          </button>
        </div>

        {loading && <div className="vk-skeleton h-64 rounded-xl" />}

        {error && !loading && (
          <div className="vk-card p-4 flex items-start gap-3" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold" style={{ color: "var(--vk-text)" }}>Draft Notice</h2>
              <div className="flex items-center gap-3">
                <p className="text-xs text-dim">
                  Drafted by <span style={{ color: "#4ade80" }}>{result.powered_by}</span>
                </p>
                <button
                  className="vk-badge vk-badge-muted text-xs py-1.5 px-3 flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="vk-card p-6">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed font-sans"
                style={{ color: "var(--vk-text)" }}
              >
                {result.notice_text}
              </pre>
            </div>

            <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
              This is an AI-generated first draft. Review every fact, statutory reference and figure,
              fill in all placeholders, and verify against the record before serving. The issuing
              advocate remains responsible for the final notice.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
