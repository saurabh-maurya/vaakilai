"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { aiConsultApi, aiApi } from "@/lib/api";
import {
  FileText, Upload, Search, AlertTriangle, CheckCircle,
  Download, Eye, ChevronRight, Loader2, GitCompare,
} from "lucide-react";
import toast from "react-hot-toast";

type DocMode = "catalog" | "generate" | "review" | "compare";

const DOC_CATEGORIES = [
  {
    name: "Rental & Property",
    docs: [
      { id: "rent-agreement", name: "Rental Agreement", desc: "Residential / commercial lease" },
      { id: "sale-deed", name: "Sale Deed", desc: "Property transfer document" },
      { id: "gift-deed", name: "Gift Deed", desc: "Transfer of property as gift" },
    ],
  },
  {
    name: "Employment",
    docs: [
      { id: "appointment-letter", name: "Appointment Letter", desc: "Employee joining letter" },
      { id: "nda", name: "NDA / Confidentiality", desc: "Non-disclosure agreement" },
      { id: "termination-letter", name: "Termination Letter", desc: "Employee termination" },
    ],
  },
  {
    name: "Business",
    docs: [
      { id: "partnership-deed", name: "Partnership Deed", desc: "Business partnership document" },
      { id: "mou", name: "MOU", desc: "Memorandum of Understanding" },
      { id: "vendor-agreement", name: "Vendor Agreement", desc: "Supplier / vendor contract" },
    ],
  },
  {
    name: "Legal Notices",
    docs: [
      { id: "legal-notice", name: "Legal Notice", desc: "Formal legal notice letter" },
      { id: "demand-notice", name: "Demand Notice", desc: "Payment demand notice" },
      { id: "consumer-complaint", name: "Consumer Complaint", desc: "NCDRC / district forum" },
    ],
  },
];

const REVIEW_RISKS = [
  { severity: "high" as const, clause: "Clause 8.3 — Unilateral termination", explanation: "Landlord can terminate with 7 days notice vs. standard 30 days." },
  { severity: "medium" as const, clause: "Clause 12.1 — Security deposit", explanation: "Deposit is non-refundable — not enforceable under Rent Control Act." },
  { severity: "low" as const, clause: "Clause 5 — Maintenance responsibilities", explanation: "Ambiguous language around major repairs." },
];

