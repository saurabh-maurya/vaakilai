"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Gavel, Download, ExternalLink, CheckCircle, Sparkles, AlertCircle } from "lucide-react";
import { backendApi } from "@/lib/api";

const MATTER_TYPES = [
  "Motor Accident Claim", "Consumer Dispute", "Cheque Bounce (Sec 138 NI Act)",
  "Matrimonial Property Dispute", "Labour Dispute", "Banking / Loan Recovery",
  "Commercial Contract Dispute", "Landlord-Tenant Dispute", "Insurance Claim",
  "Medical Negligence", "Neighbourhood Dispute", "Other",
];

const PLATFORMS = [
  { name: "Lok Adalat", url: "https://nalsa.gov.in", cost: "Free", desc: "National Legal Services Authority — state-organized mediation" },
  { name: "Presolv360", url: "https://presolv360.com", cost: "Nominal fee", desc: "India's leading ODR platform for commercial disputes" },
  { name: "SAMA", url: "https://sama.co.in", cost: "Nominal fee", desc: "SEBI-recognized ODR platform for investment disputes" },
];

export default function ODRPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wizardForm, setWizardForm] = useState({
    matter_type: MATTER_TYPES[0],
    dispute_summary: "",
    claimant_position: "",
    desired_outcome: "",
    claim_amount: "",
  });
  const [prepResult, setPrepResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    claimant_name: "", respondent_name: "", preferred_platform: "lok_adalat",
  });
  const [submitResult, setSubmitResult] = useState<any>(null);

  const handlePrepare = async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.post("/odr/prepare", {
        ...wizardForm,
        claim_amount: wizardForm.claim_amount ? parseFloat(wizardForm.claim_amount) : null,
      });
      setPrepResult(data);
      setStep(2);
    } catch { } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.post("/odr/submit", {
        ...wizardForm,
        ...submitForm,
        claim_amount: wizardForm.claim_amount ? parseFloat(wizardForm.claim_amount) : null,
      });
      setSubmitResult(data);
      setStep(3);
    } catch { } finally { setLoading(false); }
  };

  const handleDownload = () => {
    if (!prepResult) return;
    const content = `ODR CASE PREPARATION — VakilAI\n${"=".repeat(50)}\n\nMatter Type: ${wizardForm.matter_type}\nClaim Amount: ₹${wizardForm.claim_amount || "Not specified"}\n\nDISPUTE SUMMARY:\n${wizardForm.dispute_summary}\n\nAI ANALYSIS & PREPARATION:\n${"=".repeat(50)}\n${prepResult.ai_analysis}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `odr-preparation-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Lok Adalat / ODR" subtitle="AI-powered dispute resolution preparation and filing" requiredFeature="odr_filing">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Steps */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Dispute Details" },
            { n: 2, label: "AI Preparation" },
            { n: 3, label: "Submit / File" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${step >= s.n ? "text-navy" : "text-dim"}`}
                style={step >= s.n ? { background: "var(--vk-gold)" } : { background: "rgba(255,255,255,0.1)" }}>
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span className={`text-xs font-semibold ${step >= s.n ? "" : "text-dim"}`} style={step >= s.n ? { color: "var(--vk-text)" } : {}}>
                {s.label}
              </span>
              {i < 2 && <div className="flex-1 h-px" style={{ background: "var(--vk-border)" }} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="vk-card p-6 space-y-4">
            <h3 className="font-semibold">Describe Your Dispute</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="vk-label">Matter Type</label>
                <select className="vk-input w-full" value={wizardForm.matter_type} onChange={e => setWizardForm(f => ({ ...f, matter_type: e.target.value }))}>
                  {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="vk-label">Dispute Summary *</label>
                <textarea className="vk-input w-full h-24 resize-none" placeholder="Describe the dispute in detail — what happened, when, and what is the other party's position?" value={wizardForm.dispute_summary} onChange={e => setWizardForm(f => ({ ...f, dispute_summary: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Your Position / Claim</label>
                <textarea className="vk-input w-full h-20 resize-none" placeholder="Your side of the story and what you are claiming" value={wizardForm.claimant_position} onChange={e => setWizardForm(f => ({ ...f, claimant_position: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Desired Outcome</label>
                <textarea className="vk-input w-full h-20 resize-none" placeholder="What settlement or relief are you seeking?" value={wizardForm.desired_outcome} onChange={e => setWizardForm(f => ({ ...f, desired_outcome: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Claim Amount (₹)</label>
                <input className="vk-input w-full" type="number" placeholder="0" value={wizardForm.claim_amount} onChange={e => setWizardForm(f => ({ ...f, claim_amount: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary py-2.5 px-6 flex items-center gap-2" onClick={handlePrepare} disabled={loading || !wizardForm.dispute_summary}>
              <Sparkles className="w-4 h-4" />
              {loading ? "Generating AI Preparation..." : "Generate AI Preparation"}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && prepResult && (
          <div className="space-y-4">
            <div className="vk-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
                  AI Preparation Analysis
                </h3>
                <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
              <div className="prose-sm rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "rgba(255,255,255,0.03)", color: "var(--vk-text-muted)" }}>
                {prepResult.ai_analysis}
              </div>
            </div>

            {/* Filing platforms */}
            <div className="vk-card p-5 space-y-3">
              <h3 className="font-semibold text-sm">Where to File</h3>
              <div className="space-y-2">
                {PLATFORMS.map(p => (
                  <div key={p.name} className="flex items-center justify-between rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{p.name}</span>
                        <span className="vk-badge vk-badge-green text-[10px]">{p.cost}</span>
                      </div>
                      <p className="text-xs text-dim mt-0.5">{p.desc}</p>
                    </div>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-dim hover:text-white p-1.5 rounded">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
              {prepResult.odr_integration && (
                <div className="vk-disclaimer rounded-lg p-3 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 text-green-400" />
                  ODR provider integration active — you can submit directly from the next step.
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary py-2 px-4 text-sm" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary py-2 px-6 text-sm" onClick={() => setStep(3)}>Proceed to Submit</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && !submitResult && (
          <div className="vk-card p-6 space-y-4">
            <h3 className="font-semibold">Submit Case Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="vk-label">Your Name (Claimant)</label>
                <input className="vk-input w-full" value={submitForm.claimant_name} onChange={e => setSubmitForm(f => ({ ...f, claimant_name: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Respondent Name</label>
                <input className="vk-input w-full" value={submitForm.respondent_name} onChange={e => setSubmitForm(f => ({ ...f, respondent_name: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="vk-label">Preferred Platform</label>
                <select className="vk-input w-full" value={submitForm.preferred_platform} onChange={e => setSubmitForm(f => ({ ...f, preferred_platform: e.target.value }))}>
                  <option value="lok_adalat">Lok Adalat (Free)</option>
                  <option value="presolv360">Presolv360</option>
                  <option value="sama">SAMA</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary py-2 px-4 text-sm" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary py-2 px-6 text-sm flex items-center gap-2" onClick={handleSubmit} disabled={loading || !submitForm.claimant_name}>
                <Gavel className="w-4 h-4" />
                {loading ? "Submitting..." : "Submit Case"}
              </button>
            </div>
          </div>
        )}

        {submitResult && (
          <div className="vk-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-400">Case Submitted</h3>
                <p className="text-sm text-dim mt-1">{submitResult.provider_response?.instructions || "Your case has been recorded."}</p>
                {submitResult.provider_reference && (
                  <p className="text-xs text-dim mt-1">Reference: <span className="font-mono" style={{ color: "var(--vk-gold)" }}>{submitResult.provider_reference}</span></p>
                )}
              </div>
            </div>
            <button className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5" onClick={handleDownload}>
              <Download className="w-4 h-4" /> Download Preparation Document
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
          AI-generated preparation materials are for informational purposes only. Consult a qualified advocate before filing any dispute.
        </div>
      </div>
    </AppLayout>
  );
}
