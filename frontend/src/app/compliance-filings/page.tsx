"use client";

import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { aiApi, backendApi } from "@/lib/api";
import {
  User, Building2, LayoutDashboard, FileText, Calendar,
  MessageSquare, Folder, AlertCircle, CheckCircle, Clock,
  TrendingUp, Shield, Zap, ChevronRight, Plus, AlertTriangle,
  RefreshCw, Download, Send, Loader2, BadgeCheck, XCircle,
  Receipt, Users, Key, Home, Car, Briefcase, DollarSign,
  BarChart3, Activity, Bell, Archive, Lock,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityMode = "individual" | "company";

type IndTab = "dashboard" | "itr" | "gst" | "property" | "calendar" | "ai";
type CompTab = "dashboard" | "roc" | "gst-tax" | "labour" | "calendar" | "ai" | "vault";

type FilingStatus = "filed" | "in-review" | "pending" | "overdue" | "na";

interface FilingItem {
  id: string;
  label: string;
  detail: string;
  due?: string;
  status: FilingStatus;
  category: string;
}

interface ComplianceCard {
  id: string;
  title: string;
  status: FilingStatus;
  dueDate: string;
  description: string;
  icon: React.ElementType;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FilingStatus, { label: string; badge: string; icon: React.ElementType }> = {
  filed:      { label: "Filed",      badge: "vk-badge-green", icon: CheckCircle },
  "in-review":{ label: "In Review",  badge: "vk-badge-blue",  icon: RefreshCw },
  pending:    { label: "Pending",    badge: "vk-badge-gold",  icon: Clock },
  overdue:    { label: "Overdue",    badge: "vk-badge-red",   icon: AlertCircle },
  na:         { label: "N/A",        badge: "vk-badge-muted", icon: XCircle },
};

const ROC_FILINGS: FilingItem[] = [
  { id: "aoc4",         label: "AOC-4 Filing",                  detail: "Financial Statements with MCA",              due: "2025-10-29", status: "pending",    category: "MCA" },
  { id: "mgt7",         label: "MGT-7 Annual Return",           detail: "Annual Return with MCA",                     due: "2025-11-29", status: "pending",    category: "MCA" },
  { id: "adt1",         label: "ADT-1 Auditor Appointment",     detail: "Auditor intimation to MCA",                  due: "2025-10-15", status: "filed",      category: "MCA" },
  { id: "dir3kyc",      label: "DIR-3 KYC",                     detail: "Director KYC — 2 Directors",                 due: "2025-09-30", status: "in-review",  category: "Director" },
  { id: "dir8",         label: "DIR-8 Declaration",             detail: "Disqualification declaration by Directors",  due: "2025-10-01", status: "pending",    category: "Director" },
  { id: "mbp1",         label: "MBP-1 Interest Disclosure",     detail: "Notice of interest by Directors",            due: "2025-04-01", status: "filed",      category: "Director" },
  { id: "agm",          label: "AGM Notice & Resolution",       detail: "Annual General Meeting",                     due: "2025-09-30", status: "pending",    category: "Corporate" },
  { id: "directors_rep",label: "Directors Report",              detail: "Statutory report — Board of Directors",      due: "2025-10-01", status: "pending",    category: "Corporate" },
  { id: "shareholders", label: "Shareholder Register",          detail: "List of Members under Companies Act",        due: "2025-10-01", status: "filed",      category: "Corporate" },
  { id: "directors_lst",label: "Directors Register",            detail: "Updated list with DIN details",              due: "2025-10-01", status: "filed",      category: "Corporate" },
  { id: "auditor_cons", label: "Auditor Consent & Appointment", detail: "Letter of consent from statutory auditor",   due: "2025-10-01", status: "in-review",  category: "Audit" },
  { id: "auditor_res",  label: "Auditor Board Resolution",      detail: "Board resolution for auditor appointment",   due: "2025-10-01", status: "pending",    category: "Audit" },
  { id: "bookkeeping",  label: "Accounting & Book Keeping",     detail: "Up to 300 transactions / month",             due: "Monthly",    status: "in-review",  category: "Accounting" },
  { id: "itr_company",  label: "Company ITR Filing",            detail: "Income Tax Return for the entity",           due: "2025-10-31", status: "pending",    category: "Tax" },
];

const INDIVIDUAL_CARDS: ComplianceCard[] = [
  { id: "itr",      title: "Income Tax Return",     status: "pending",    dueDate: "31 Jul 2025", description: "ITR-1 / ITR-2 for FY 2024-25",            icon: Receipt },
  { id: "gst",      title: "GST Filing",            status: "filed",      dueDate: "20 Jun 2026", description: "GSTR-3B monthly return",                  icon: BarChart3 },
  { id: "property", title: "Property Tax",          status: "pending",    dueDate: "30 Jun 2026", description: "Municipal property tax — annual",         icon: Home },
  { id: "vehicle",  title: "Vehicle Tax / Permit",  status: "filed",      dueDate: "31 Mar 2027", description: "Road tax and permit renewal",              icon: Car },
  { id: "pt",       title: "Professional Tax",      status: "overdue",    dueDate: "30 Apr 2026", description: "State professional tax — annual",         icon: Briefcase },
  { id: "capital",  title: "Capital Gains",         status: "na",         dueDate: "31 Jul 2025", description: "Equity, MF, property capital gains",      icon: TrendingUp },
];

const CALENDAR_EVENTS = [
  { date: "2026-07-11", label: "GSTR-1 (June)",          category: "GST",        priority: "high" },
  { date: "2026-07-15", label: "Advance Tax (Q1)",        category: "Income Tax", priority: "high" },
  { date: "2026-07-20", label: "GSTR-3B (June)",          category: "GST",        priority: "high" },
  { date: "2026-07-31", label: "ITR Filing Deadline",     category: "Income Tax", priority: "critical" },
  { date: "2026-07-31", label: "TDS Return (Q1)",         category: "TDS",        priority: "high" },
  { date: "2026-08-11", label: "GSTR-1 (July)",           category: "GST",        priority: "medium" },
  { date: "2026-08-20", label: "GSTR-3B (July)",          category: "GST",        priority: "medium" },
  { date: "2026-09-15", label: "Advance Tax (Q2)",        category: "Income Tax", priority: "high" },
  { date: "2026-09-30", label: "DIR-3 KYC Deadline",      category: "MCA",        priority: "high" },
  { date: "2026-09-30", label: "AGM Deadline",            category: "Corporate",  priority: "high" },
  { date: "2026-10-29", label: "AOC-4 Filing",            category: "MCA",        priority: "critical" },
  { date: "2026-10-31", label: "Company ITR",             category: "Income Tax", priority: "critical" },
  { date: "2026-11-29", label: "MGT-7 Annual Return",     category: "MCA",        priority: "critical" },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#60a5fa",
  low:      "#4ade80",
};

const CATEGORY_BADGES: Record<string, string> = {
  "GST":        "vk-badge-gold",
  "Income Tax": "vk-badge-blue",
  "MCA":        "vk-badge-green",
  "TDS":        "vk-badge-blue",
  "Corporate":  "vk-badge-muted",
  "Director":   "vk-badge-muted",
  "Accounting": "vk-badge-muted",
  "Audit":      "vk-badge-muted",
  "Tax":        "vk-badge-blue",
};

const VAULT_DOCS = [
  { name: "PAN Card",                category: "Identity",     status: "verified",  expires: null },
  { name: "GST Registration Cert.",  category: "GST",          status: "active",    expires: "2027-03-31" },
  { name: "Certificate of Incorp.",  category: "Corporate",    status: "active",    expires: null },
  { name: "MOA & AOA",               category: "Corporate",    status: "active",    expires: null },
  { name: "Auditor Appointment Ltr", category: "Audit",        status: "active",    expires: "2026-09-30" },
  { name: "ITR-V FY 2023-24",        category: "Tax",          status: "filed",     expires: null },
  { name: "Financial Statements",    category: "Accounting",   status: "pending",   expires: null },
  { name: "DIR-3 KYC Receipt",       category: "Director",     status: "expiring",  expires: "2026-09-30" },
];

const QUICK_PROMPTS = [
  "What are my pending ROC compliances this month?",
  "Generate an AGM notice for September 2026",
  "Explain DIR-3 KYC requirements",
  "List all overdue filings and penalties",
  "Draft a board resolution for auditor appointment",
  "What documents are needed for AOC-4 filing?",
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function FilingStatusBadge({ status }: { status: FilingStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`vk-badge ${cfg.badge} flex items-center gap-1 text-[10px]`}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Individual Sections ───────────────────────────────────────────────────────

function IndividualDashboard() {
  const score = 68;
  const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Top row: score + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="vk-card p-5 flex items-center gap-5">
          <div className="relative shrink-0">
            <ScoreRing score={score} size={88} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold" style={{ color: scoreColor }}>{score}</span>
              <span className="text-[9px] text-dim">/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-0.5">Compliance Score</p>
            <p className="text-xs text-dim mb-2">2 overdue · 3 upcoming</p>
            <span className="vk-badge vk-badge-gold text-[10px]">Needs Attention</span>
          </div>
        </div>

        <div className="vk-card p-5 space-y-3">
          <p className="text-xs font-semibold text-dim uppercase tracking-wider">Critical Deadlines</p>
          {[
            { label: "ITR Filing FY 2024-25", due: "31 Jul 2025", days: 42, color: "#f59e0b" },
            { label: "Professional Tax",       due: "30 Apr 2026", days: -50, color: "#ef4444" },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--vk-text)" }}>{d.label}</span>
              <span className="font-bold" style={{ color: d.color }}>
                {d.days < 0 ? `${Math.abs(d.days)}d overdue` : `${d.days}d left`}
              </span>
            </div>
          ))}
        </div>

        <div className="vk-card p-5 space-y-3">
          <p className="text-xs font-semibold text-dim uppercase tracking-wider">Status Overview</p>
          {[
            { label: "PAN Status",            status: "Active",   color: "#22c55e" },
            { label: "Aadhaar-PAN Link",      status: "Linked",   color: "#22c55e" },
            { label: "GST Registration",      status: "Active",   color: "#22c55e" },
            { label: "TDS Refund (AY24-25)",  status: "Pending",  color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--vk-text-muted)" }}>{s.label}</span>
              <span className="font-semibold" style={{ color: s.color }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">Your Compliance Areas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INDIVIDUAL_CARDS.map((card) => {
            const cfg = STATUS_CONFIG[card.status];
            const Icon = card.icon;
            const StatusIcon = cfg.icon;
            return (
              <div key={card.id} className="vk-card vk-card-hover p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                    <Icon className="w-4 h-4 text-gold" />
                  </div>
                  <span className={`vk-badge ${cfg.badge} flex items-center gap-1 text-[10px]`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm font-semibold mb-0.5">{card.title}</p>
                <p className="text-xs text-dim mb-2">{card.description}</p>
                <div className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-dim" />
                  <span className="text-dim">Due: <span style={{ color: "var(--vk-text-muted)" }}>{card.dueDate}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ITRFiling() {
  const [step, setStep] = useState<"form" | "checklist">("form");
  const [form, setForm] = useState({
    pan: "", aadhaar: "", fy: "2024-25", itr_type: "ITR-1",
    salary: "", business: "", capital_gains: "", rental: "",
    deductions_80c: "", deductions_80d: "", tds_paid: "",
  });

  const checklist = [
    { item: "Form 16 from employer",          done: !!form.salary },
    { item: "Bank statements (all accounts)", done: false },
    { item: "Investment proofs (80C/80D)",    done: !!form.deductions_80c },
    { item: "Capital gains statement",        done: !!form.capital_gains },
    { item: "Rental receipts / agreement",    done: !!form.rental },
    { item: "Aadhaar-PAN linkage verified",   done: !!form.aadhaar },
    { item: "26AS / AIS downloaded",          done: !!form.tds_paid },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {(["form", "checklist"] as const).map((s) => (
          <button key={s} onClick={() => setStep(s)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={step === s ? { background: "linear-gradient(135deg,var(--vk-gold),var(--vk-gold-dark))", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}>
            {s === "form" ? "Filing Details" : "Document Checklist"}
          </button>
        ))}
      </div>

      {step === "form" && (
        <div className="vk-card p-6 space-y-5">
          <h2 className="font-semibold">Income Tax Return — FY {form.fy}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="vk-label">PAN *</label>
              <input className="vk-input" placeholder="ABCDE1234F" value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="vk-label">Aadhaar</label>
              <input className="vk-input" placeholder="1234 5678 9012" value={form.aadhaar} onChange={(e) => setForm((f) => ({ ...f, aadhaar: e.target.value }))} />
            </div>
            <div>
              <label className="vk-label">Financial Year</label>
              <select className="vk-input" value={form.fy} onChange={(e) => setForm((f) => ({ ...f, fy: e.target.value }))}>
                {["2024-25", "2023-24", "2022-23"].map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="vk-label">ITR Form Type</label>
              <select className="vk-input" value={form.itr_type} onChange={(e) => setForm((f) => ({ ...f, itr_type: e.target.value }))}>
                {["ITR-1 (Salary/Pension)", "ITR-2 (Capital Gains)", "ITR-3 (Business)", "ITR-4 (Presumptive)"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">Income Sources (₹)</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "salary",        label: "Salary Income" },
                { key: "business",      label: "Business / Profession" },
                { key: "capital_gains", label: "Capital Gains" },
                { key: "rental",        label: "Rental Income" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="vk-label">{label}</label>
                  <input className="vk-input" placeholder="0" type="number"
                    value={(form as Record<string,string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">Deductions & Tax Paid (₹)</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "deductions_80c", label: "80C Deductions (max ₹1.5L)" },
                { key: "deductions_80d", label: "80D Health Insurance" },
                { key: "tds_paid",       label: "TDS / Advance Tax Paid" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="vk-label">{label}</label>
                  <input className="vk-input" placeholder="0" type="number"
                    value={(form as Record<string,string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary text-sm" onClick={() => setStep("checklist")}>View Checklist</button>
            <button className="btn-primary text-sm" onClick={() => { setStep("checklist"); toast.success("Filing package generated"); }}>
              Generate Filing Package
            </button>
          </div>
        </div>
      )}

      {step === "checklist" && (
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Document Checklist</h2>
            <span className="text-xs text-dim">{checklist.filter((c) => c.done).length}/{checklist.length} ready</span>
          </div>
          <div className="space-y-2">
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: "var(--vk-navy-light)" }}>
                {c.done
                  ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  : <Clock className="w-4 h-4 text-yellow-400 shrink-0" />}
                <span className="text-sm" style={{ color: c.done ? "var(--vk-text)" : "var(--vk-text-muted)" }}>{c.item}</span>
              </div>
            ))}
          </div>
          <div className="vk-disclaimer text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>ITR filing due date: <strong>31 July 2025</strong> for non-audit cases. Penalty of ₹5,000 for late filing after due date.</span>
          </div>
          <button className="btn-primary text-sm w-full" onClick={() => toast.success("Filing guidance sent to your email")}>
            Get AI Filing Guidance
          </button>
        </div>
      )}
    </div>
  );
}

function GSTSection({ mode }: { mode: "individual" | "company" }) {
  const returns = [
    { form: "GSTR-1",  period: "May 2026",  due: "11 Jun 2026",  status: "filed"      as FilingStatus },
    { form: "GSTR-3B", period: "May 2026",  due: "20 Jun 2026",  status: "filed"      as FilingStatus },
    { form: "GSTR-1",  period: "Jun 2026",  due: "11 Jul 2026",  status: "pending"    as FilingStatus },
    { form: "GSTR-3B", period: "Jun 2026",  due: "20 Jul 2026",  status: "pending"    as FilingStatus },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "GST Number",    value: "27AABCU9603R1ZM", icon: Key },
          { label: "Registration",  value: "Active",           icon: BadgeCheck },
          { label: "Filing Method", value: "Monthly",          icon: RefreshCw },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="vk-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs text-dim">{label}</span>
            </div>
            <p className="text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="vk-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--vk-border)" }}>
          <h3 className="text-sm font-semibold">Return Filing History</h3>
          <button className="btn-secondary text-xs py-1.5">+ File Now</button>
        </div>
        <table className="vk-table w-full">
          <thead>
            <tr>
              <th>Form</th>
              <th>Period</th>
              <th>Due Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r, i) => (
              <tr key={i}>
                <td><span className="font-mono text-xs font-semibold text-gold">{r.form}</span></td>
                <td>{r.period}</td>
                <td>{r.due}</td>
                <td><FilingStatusBadge status={r.status} /></td>
                <td>
                  {r.status === "pending" && (
                    <button className="text-xs text-gold hover:underline">File →</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vk-card p-4">
        <h3 className="text-sm font-semibold mb-3">GST Notices</h3>
        <div className="flex items-center gap-3 text-xs text-dim p-3 rounded-lg" style={{ background: "var(--vk-navy-light)" }}>
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <span>No pending GST notices. All returns are up to date.</span>
        </div>
      </div>
    </div>
  );
}

function PropertyCompliance() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "Property Tax",      status: "pending" as FilingStatus,  due: "30 Jun 2026", desc: "Annual municipal property tax",       icon: Home },
          { title: "Mutation Status",   status: "filed"   as FilingStatus,  due: "N/A",          desc: "Revenue record updated",              icon: FileText },
          { title: "Sale Deed",         status: "filed"   as FilingStatus,  due: "N/A",          desc: "Registered — Sub-Registrar Office",   icon: Archive },
          { title: "Encumbrance Cert.", status: "pending" as FilingStatus,  due: "Renewal due",  desc: "EC from Sub-Registrar",               icon: Lock },
        ].map(({ title, status, due, desc, icon: Icon }) => (
          <div key={title} className="vk-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--vk-gold-dim)" }}>
                <Icon className="w-4 h-4 text-gold" />
              </div>
              <FilingStatusBadge status={status} />
            </div>
            <p className="text-sm font-semibold mb-0.5">{title}</p>
            <p className="text-xs text-dim mb-1">{desc}</p>
            <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>Due: {due}</p>
          </div>
        ))}
      </div>

      <div className="vk-card p-5">
        <h3 className="text-sm font-semibold mb-3">Legal Notice Tracker</h3>
        <div className="space-y-2">
          {[
            { type: "Consumer Notice", from: "NCDRC", received: "12 May 2026", status: "pending" as FilingStatus },
          ].length > 0 ? (
            [{ type: "Consumer Notice", from: "NCDRC", received: "12 May 2026", status: "pending" as FilingStatus }].map((n, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-4 py-2.5 text-xs" style={{ background: "var(--vk-navy-light)" }}>
                <div>
                  <span className="font-semibold">{n.type}</span>
                  <span className="text-dim ml-2">from {n.from} · {n.received}</span>
                </div>
                <FilingStatusBadge status={n.status} />
              </div>
            ))
          ) : (
            <p className="text-xs text-dim">No pending legal notices.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Company Sections ──────────────────────────────────────────────────────────

function CompanyDashboard({ companyType }: { companyType: string }) {
  const score = 72;
  const scoreColor = "#f59e0b";

  const statusGrid = [
    { label: "GST",       status: "Active",   color: "#22c55e" },
    { label: "MCA/ROC",   status: "Partial",  color: "#f59e0b" },
    { label: "Income Tax",status: "Pending",  color: "#f59e0b" },
    { label: "TDS",       status: "Active",   color: "#22c55e" },
    { label: "PF",        status: "Active",   color: "#22c55e" },
    { label: "ESI",       status: "N/A",      color: "#64748b" },
  ];

  const overdue = ROC_FILINGS.filter((f) => f.status === "overdue");
  const upcoming = ROC_FILINGS.filter((f) => f.status === "pending").slice(0, 4);

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vk-card p-4 flex items-center gap-4">
          <div className="relative shrink-0">
            <ScoreRing score={score} size={72} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold" style={{ color: scoreColor }}>{score}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-dim">Compliance</p>
            <p className="text-sm font-bold">Health Score</p>
            <span className="vk-badge vk-badge-gold text-[10px]">Moderate</span>
          </div>
        </div>
        {[
          { label: "Upcoming (30d)", value: upcoming.length, icon: Clock,         color: "#f59e0b" },
          { label: "Overdue",        value: overdue.length,  icon: AlertCircle,   color: "#ef4444" },
          { label: "Filed (FY25)",   value: 6,               icon: CheckCircle,   color: "#22c55e" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="vk-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs text-dim">{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="vk-card p-5">
          <h3 className="text-sm font-semibold mb-3">Upcoming Filings</h3>
          <div className="space-y-2">
            {upcoming.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "var(--vk-navy-light)" }}>
                <div>
                  <span className="font-medium" style={{ color: "var(--vk-text)" }}>{f.label}</span>
                  <span className="text-dim ml-2">{f.due}</span>
                </div>
                <FilingStatusBadge status={f.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Status grid */}
        <div className="vk-card p-5">
          <h3 className="text-sm font-semibold mb-3">Statutory Status</h3>
          <div className="grid grid-cols-2 gap-2">
            {statusGrid.map((s) => (
              <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "var(--vk-navy-light)" }}>
                <span style={{ color: "var(--vk-text-muted)" }}>{s.label}</span>
                <span className="font-semibold" style={{ color: s.color }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Penalties exposure */}
      <div className="vk-card p-4" style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.03)" }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400">Penalties Exposure</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { label: "Late AGM",    amount: "₹10,000 – ₹1,00,000" },
            { label: "Late AOC-4",  amount: "₹100/day" },
            { label: "Late MGT-7",  amount: "₹100/day" },
          ].map((p) => (
            <div key={p.label} className="rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.08)" }}>
              <p className="text-dim">{p.label}</p>
              <p className="font-bold text-red-400">{p.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ROCFilings() {
  const [filter, setFilter] = useState<FilingStatus | "all">("all");
  const categories = ["all", ...Array.from(new Set(ROC_FILINGS.map((f) => f.category)))];
  const [catFilter, setCatFilter] = useState("all");
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = ROC_FILINGS.filter((f) =>
    (filter === "all" || f.status === filter) &&
    (catFilter === "all" || f.category === catFilter)
  );

  const handleGenerate = async (id: string, label: string) => {
    setGenerating(id);
    await new Promise((r) => setTimeout(r, 1200));
    setGenerating(null);
    toast.success(`${label} generated successfully`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
          {(["all", "pending", "in-review", "filed", "overdue"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
              style={filter === s ? { background: "var(--vk-gold)", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}>
              {s === "all" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
          {categories.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
              style={catFilter === c ? { background: "var(--vk-gold)", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((f) => (
          <div key={f.id} className="vk-card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-semibold">{f.label}</span>
                <span className={`vk-badge ${CATEGORY_BADGES[f.category] ?? "vk-badge-muted"} text-[10px]`}>{f.category}</span>
              </div>
              <p className="text-xs text-dim">{f.detail}</p>
              {f.due && <p className="text-[11px] mt-0.5" style={{ color: "var(--vk-text-muted)" }}>Due: {f.due}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FilingStatusBadge status={f.status} />
              <button
                onClick={() => handleGenerate(f.id, f.label)}
                disabled={generating === f.id}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                {generating === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabourCompliance() {
  const items = [
    { label: "PF Contribution (Jun 2026)",  due: "15 Jul 2026", status: "pending"    as FilingStatus, desc: "Employee + Employer PF @ 12% each" },
    { label: "ESI Contribution (Jun 2026)", due: "15 Jul 2026", status: "pending"    as FilingStatus, desc: "Employee + Employer ESI" },
    { label: "PF Annual Return",            due: "25 Apr 2026", status: "filed"      as FilingStatus, desc: "Form 3A / 6A annual return" },
    { label: "Labour Welfare Fund",         due: "31 Dec 2026", status: "pending"    as FilingStatus, desc: "State LWF contribution" },
    { label: "Professional Tax (Emp)",      due: "30 Jun 2026", status: "overdue"    as FilingStatus, desc: "Employer professional tax" },
    { label: "Minimum Wage Compliance",     due: "Ongoing",     status: "filed"      as FilingStatus, desc: "As per state notification" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {items.map((item) => (
        <div key={item.label} className="vk-card p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold">{item.label}</span>
            </div>
            <p className="text-xs text-dim">{item.desc}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--vk-text-muted)" }}>Due: {item.due}</p>
          </div>
          <FilingStatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

function ComplianceCalendar() {
  const grouped = CALENDAR_EVENTS.reduce((acc, e) => {
    const month = new Date(e.date).toLocaleString("en-IN", { month: "long", year: "numeric" });
    if (!acc[month]) acc[month] = [];
    acc[month].push(e);
    return acc;
  }, {} as Record<string, typeof CALENDAR_EVENTS>);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {Object.entries(grouped).map(([month, events]) => (
        <div key={month}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-2 px-1">{month}</h3>
          <div className="space-y-1.5">
            {events.sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => {
              const d = new Date(e.date);
              const today = new Date();
              const daysLeft = Math.ceil((d.getTime() - today.getTime()) / 86400000);
              return (
                <div key={i} className="vk-card p-3 flex items-center gap-4">
                  <div className="w-10 text-center shrink-0">
                    <p className="text-lg font-bold leading-none" style={{ color: "var(--vk-text)" }}>{d.getDate()}</p>
                    <p className="text-[10px] text-dim">{d.toLocaleString("en-IN", { weekday: "short" })}</p>
                  </div>
                  <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[e.priority] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.label}</p>
                    <span className={`vk-badge ${CATEGORY_BADGES[e.category] ?? "vk-badge-muted"} text-[10px]`}>{e.category}</span>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    {daysLeft < 0
                      ? <span className="font-bold text-red-400">{Math.abs(daysLeft)}d overdue</span>
                      : daysLeft === 0
                      ? <span className="font-bold text-red-400">Today</span>
                      : <span style={{ color: daysLeft <= 7 ? "#f59e0b" : "var(--vk-text-muted)" }}>{daysLeft}d left</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AIComplianceAssistant({ mode }: { mode: EntityMode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: `Hello! I'm your AI Compliance Assistant. I can help you with ${mode === "individual" ? "personal tax, ITR filing, GST, and property compliance" : "ROC filings, MCA compliances, GST, labour law, and company compliance"}. Ask me anything or use a quick prompt below.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const { data } = await aiApi.post("/ai/consult", {
        query: `[Compliance Assistant - ${mode}] ${userMsg}`,
        jurisdiction: "India",
      });
      setMessages((m) => [...m, { role: "ai", content: data.answer ?? data.content ?? "I can help with that. Please provide more details." }]);
    } catch {
      const fallback: Record<string, string> = {
        "pending roc": "Your pending ROC compliances include: AOC-4 (due 29 Oct), MGT-7 (due 29 Nov), Directors Report, AGM Notice, DIR-8, and Company ITR. Priority: file AGM first as it's a prerequisite.",
        "agm notice": "Here is a draft AGM Notice:\n\nNOTICE IS HEREBY GIVEN that the Annual General Meeting of [Company Name] will be held on [Date] at [Time] at the Registered Office.\n\nAGENDA:\n1. Adoption of Financial Statements\n2. Declaration of Dividend (if any)\n3. Appointment of Auditors\n4. Any other business with permission of the Chair.\n\nBy order of the Board\n[Director Name]\n[Date]",
        "dir-3": "DIR-3 KYC is mandatory for all directors with a DIN. It must be filed by 30th September each year. Required documents: PAN, Aadhaar, email (OTP verified), mobile (OTP verified). Filing fee: ₹500 per director if filed after deadline.",
        "overdue": "Overdue filings: Professional Tax (individual/employer). Penalties apply from the due date. File immediately to minimize penalty exposure.",
        "aoc-4": "AOC-4 requires: Audited Financial Statements (Balance Sheet, P&L, Cash Flow), Auditor Report, Board Report, and Form AOC-2 (if related party transactions). Due within 30 days of AGM. Penalty: ₹100/day of delay.",
      };
      const key = Object.keys(fallback).find((k) => userMsg.toLowerCase().includes(k));
      setMessages((m) => [...m, { role: "ai", content: key ? fallback[key] : "I can help with that compliance question. Based on Indian statutory requirements, here are the key points to consider for your situation. Please consult a CA or CS for specific filings." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-dim" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_PROMPTS.slice(0, 3).map((p) => (
          <button key={p} onClick={() => send(p)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)", color: "var(--vk-text-muted)" }}>
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="vk-input flex-1"
          placeholder="Ask about any compliance, filing, or deadline…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && send(input)}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary px-4">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DocumentVault() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dim">{VAULT_DOCS.length} documents · AI-classified</p>
        <button className="btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload Document
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VAULT_DOCS.map((doc, i) => {
          const statusColor = doc.status === "verified" || doc.status === "active" || doc.status === "filed"
            ? "#22c55e" : doc.status === "expiring" ? "#f59e0b" : "#94a3b8";
          return (
            <div key={i} className="vk-card vk-card-hover p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                <FileText className="w-4 h-4 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`vk-badge ${CATEGORY_BADGES[doc.category] ?? "vk-badge-muted"} text-[10px]`}>{doc.category}</span>
                  <span className="text-[11px] font-semibold capitalize" style={{ color: statusColor }}>{doc.status}</span>
                </div>
                {doc.expires && <p className="text-[11px] text-dim mt-0.5">Expires: {doc.expires}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button className="p-1.5 rounded-md transition-colors hover:bg-white/10" title="Download" style={{ color: "var(--vk-text-dim)" }}>
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vk-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold">Expiry Alerts</span>
        </div>
        <div className="space-y-2">
          {VAULT_DOCS.filter((d) => d.status === "expiring").map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span>{d.name}</span>
              <span className="font-bold text-yellow-400">Expires {d.expires}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComplianceFilingsPage() {
  const [entityMode, setEntityMode] = useState<EntityMode>("individual");
  const [indTab, setIndTab] = useState<IndTab>("dashboard");
  const [compTab, setCompTab] = useState<CompTab>("dashboard");
  const [companyType, setCompanyType] = useState("Private Limited");

  const IND_TABS: { key: IndTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
    { key: "itr",       label: "ITR Filing", icon: Receipt },
    { key: "gst",       label: "GST",        icon: BarChart3 },
    { key: "property",  label: "Property",   icon: Home },
    { key: "calendar",  label: "Calendar",   icon: Calendar },
    { key: "ai",        label: "AI Assistant",icon: MessageSquare },
  ];

  const COMP_TABS: { key: CompTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
    { key: "roc",       label: "ROC Filings", icon: Briefcase },
    { key: "gst-tax",   label: "GST & Tax",   icon: BarChart3 },
    { key: "labour",    label: "Labour & PF", icon: Users },
    { key: "calendar",  label: "Calendar",    icon: Calendar },
    { key: "ai",        label: "AI Assistant",icon: MessageSquare },
    { key: "vault",     label: "Doc Vault",   icon: Folder },
  ];

  const tabs = entityMode === "individual" ? IND_TABS : COMP_TABS;
  const activeTab = entityMode === "individual" ? indTab : compTab;
  const setTab = entityMode === "individual"
    ? (t: string) => setIndTab(t as IndTab)
    : (t: string) => setCompTab(t as CompTab);

  return (
    <AppLayout
      title="Compliance & Filings"
      subtitle="Track, manage, and file all statutory obligations — Individual & Business"
    >
      {/* Entity mode toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--vk-border)" }}>
          {(["individual", "company"] as const).map((m) => {
            const Icon = m === "individual" ? User : Building2;
            return (
              <button
                key={m}
                onClick={() => setEntityMode(m)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all"
                style={entityMode === m
                  ? { background: "linear-gradient(135deg,var(--vk-gold),var(--vk-gold-dark))", color: "var(--vk-navy)" }
                  : { background: "var(--vk-navy-light)", color: "var(--vk-text-muted)" }}
              >
                <Icon className="w-4 h-4" />
                {m === "individual" ? "Individual" : "Company / Business"}
              </button>
            );
          })}
        </div>

        {entityMode === "company" && (
          <select
            className="vk-input text-sm w-48"
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
          >
            {["Private Limited", "LLP", "One Person Company", "Partnership", "Sole Proprietorship", "Startup India", "Section 8 Company"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 mb-6 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
            style={activeTab === key
              ? { background: "linear-gradient(135deg,var(--vk-gold),var(--vk-gold-dark))", color: "var(--vk-navy)" }
              : { background: "var(--vk-navy-light)", color: "var(--vk-text-muted)", border: "1px solid var(--vk-border)" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {entityMode === "individual" && (
        <>
          {indTab === "dashboard" && <IndividualDashboard />}
          {indTab === "itr"       && <ITRFiling />}
          {indTab === "gst"       && <GSTSection mode="individual" />}
          {indTab === "property"  && <PropertyCompliance />}
          {indTab === "calendar"  && <ComplianceCalendar />}
          {indTab === "ai"        && <AIComplianceAssistant mode="individual" />}
        </>
      )}

      {entityMode === "company" && (
        <>
          {compTab === "dashboard" && <CompanyDashboard companyType={companyType} />}
          {compTab === "roc"       && <ROCFilings />}
          {compTab === "gst-tax"   && <GSTSection mode="company" />}
          {compTab === "labour"    && <LabourCompliance />}
          {compTab === "calendar"  && <ComplianceCalendar />}
          {compTab === "ai"        && <AIComplianceAssistant mode="company" />}
          {compTab === "vault"     && <DocumentVault />}
        </>
      )}
    </AppLayout>
  );
}