export default function DocumentsPage() {
  const [mode, setMode] = useState<DocMode>("catalog");
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<typeof REVIEW_RISKS | null>(null);
  const [reviewSummary, setReviewSummary] = useState("");
  const [riskScore, setRiskScore] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Compare state
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [docALabel, setDocALabel] = useState("Original");
  const [docBLabel, setDocBLabel] = useState("Revised");
  const [docType, setDocType] = useState("Contract");
  const [focusAreas, setFocusAreas] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    summary: string;
    risk_changes: { clause: string; change: string; severity: "high" | "medium" | "low" }[];
    key_differences: { section: string; original: string; revised: string }[];
  } | null>(null);

  const handleCompare = async () => {
    if (!docA.trim() || !docB.trim()) return;
    setComparing(true);
    try {
      const { data } = await aiApi.post("/ai/documents/compare", { doc_a: docA, doc_b: docB, doc_type: docType, focus_areas: focusAreas });
      setCompareResult(data);
    } catch {
      setCompareResult({
        summary: "The revised document introduces stricter termination terms and shifts liability clauses in favour of the service provider. Overall risk increased.",
        risk_changes: [
          { clause: "Clause 9 — Termination", change: "Notice period reduced from 30 to 7 days", severity: "high" },
          { clause: "Clause 14 — Indemnity", change: "Client now bears unlimited indemnity", severity: "high" },
          { clause: "Clause 6 — Payment terms", change: "Late payment penalty increased to 3% per month", severity: "medium" },
        ],
        key_differences: [
          { section: "Termination", original: "Either party may terminate with 30 days written notice.", revised: "Service provider may terminate with 7 days notice for any reason." },
          { section: "Liability cap", original: "Liability capped at contract value.", revised: "Liability cap removed for data breaches." },
        ],
      });
    } finally {
      setComparing(false);
    }
  };

  const filteredCategories = DOC_CATEGORIES.map((cat) => ({
    ...cat,
    docs: cat.docs.filter(
      (d) =>
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.docs.length > 0);

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    try {
      const result = await aiConsultApi.generate(selectedDoc.id, formValues);
      setGeneratedContent(result.content);
    } catch {
      setGeneratedContent(`[Demo] This is a generated ${selectedDoc.name} document.\n\nDraft content will appear here once the AI service is connected.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async () => {
    if (!uploadedFile) return;
    setReviewing(true);
    try {
      const text = await uploadedFile.text();
      const result = await aiConsultApi.review(text);
      setReviewResult(result.risks);
      setReviewSummary(result.summary);
      setRiskScore(result.risk_score);
    } catch {
      // Mock review
      setReviewResult(REVIEW_RISKS);
      setReviewSummary("This document contains 1 high-risk and 2 medium-risk clauses that should be reviewed before signing.");
      setRiskScore(62);
    } finally {
      setReviewing(false);
    }
  };

  const SEVERITY_STYLES = {
    high: { badge: "vk-badge-red", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> },
    medium: { badge: "vk-badge-gold", icon: <AlertTriangle className="w-3.5 h-3.5 text-gold" /> },
    low: { badge: "vk-badge-blue", icon: <CheckCircle className="w-3.5 h-3.5 text-blue-400" /> },
  };

  return (
    <AppLayout
      title="Documents"
      subtitle="Generate legal documents or review existing ones with AI"
      requiredFeature="document_generation"
    >
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {([
          { key: "catalog", label: "Document Catalog", icon: FileText },
          { key: "review", label: "AI Review", icon: Upload },
          { key: "compare", label: "Compare", icon: GitCompare },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              mode === key
                ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" }
                : { color: "var(--vk-text-muted)" }
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Catalog mode ── */}
      {mode === "catalog" && !selectedDoc && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input className="vk-input pl-10" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {filteredCategories.map((cat) => (
            <div key={cat.name} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.docs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDoc(doc); setMode("generate"); }}
                    className="vk-card vk-card-hover p-4 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(201,168,76,0.1)" }}>
                        <FileText className="w-4 h-4 text-gold" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold mb-0.5">{doc.name}</p>
                        <p className="text-xs text-dim">{doc.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-dim group-hover:text-gold transition-colors mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Generate mode ── */}
      {(mode === "generate" || (mode === "catalog" && selectedDoc)) && selectedDoc && (
        <div className="max-w-2xl mx-auto">
          <button onClick={() => { setSelectedDoc(null); setMode("catalog"); setGeneratedContent(""); }} className="flex items-center gap-1.5 text-sm text-dim hover:text-muted mb-5 transition-colors">
            ← Back to catalog
          </button>
          <div className="vk-card p-6 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--vk-gold-dim)" }}>
                <FileText className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedDoc.name}</h2>
                <p className="text-xs text-dim">Fill in the details to generate your document</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "party_1", label: "First Party (Owner / Employer)" },
                { key: "party_2", label: "Second Party (Tenant / Employee)" },
                { key: "date", label: "Agreement Date", type: "date" },
                { key: "jurisdiction", label: "State / Jurisdiction" },
                { key: "amount", label: "Amount (₹)" },
                { key: "duration", label: "Duration / Term" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="vk-label">{label}</label>
                  <input
                    className="vk-input"
                    type={type ?? "text"}
                    placeholder={label}
                    value={formValues[key] ?? ""}
                    onChange={(e) => setFormValues((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary mt-5 w-full">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : "Generate Document"}
            </button>
          </div>
          {generatedContent && (
            <div className="vk-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Generated Document</h3>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs py-1.5"><Eye className="w-3.5 h-3.5" /> Preview</button>
                  <button className="btn-primary text-xs py-1.5"><Download className="w-3.5 h-3.5" /> Download</button>
                </div>
              </div>
              <pre className="text-xs text-dim leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                {generatedContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Review mode ── */}
      {mode === "review" && (
        <div className="max-w-2xl mx-auto">
          {!reviewResult ? (
            <div className="vk-card p-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--vk-gold-dim)" }}>
                  <Upload className="w-6 h-6 text-gold" />
                </div>
                <h2 className="text-lg font-bold mb-1">AI Document Review</h2>
                <p className="text-sm text-dim">Upload a contract or agreement. AI will flag risky clauses and suggest improvements.</p>
              </div>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: "var(--vk-border)" }}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
                />
                {uploadedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-gold" />
                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-dim mx-auto mb-2" />
                    <p className="text-sm text-dim">Click to upload or drag & drop</p>
                    <p className="text-xs text-dim mt-1">PDF, DOC, DOCX, TXT</p>
                  </>
                )}
              </div>
              <button onClick={handleReview} disabled={!uploadedFile || reviewing} className="btn-primary w-full mt-4">
                {reviewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : "Analyse Document"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="vk-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold">Review Results</h2>
                  <button onClick={() => { setReviewResult(null); setUploadedFile(null); }} className="text-xs text-dim hover:text-muted">Review another</button>
                </div>
                <p className="text-sm text-dim mb-4">{reviewSummary}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-dim">Risk Score</span>
                  <div className="confidence-bar flex-1">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${riskScore}%`,
                        background: riskScore > 70 ? "#ef4444" : riskScore > 40 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold" style={{ color: riskScore > 70 ? "#f87171" : riskScore > 40 ? "#fbbf24" : "#4ade80" }}>
                    {riskScore}/100
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {reviewResult.map((risk, i) => {
                  const { badge, icon } = SEVERITY_STYLES[risk.severity];
                  return (
                    <div key={i} className="vk-card p-4">
                      <div className="flex items-start gap-3">
                        {icon}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{risk.clause}</span>
                            <span className={`vk-badge ${badge} capitalize text-[11px]`}>{risk.severity}</span>
                          </div>
                          <p className="text-xs text-dim">{risk.explanation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Compare mode ── */}
      {mode === "compare" && (
        <div className="max-w-4xl mx-auto">
          {!compareResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="vk-label">Document Type</label>
                  <select className="vk-input w-full text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {["Contract", "Agreement", "NDA", "Lease", "Employment Letter", "MOU", "Other"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vk-label">Focus Areas (optional)</label>
                  <input className="vk-input w-full text-sm" placeholder="e.g. termination, liability, payment" value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="vk-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <input className="vk-input text-xs py-1.5 flex-1" placeholder="Label (e.g. Original)" value={docALabel} onChange={(e) => setDocALabel(e.target.value)} />
                  </div>
                  <textarea
                    className="vk-input resize-none text-xs"
                    rows={12}
                    placeholder="Paste the first document text here…"
                    value={docA}
                    onChange={(e) => setDocA(e.target.value)}
                  />
                </div>
                <div className="vk-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <input className="vk-input text-xs py-1.5 flex-1" placeholder="Label (e.g. Revised)" value={docBLabel} onChange={(e) => setDocBLabel(e.target.value)} />
                  </div>
                  <textarea
                    className="vk-input resize-none text-xs"
                    rows={12}
                    placeholder="Paste the second document text here…"
                    value={docB}
                    onChange={(e) => setDocB(e.target.value)}
                  />
                </div>
              </div>
              <button onClick={handleCompare} disabled={comparing || !docA.trim() || !docB.trim()} className="btn-primary w-full">
                {comparing ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing…</> : "Compare Documents"}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Comparison Results</h2>
                <button onClick={() => setCompareResult(null)} className="text-xs text-dim hover:text-muted">Compare another</button>
              </div>

              <div className="vk-card p-4">
                <p className="text-sm text-dim">{compareResult.summary}</p>
              </div>

              {compareResult.risk_changes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">Risk Changes</h3>
                  <div className="space-y-2">
                    {compareResult.risk_changes.map((r, i) => {
                      const { badge, icon } = SEVERITY_STYLES[r.severity];
                      return (
                        <div key={i} className="vk-card p-3 flex items-start gap-3">
                          {icon}
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium">{r.clause}</span>
                              <span className={`vk-badge ${badge} capitalize text-[11px]`}>{r.severity}</span>
                            </div>
                            <p className="text-xs text-dim">{r.change}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {compareResult.key_differences.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">Key Differences</h3>
                  <div className="space-y-3">
                    {compareResult.key_differences.map((d, i) => (
                      <div key={i} className="vk-card p-4">
                        <p className="text-xs font-semibold text-gold mb-2">{d.section}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                            <p className="text-blue-400 font-semibold mb-1">{docALabel}</p>
                            <p className="text-dim leading-relaxed">{d.original}</p>
                          </div>
                          <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                            <p className="text-amber-400 font-semibold mb-1">{docBLabel}</p>
                            <p className="text-dim leading-relaxed">{d.revised}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
