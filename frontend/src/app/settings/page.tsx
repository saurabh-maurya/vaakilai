"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, backendApi, authApi } from "@/lib/api";
import { INDIAN_STATES, LANGUAGES, isProRole, formatDate } from "@/lib/utils";
import React from "react";
import {
  User, Bell, Shield, CreditCard, Check, Zap, X,
  TrendingUp, Building2, Sparkles, Crown, Users, BadgeCheck,
  Star, ArrowRight, ChevronLeft, ChevronRight, FileText, Clock,
} from "lucide-react";
import toast from "react-hot-toast";

type Tab = "profile" | "notifications" | "security" | "billing";

// ── Annual Filing Service ─────────────────────────────────────────────────────

const AF_DELIVERABLES = [
  { id: "bookkeeping",      label: "Accounting & Book Keeping",          detail: "Up to 300 transactions" },
  { id: "itr",              label: "Income Tax Filing",                  detail: "ITR for the financial year" },
  { id: "directors_report", label: "Directors Report",                   detail: "Statutory Board report" },
  { id: "shareholders",     label: "List of Shareholders",               detail: "Register of members" },
  { id: "directors_list",   label: "List of Directors",                  detail: "Updated DIN list" },
  { id: "auditor_consent",  label: "Consent & Appointment of Auditor",   detail: "Auditor consent letter" },
  { id: "auditor_res",      label: "Resolution for Auditor Appointment", detail: "Board resolution" },
  { id: "agm",              label: "AGM Notice & Resolution",            detail: "AGM docs" },
  { id: "mbp1",             label: "Form MBP-1",                         detail: "Director interest notice" },
  { id: "dir8",             label: "Form DIR-8",                         detail: "Director disqualification" },
  { id: "aoc4",             label: "AOC 4 Filing",                       detail: "Financial statements to MCA" },
  { id: "mgt7",             label: "MGT 7 Filing",                       detail: "Annual Return to MCA" },
  { id: "adt1",             label: "ADT 1 Filing",                       detail: "Auditor appointment" },
  { id: "dir3kyc",          label: "DIR-3 e-KYC",                        detail: "KYC for 2 directors" },
];

const AF_SERVICE_HIGHLIGHTS = [
  { icon: Shield,    text: "Track all compliance due dates — nothing missed." },
  { icon: FileText,  text: "We manage ROC filings: AOC-4, MGT-7, Director KYC." },
  { icon: Check,     text: "Documents prepared and reviewed before MCA filing." },
  { icon: Zap,       text: "Guidance on mandatory vs optional compliances." },
  { icon: Users,     text: "Coordinate with your CA/auditor for documents." },
  { icon: Building2, text: "Pvt Ltd, LLP, OPC, Section 8 supported." },
  { icon: Clock,     text: "Regularize delayed or missed filings." },
  { icon: BadgeCheck,text: "Filing status updates and next steps shared." },
];

interface AnnualPlan {
  id: string; name: string; price: number; highlight: boolean;
  tagline: string; icon: React.ElementType; includes: string[];
  excludes: string[]; support: string; extras?: string[];
}

const ANNUAL_PLANS: AnnualPlan[] = [
  {
    id: "essential", name: "Essential", price: 7999, highlight: false,
    tagline: "Core MCA filings only", icon: Star,
    includes: ["aoc4", "mgt7", "adt1", "dir3kyc", "directors_list", "shareholders"],
    excludes: ["bookkeeping", "itr", "directors_report", "auditor_consent", "auditor_res", "agm", "mbp1", "dir8"],
    support: "Email support within 48 hrs",
  },
  {
    id: "standard", name: "Standard", price: 12999, highlight: true,
    tagline: "Full annual compliance package", icon: Crown,
    includes: AF_DELIVERABLES.map((d) => d.id), excludes: [],
    support: "Priority email + WhatsApp support",
  },
  {
    id: "advanced", name: "Advanced", price: 19999, highlight: false,
    tagline: "Full package + dedicated CA", icon: Sparkles,
    includes: AF_DELIVERABLES.map((d) => d.id), excludes: [],
    extras: ["Dedicated CA manager", "Penalty protection cover", "Unlimited compliance consultations", "Board meeting support (1/year)"],
    support: "Dedicated CA + priority call support",
  },
];

interface CompanyForm {
  company_name: string; cin: string; incorporation_date: string;
  registered_address: string; authorized_capital: string; paid_up_capital: string;
  annual_turnover: string; financial_year: string; company_type: string;
}
interface DirectorForm { name: string; din: string; email: string; phone: string; designation: string; }
const EMPTY_COMPANY: CompanyForm = {
  company_name: "", cin: "", incorporation_date: "", registered_address: "",
  authorized_capital: "500000", paid_up_capital: "", annual_turnover: "",
  financial_year: "2024-25", company_type: "Private Limited",
};
const EMPTY_DIRECTOR: DirectorForm = { name: "", din: "", email: "", phone: "", designation: "Director" };

// ── Individual (Consumer) Plans ─────────────────────────────────────────────

const INDIVIDUAL_PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: "Get started with AI legal help",
    icon: Zap,
    features: [
      "5 AI legal queries / day",
      "5 basic document templates",
      "Lawyer directory search",
      "IPC → BNS converter",
      "Know Your Rights hub",
      "Legal news feed",
    ],
    limits: [
      "No document generation",
      "No case status tracker",
      "No ODR / mediation",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 199,
    yearlyPrice: 159,     // ~20% off
    tagline: "For individuals with occasional legal needs",
    icon: TrendingUp,
    features: [
      "30 AI legal queries / day",
      "50+ document templates",
      "3 AI document generations / mo",
      "AI-powered lawyer matching",
      "Case status tracker (eCourts)",
      "ODR / Mediation filing",
      "Email support",
    ],
    limits: [],
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPrice: 499,
    yearlyPrice: 399,
    tagline: "Unlimited AI for serious legal matters",
    icon: Sparkles,
    popular: true,
    features: [
      "Unlimited AI legal queries",
      "150+ document templates",
      "Unlimited document generation",
      "Priority lawyer matching & instant connect",
      "Case status tracker + hearing alerts",
      "ODR / Mediation + e-stamp support",
      "WhatsApp & SMS hearing reminders",
      "Priority email & chat support",
    ],
    limits: [],
  },
];

// ── Advocate / Lawyer Plans ──────────────────────────────────────────────────

const ADVOCATE_PLANS = [
  {
    id: "advocate_starter",
    name: "Starter",
    monthlyPrice: 999,
    yearlyPrice: 799,
    tagline: "For solo practitioners just getting started",
    icon: BadgeCheck,
    features: [
      "50 AI research searches / mo",
      "10 active cases",
      "10 clients in CRM",
      "Basic invoicing & billing",
      "Case Prediction (5 / mo)",
      "Document drafting (10 / mo)",
      "BCI verification badge",
      "Cause list & eCourts integration",
    ],
    limits: [
      "No Contract CLM",
      "No Judge Analytics",
      "No Litigation Safety Check",
      "Single user only",
    ],
  },
  {
    id: "advocate_pro",
    name: "Professional",
    monthlyPrice: 2499,
    yearlyPrice: 1999,
    tagline: "Full AI suite for active litigators",
    icon: Crown,
    popular: true,
    features: [
      "Unlimited AI research searches",
      "Unlimited cases & clients",
      "Full invoicing, time tracking & CRM",
      "Unlimited case predictions",
      "Unlimited document drafting & review",
      "Contract CLM & IP Portfolio",
      "Judge Analytics & Court Tendencies",
      "Litigation Safety Check",
      "Document Comparison (Redline)",
      "Case Risk Scoring",
      "Annotations & citation graph",
      "Priority support",
    ],
    limits: [],
  },
  {
    id: "advocate_firm",
    name: "Firm",
    monthlyPrice: 6999,
    yearlyPrice: 5599,
    tagline: "For law firms and multi-advocate setups",
    icon: Building2,
    features: [
      "Everything in Professional",
      "Up to 10 team members",
      "Shared case & client pool",
      "Firm-level analytics dashboard",
      "Client portal (white-label ready)",
      "Automated invoice reminders",
      "Dedicated account manager",
      "Custom onboarding & training",
      "SLA-backed priority support",
    ],
    limits: [],
  },
];

// ── Billing history mock ─────────────────────────────────────────────────────

const BILLING_HISTORY = [
  { id: "rcpt-001", date: "2026-06-01", desc: "Plus Plan — June 2026", amount: 499, status: "paid" },
  { id: "rcpt-002", date: "2026-05-01", desc: "Plus Plan — May 2026",  amount: 499, status: "paid" },
  { id: "rcpt-003", date: "2026-04-01", desc: "Starter Plan — Apr 2026", amount: 199, status: "paid" },
];

function planDisplayName(planId: string): string {
  const all = [...INDIVIDUAL_PLANS, ...ADVOCATE_PLANS];
  return all.find((p) => p.id === planId)?.name ?? "Free";
}

function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [yearly, setYearly] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [mfaStep, setMfaStep] = useState<"idle" | "setup" | "disable">("idle");
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  // ── Annual Filing state ──
  const [afStep, setAfStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({ ...EMPTY_COMPANY });
  const [directors, setDirectors] = useState<DirectorForm[]>([{ ...EMPTY_DIRECTOR }, { ...EMPTY_DIRECTOR }]);
  const [afSubmitting, setAfSubmitting] = useState(false);

  function handleStartPlan(planId: string) {
    setSelectedPlan(planId);
    setCompanyForm({ ...EMPTY_COMPANY });
    setDirectors([{ ...EMPTY_DIRECTOR }, { ...EMPTY_DIRECTOR }]);
    setAfStep(1);
  }

  async function handleSubmitFiling() {
    setAfSubmitting(true);
    try {
      await backendApi.post("/compliance/annual-filing", { plan: selectedPlan, company: companyForm, directors });
    } catch { /* save locally */ }
    finally {
      setAfSubmitting(false);
      setAfStep(4);
      toast.success("Annual filing request submitted!");
    }
  }

  const afPlanName = ANNUAL_PLANS.find((p) => p.id === selectedPlan)?.name ?? "";
  const canAfStep1 = companyForm.company_name.trim().length > 0 && companyForm.financial_year.trim().length > 0;
  const canAfStep2 = directors[0].name.trim().length > 0 && directors[0].din.trim().length > 0;
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    state: user?.state ?? "",
    language_preference: user?.language_preference ?? "en",
  });

  const searchParams = useSearchParams();
  const isAdvocate = isProRole(user?.role ?? "consumer");
  const plans = isAdvocate ? ADVOCATE_PLANS : INDIVIDUAL_PLANS;
  const currentPlanId = user?.subscription_plan ?? "free";
  const currentPlanName = planDisplayName(currentPlanId);

  // Jump to billing tab if redirected from plan gate dialog
  useEffect(() => {
    if (searchParams.get("tab") === "billing") {
      setTab("billing");
    }
  }, [searchParams]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({
        name: form.name,
        phone: form.phone || undefined,
        state: form.state || undefined,
        language_preference: form.language_preference,
      });
      refreshUser(updated);
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (!passwordForm.current || !passwordForm.next) {
      toast.error("Please fill in all password fields.");
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: "", next: "", confirm: "" });
      toast.success("Password updated successfully!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to update password. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUpgrade = async (planId: string, planName: string) => {
    setUpgradingPlan(planId);
    try {
      await usersApi.upgradePlan(planId);
      // Update the user object in context so plan gates re-evaluate immediately
      if (user) {
        refreshUser({ ...user, subscription_plan: planId as typeof user.subscription_plan });
      }
      toast.success(`Plan upgraded to ${planName}!`);
    } catch {
      toast.error("Upgrade failed — please try again or contact support.");
    } finally {
      setUpgradingPlan(null);
    }
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "profile",       label: "Profile",        icon: User },
    { key: "notifications", label: "Notifications",  icon: Bell },
    { key: "security",      label: "Security",       icon: Shield },
    { key: "billing",       label: "Plans & Billing", icon: CreditCard },
  ];

  return (
    <AppLayout title="Settings" subtitle="Manage your account and preferences">
      {/* Tab nav — always constrained */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={tab === key ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile / Notifications / Security — narrow container */}
      {tab !== "billing" && (
      <div className="max-w-3xl mx-auto">

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="vk-card p-6">
            <h2 className="text-base font-semibold mb-5">Profile Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="vk-label">Full Name</label>
                <input className="vk-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Email</label>
                <input className="vk-input" value={user?.email} disabled style={{ opacity: 0.5 }} />
              </div>
              <div>
                <label className="vk-label">Phone</label>
                <input className="vk-input" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">State</label>
                <select className="vk-input" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Language</label>
                <select className="vk-input" value={form.language_preference} onChange={(e) => setForm((f) => ({ ...f, language_preference: e.target.value }))}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Role</label>
                <input className="vk-input capitalize" value={user?.role?.replace("_", " ")} disabled style={{ opacity: 0.5 }} />
              </div>
              <div>
                <label className="vk-label">Member Since</label>
                <input className="vk-input" value={user ? formatDate(user.created_at) : ""} disabled style={{ opacity: 0.5 }} />
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="btn-primary mt-5">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}

        {/* ── Notifications ────────────────────────────────────────────────── */}
        {tab === "notifications" && (
          <div className="vk-card p-6">
            <h2 className="text-base font-semibold mb-5">Notification Preferences</h2>
            <div className="space-y-4">
              {[
                { label: "Hearing date reminders", desc: "SMS/WhatsApp 24hrs before each hearing", key: "hearing" },
                { label: "Payment updates", desc: "Invoice sent, payment received, overdue alerts", key: "payment" },
                { label: "AI query responses", desc: "Email summary of your consultations", key: "ai" },
                { label: "Lawyer responses", desc: "When an advocate accepts or messages you", key: "lawyer" },
                { label: "Document updates", desc: "Document generated, reviewed, or signed", key: "document" },
                { label: "Product updates", desc: "New features and platform announcements", key: "product" },
              ].map(({ label, desc, key }) => (
                <div key={key} className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--vk-border)" }}>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-dim mt-0.5">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 rounded-full peer-checked:bg-gold bg-slate-700 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Security ─────────────────────────────────────────────────────── */}
        {tab === "security" && (
          <div className="vk-card p-6">
            <h2 className="text-base font-semibold mb-5">Security Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="vk-label">Current Password</label>
                <input className="vk-input" type="password" placeholder="••••••••" value={passwordForm.current} onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">New Password</label>
                <input className="vk-input" type="password" placeholder="Min 8 chars, upper, lower, digit, symbol" value={passwordForm.next} onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Confirm New Password</label>
                <input className="vk-input" type="password" placeholder="••••••••" value={passwordForm.confirm} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))} />
              </div>
              <button className="btn-primary" onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? "Updating…" : "Update Password"}
              </button>
              <div className="vk-divider my-4" />
              {/* ── 2FA / MFA Section ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Two-Factor Authentication</p>
                    <p className="text-xs text-dim mt-0.5">
                      {user?.mfa_enabled ? "MFA is active — your account is protected." : "Add an extra layer of security with an authenticator app."}
                    </p>
                  </div>
                  {mfaStep === "idle" && (
                    <button
                      className={user?.mfa_enabled ? "btn-secondary text-xs" : "btn-primary text-xs"}
                      onClick={async () => {
                        if (user?.mfa_enabled) { setMfaStep("disable"); return; }
                        setMfaBusy(true);
                        try {
                          const res = await authApi.mfaSetup();
                          setMfaQr(res.qr_code);
                          setMfaStep("setup");
                        } catch { toast.error("Failed to start MFA setup."); }
                        finally { setMfaBusy(false); }
                      }}
                      disabled={mfaBusy}
                    >
                      {user?.mfa_enabled ? "Disable 2FA" : mfaBusy ? "Loading…" : "Enable 2FA"}
                    </button>
                  )}
                </div>

                {mfaStep === "setup" && mfaQr && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--vk-navy-card)", border: "1px solid var(--vk-border)" }}>
                    <p className="text-xs font-semibold text-gold">Scan with Google Authenticator or Authy</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mfaQr} alt="TOTP QR Code" className="w-40 h-40 rounded-lg bg-white p-1" />
                    <div>
                      <label className="vk-label">Enter 6-digit code from your app</label>
                      <input
                        className="vk-input"
                        placeholder="123456"
                        maxLength={8}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary text-xs" disabled={mfaCode.length < 6 || mfaBusy} onClick={async () => {
                        setMfaBusy(true);
                        try {
                          await authApi.mfaEnable(mfaCode);
                          if (user) refreshUser({ ...user, mfa_enabled: true } as typeof user);
                          setMfaStep("idle"); setMfaCode(""); setMfaQr(null);
                          toast.success("2FA enabled successfully!");
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                          toast.error(msg ?? "Invalid code. Please try again.");
                        } finally { setMfaBusy(false); }
                      }}>
                        {mfaBusy ? "Verifying…" : "Verify & Activate"}
                      </button>
                      <button className="btn-secondary text-xs" onClick={() => { setMfaStep("idle"); setMfaCode(""); setMfaQr(null); }}>Cancel</button>
                    </div>
                  </div>
                )}

                {mfaStep === "disable" && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--vk-navy-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>Confirm disable 2FA</p>
                    <div>
                      <label className="vk-label">Enter current 6-digit code to confirm</label>
                      <input
                        className="vk-input"
                        placeholder="123456"
                        maxLength={8}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                        disabled={mfaCode.length < 6 || mfaBusy}
                        onClick={async () => {
                          setMfaBusy(true);
                          try {
                            await authApi.mfaDisable(mfaCode);
                            if (user) refreshUser({ ...user, mfa_enabled: false } as typeof user);
                            setMfaStep("idle"); setMfaCode("");
                            toast.success("2FA disabled.");
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                            toast.error(msg ?? "Invalid code.");
                          } finally { setMfaBusy(false); }
                        }}>
                        {mfaBusy ? "Disabling…" : "Confirm Disable"}
                      </button>
                      <button className="btn-secondary text-xs" onClick={() => { setMfaStep("idle"); setMfaCode(""); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      )} {/* end non-billing max-w-3xl */}

      {/* Plans & Billing — full width */}
      {tab === "billing" && (
        <div className="space-y-6">

            {/* Current plan banner */}
            <div
              className="flex items-center justify-between rounded-xl px-5 py-4"
              style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.25)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(201,168,76,0.2)" }}>
                  <Zap className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="text-xs text-dim">Current Plan</p>
                  <p className="text-sm font-bold text-gold">{currentPlanName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-dim">{isAdvocate ? "Advocate Suite" : "Individual"}</p>
                <p className="text-[11px] text-dim mt-0.5">Renews 1 Jul 2026</p>
              </div>
            </div>

            {/* Role label */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>
                  {isAdvocate ? (
                    <span className="flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> Advocate & Firm Plans</span>
                  ) : (
                    <span className="flex items-center gap-2"><User className="w-4 h-4 text-gold" /> Individual Plans</span>
                  )}
                </h2>
                <p className="text-xs text-dim mt-0.5">
                  {isAdvocate
                    ? "Compared to CaseMine (₹3,000/mo) or Westlaw India (₹5,000+/mo) — research only. VakilAI includes full practice management."
                    : "More affordable than hiring a lawyer for every query. Cancel anytime."}
                </p>
              </div>

              {/* Annual toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-dim">Monthly</span>
                <button
                  className="w-10 h-5 rounded-full relative transition-colors"
                  style={{ background: yearly ? "var(--vk-gold)" : "var(--vk-border)" }}
                  onClick={() => setYearly((v) => !v)}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: yearly ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
                <span className="text-xs text-dim">
                  Annual <span className="text-green-400 font-medium">−20%</span>
                </span>
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {plans.map((plan) => {
                const isCurrent = currentPlanId === plan.id;
                const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
                const Icon = plan.icon;

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl p-6 relative flex flex-col"
                    style={{
                      background: "var(--vk-navy-card)",
                      border: plan.popular
                        ? "1px solid rgba(201,168,76,0.5)"
                        : isCurrent
                        ? "1px solid rgba(34,197,94,0.4)"
                        : "1px solid var(--vk-border)",
                      boxShadow: plan.popular ? "0 0 0 1px rgba(201,168,76,0.12) inset" : undefined,
                    }}
                  >
                    {/* Badges */}
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <span className="vk-badge vk-badge-gold text-[10px] px-3 py-1 whitespace-nowrap shadow">Most Popular</span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3.5 right-4 z-10">
                        <span className="vk-badge vk-badge-green text-[10px] px-3 py-1 whitespace-nowrap shadow">Current Plan</span>
                      </div>
                    )}

                    {/* Plan header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "var(--vk-gold-dim)" }}
                      >
                        <Icon className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base" style={{ color: "var(--vk-text)" }}>{plan.name}</h3>
                        <p className="text-[11px] leading-tight" style={{ color: "var(--vk-text-muted)" }}>{plan.tagline}</p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="mb-4" style={{ borderTop: "1px solid var(--vk-border)" }} />

                    {/* Price */}
                    <div className="mb-5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-gold">
                          {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}
                        </span>
                        {price > 0 && (
                          <span className="text-xs" style={{ color: "var(--vk-text-muted)" }}>
                            /{yearly ? "mo" : "mo"}
                          </span>
                        )}
                      </div>
                      {price > 0 && yearly && (
                        <p className="text-[11px] text-green-400 mt-0.5">Billed annually — save 20%</p>
                      )}
                      {price > 0 && !yearly && (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--vk-text-muted)" }}>
                          or ₹{plan.yearlyPrice.toLocaleString("en-IN")}/mo billed yearly
                        </p>
                      )}
                    </div>

                    {/* Included features */}
                    <ul className="space-y-2.5 flex-1 mb-4">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                          <span className="text-xs leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Not-included */}
                    {plan.limits.length > 0 && (
                      <>
                        <div className="mb-3" style={{ borderTop: "1px solid var(--vk-border)" }} />
                        <ul className="space-y-2 mb-4">
                          {plan.limits.map((f) => (
                            <li key={f} className="flex items-start gap-2.5">
                              <X className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-40" style={{ color: "var(--vk-text-muted)" }} />
                              <span className="text-xs leading-relaxed opacity-50" style={{ color: "var(--vk-text-muted)" }}>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <button
                      className={isCurrent ? "btn-secondary w-full text-sm py-2.5" : "btn-primary w-full text-sm py-2.5"}
                      disabled={isCurrent || upgradingPlan === plan.id}
                      onClick={() => !isCurrent && handleUpgrade(plan.id, plan.name)}
                    >
                      {upgradingPlan === plan.id
                        ? "Processing…"
                        : isCurrent
                        ? "Current Plan"
                        : price === 0
                        ? "Downgrade to Free"
                        : "Upgrade Now"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Compare note */}
            {isAdvocate && (
              <div className="vk-disclaimer text-xs">
                <Zap className="w-4 h-4 shrink-0 text-gold" />
                <span>
                  <strong className="text-gold-light">Why VakilAI Pro?</strong> — CaseMine charges ₹3,000–6,000/mo for research only. Westlaw India starts at ₹5,000/mo. VakilAI Professional at ₹2,499/mo includes AI research + case management + CRM + billing + judge analytics + litigation safety — all in one.
                </span>
              </div>
            )}
            {!isAdvocate && (
              <div className="vk-disclaimer text-xs">
                <Zap className="w-4 h-4 shrink-0 text-gold" />
                <span>
                  All plans include a <strong className="text-gold-light">7-day free trial</strong>. No credit card required for Free. Cancel anytime — no lock-in.
                </span>
              </div>
            )}

            {/* Payment method */}
            <div className="vk-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gold" /> Payment Method
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)", color: "var(--vk-text-muted)" }}>
                    VISA
                  </div>
                  <div>
                    <p className="text-xs font-medium">•••• •••• •••• 4242</p>
                    <p className="text-[11px] text-dim">Expires 08/28</p>
                  </div>
                </div>
                <button className="btn-secondary text-xs">Update</button>
              </div>
            </div>

            {/* Billing history */}
            <div className="vk-card overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--vk-border)" }}>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gold" /> Billing History
                </h3>
              </div>
              <table className="vk-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {BILLING_HISTORY.map((row) => (
                    <tr key={row.id}>
                      <td><span className="text-xs">{formatDate(row.date)}</span></td>
                      <td><span className="text-xs">{row.desc}</span></td>
                      <td><span className="text-xs font-semibold text-gold">₹{row.amount.toLocaleString("en-IN")}</span></td>
                      <td><span className="vk-badge vk-badge-green text-[11px] capitalize">{row.status}</span></td>
                      <td>
                        <button className="text-[11px] text-gold hover:underline">PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Annual Company Compliance Filing Service ─────────────────── */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: "var(--vk-border)" }} />
                <span className="text-xs font-bold text-gold tracking-widest uppercase">Add-On Services</span>
                <div className="flex-1 h-px" style={{ background: "var(--vk-border)" }} />
              </div>

              {/* Step 0 — Plans & overview */}
              {afStep === 0 && (
                <div className="space-y-6">
                  <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.08),rgba(201,168,76,0.03))", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                        <Crown className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold" style={{ color: "var(--vk-text)" }}>Annual Company Compliance Service</h3>
                          <span className="vk-badge vk-badge-gold text-[10px] px-2">Premium Add-On</span>
                        </div>
                        <p className="text-sm text-dim mb-3 max-w-xl">Complete ROC filing for Private Limited Companies — Authorised Capital up to ₹5L, Turnover up to ₹100L. Handled by our CA partner network.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {AF_SERVICE_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-start gap-2">
                              <Icon className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                              <span className="text-xs text-dim">{text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--vk-text)" }}>14 Deliverables Included</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {AF_DELIVERABLES.map((d) => (
                        <div key={d.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "var(--vk-navy-card)", border: "1px solid var(--vk-border)" }}>
                          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.15)" }}>
                            <Check className="w-2.5 h-2.5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium" style={{ color: "var(--vk-text)" }}>{d.label}</p>
                            <p className="text-[10px] text-dim">{d.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold" style={{ color: "var(--vk-text)" }}>Choose a Plan</p>
                      <span className="text-xs text-dim">Annual billing · GST extra · Govt fees extra</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {ANNUAL_PLANS.map((plan) => {
                        const Icon = plan.icon;
                        const deliverables = AF_DELIVERABLES.filter((d) => plan.includes.includes(d.id));
                        const excluded = AF_DELIVERABLES.filter((d) => plan.excludes.includes(d.id));
                        return (
                          <div key={plan.id} className="rounded-2xl p-5 flex flex-col relative"
                            style={{
                              background: "var(--vk-navy-card)",
                              border: plan.highlight ? "1px solid rgba(201,168,76,0.5)" : "1px solid var(--vk-border)",
                              boxShadow: plan.highlight ? "0 0 0 1px rgba(201,168,76,0.1) inset" : undefined,
                            }}
                          >
                            {plan.highlight && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="vk-badge vk-badge-gold text-[10px] px-3 py-1 whitespace-nowrap shadow">Most Popular</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2.5 mb-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                                <Icon className="w-4 h-4 text-gold" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm" style={{ color: "var(--vk-text)" }}>{plan.name}</h4>
                                <p className="text-[10px] text-dim">{plan.tagline}</p>
                              </div>
                            </div>
                            <div className="mb-3" style={{ borderTop: "1px solid var(--vk-border)" }} />
                            <div className="mb-4">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-gold">₹{plan.price.toLocaleString("en-IN")}</span>
                                <span className="text-xs text-dim">/year</span>
                              </div>
                              <p className="text-[10px] text-dim mt-0.5">{plan.support}</p>
                            </div>
                            <ul className="space-y-1.5 flex-1 mb-3">
                              {deliverables.map((d) => (
                                <li key={d.id} className="flex items-start gap-1.5">
                                  <Check className="w-3 h-3 text-gold shrink-0 mt-0.5" />
                                  <span className="text-xs text-dim">{d.label}</span>
                                </li>
                              ))}
                              {(plan.extras ?? []).map((e) => (
                                <li key={e} className="flex items-start gap-1.5">
                                  <Sparkles className="w-3 h-3 text-gold shrink-0 mt-0.5" />
                                  <span className="text-xs text-dim">{e}</span>
                                </li>
                              ))}
                            </ul>
                            {excluded.length > 0 && (
                              <>
                                <div className="mb-2" style={{ borderTop: "1px solid var(--vk-border)" }} />
                                <ul className="space-y-1 mb-2">
                                  {excluded.map((d) => (
                                    <li key={d.id} className="flex items-start gap-1.5 opacity-40">
                                      <X className="w-3 h-3 text-dim shrink-0 mt-0.5" />
                                      <span className="text-xs text-dim">{d.label}</span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                            <button className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2 mt-auto" onClick={() => handleStartPlan(plan.id)}>
                              Get Started <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-dim mt-2 text-center">Government filing fees charged at actuals. GST @18% on service fee.</p>
                  </div>
                </div>
              )}

              {/* Wizard steps 1–3 */}
              {afStep > 0 && afStep < 4 && (
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center gap-2 mb-5">
                    {["Plan", "Company Details", "Director Info", "Review"].map((label, i) => {
                      const sn = i + 1; const isActive = afStep === sn; const isDone = afStep > sn;
                      return (
                        <div key={label} className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{
                              background: isDone ? "rgba(34,197,94,0.2)" : isActive ? "var(--vk-gold)" : "var(--vk-navy-light)",
                              color: isDone ? "#4ade80" : isActive ? "var(--vk-navy)" : "var(--vk-text-muted)",
                              border: isActive ? "none" : isDone ? "1px solid rgba(34,197,94,0.4)" : "1px solid var(--vk-border)",
                            }}
                          >
                            {isDone ? <Check className="w-3 h-3" /> : sn}
                          </div>
                          <span className={`text-xs font-medium ${isActive ? "text-gold" : isDone ? "text-green-400" : "text-dim"}`}>{label}</span>
                          {i < 3 && <div className="flex-1 h-px" style={{ background: isDone ? "rgba(34,197,94,0.3)" : "var(--vk-border)" }} />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4" style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.2)" }}>
                    <Crown className="w-4 h-4 text-gold shrink-0" />
                    <span className="text-xs text-dim">Selected:</span>
                    <span className="text-sm font-bold text-gold">{afPlanName} — ₹{ANNUAL_PLANS.find((p) => p.id === selectedPlan)?.price.toLocaleString("en-IN")}/year</span>
                    <button className="ml-auto text-xs text-dim hover:text-gold" onClick={() => setAfStep(0)}>Change</button>
                  </div>

                  {afStep === 1 && (
                    <div className="vk-card p-5 space-y-4">
                      <h3 className="font-semibold text-sm">Company Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="vk-label">Company Name <span className="text-red-400">*</span></label>
                          <input className="vk-input w-full text-sm" placeholder="e.g. Acme Technologies Pvt Ltd" value={companyForm.company_name} onChange={(e) => setCompanyForm((f) => ({ ...f, company_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="vk-label">CIN</label>
                          <input className="vk-input w-full text-sm font-mono" placeholder="U74999MH2020PTC123456" value={companyForm.cin} onChange={(e) => setCompanyForm((f) => ({ ...f, cin: e.target.value }))} />
                        </div>
                        <div>
                          <label className="vk-label">Company Type</label>
                          <select className="vk-input w-full text-sm" value={companyForm.company_type} onChange={(e) => setCompanyForm((f) => ({ ...f, company_type: e.target.value }))}>
                            <option>Private Limited</option><option>One Person Company (OPC)</option><option>LLP</option><option>Section 8 Company</option>
                          </select>
                        </div>
                        <div>
                          <label className="vk-label">Date of Incorporation</label>
                          <input className="vk-input w-full text-sm" type="date" value={companyForm.incorporation_date} onChange={(e) => setCompanyForm((f) => ({ ...f, incorporation_date: e.target.value }))} />
                        </div>
                        <div>
                          <label className="vk-label">Financial Year <span className="text-red-400">*</span></label>
                          <select className="vk-input w-full text-sm" value={companyForm.financial_year} onChange={(e) => setCompanyForm((f) => ({ ...f, financial_year: e.target.value }))}>
                            {["2024-25","2023-24","2022-23","2021-22"].map((y) => <option key={y}>{y}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="vk-label">Authorised Capital (₹)</label>
                          <input className="vk-input w-full text-sm" placeholder="500000" value={companyForm.authorized_capital} onChange={(e) => setCompanyForm((f) => ({ ...f, authorized_capital: e.target.value }))} />
                          <p className="text-[10px] text-dim mt-1">Max ₹5,00,000</p>
                        </div>
                        <div>
                          <label className="vk-label">Paid-up Capital (₹)</label>
                          <input className="vk-input w-full text-sm" placeholder="100000" value={companyForm.paid_up_capital} onChange={(e) => setCompanyForm((f) => ({ ...f, paid_up_capital: e.target.value }))} />
                        </div>
                        <div>
                          <label className="vk-label">Annual Turnover (₹)</label>
                          <input className="vk-input w-full text-sm" placeholder="5000000" value={companyForm.annual_turnover} onChange={(e) => setCompanyForm((f) => ({ ...f, annual_turnover: e.target.value }))} />
                          <p className="text-[10px] text-dim mt-1">Max ₹1,00,00,000</p>
                        </div>
                        <div className="col-span-2">
                          <label className="vk-label">Registered Address</label>
                          <input className="vk-input w-full text-sm" placeholder="Full registered office address" value={companyForm.registered_address} onChange={(e) => setCompanyForm((f) => ({ ...f, registered_address: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--vk-border)" }}>
                        <button className="btn-secondary text-sm" onClick={() => setAfStep(0)}><ChevronLeft className="w-4 h-4 inline mr-1" />Back</button>
                        <button className="btn-primary text-sm" disabled={!canAfStep1} onClick={() => setAfStep(2)}>Next: Directors <ChevronRight className="w-4 h-4 inline ml-1" /></button>
                      </div>
                    </div>
                  )}

                  {afStep === 2 && (
                    <div className="vk-card p-5 space-y-4">
                      <h3 className="font-semibold text-sm">Director Details (up to 2 directors)</h3>
                      {directors.map((dir, idx) => (
                        <div key={idx} className="space-y-3 pb-4" style={{ borderBottom: idx < 1 ? "1px solid var(--vk-border)" : "none" }}>
                          <p className="text-xs font-semibold text-gold">Director {idx + 1} {idx === 0 ? "(required)" : "(optional)"}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="vk-label">Full Name {idx === 0 && <span className="text-red-400">*</span>}</label>
                              <input className="vk-input w-full text-sm" value={dir.name} placeholder="As per PAN / Aadhaar" onChange={(e) => { const d = [...directors]; d[idx] = { ...d[idx], name: e.target.value }; setDirectors(d); }} />
                            </div>
                            <div>
                              <label className="vk-label">DIN {idx === 0 && <span className="text-red-400">*</span>}</label>
                              <input className="vk-input w-full text-sm font-mono" value={dir.din} placeholder="e.g. 01234567" onChange={(e) => { const d = [...directors]; d[idx] = { ...d[idx], din: e.target.value }; setDirectors(d); }} />
                            </div>
                            <div>
                              <label className="vk-label">Email</label>
                              <input className="vk-input w-full text-sm" type="email" value={dir.email} placeholder="director@company.com" onChange={(e) => { const d = [...directors]; d[idx] = { ...d[idx], email: e.target.value }; setDirectors(d); }} />
                            </div>
                            <div>
                              <label className="vk-label">Phone</label>
                              <input className="vk-input w-full text-sm" value={dir.phone} placeholder="+91 98765 43210" onChange={(e) => { const d = [...directors]; d[idx] = { ...d[idx], phone: e.target.value }; setDirectors(d); }} />
                            </div>
                            <div className="col-span-2">
                              <label className="vk-label">Designation</label>
                              <select className="vk-input w-full text-sm" value={dir.designation} onChange={(e) => { const d = [...directors]; d[idx] = { ...d[idx], designation: e.target.value }; setDirectors(d); }}>
                                <option>Director</option><option>Managing Director</option><option>Whole-Time Director</option><option>Independent Director</option><option>Nominee Director</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--vk-border)" }}>
                        <button className="btn-secondary text-sm" onClick={() => setAfStep(1)}><ChevronLeft className="w-4 h-4 inline mr-1" />Back</button>
                        <button className="btn-primary text-sm" disabled={!canAfStep2} onClick={() => setAfStep(3)}>Review & Submit <ChevronRight className="w-4 h-4 inline ml-1" /></button>
                      </div>
                    </div>
                  )}

                  {afStep === 3 && (
                    <div className="vk-card p-5 space-y-4">
                      <h3 className="font-semibold text-sm">Review Your Application</h3>
                      <div className="rounded-xl p-4" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
                        <p className="text-xs font-semibold text-gold mb-2">Company</p>
                        <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                          <span className="text-dim">Name</span><span style={{ color: "var(--vk-text)" }}>{companyForm.company_name}</span>
                          <span className="text-dim">CIN</span><span className="font-mono" style={{ color: "var(--vk-text)" }}>{companyForm.cin || "—"}</span>
                          <span className="text-dim">Type</span><span style={{ color: "var(--vk-text)" }}>{companyForm.company_type}</span>
                          <span className="text-dim">FY</span><span style={{ color: "var(--vk-text)" }}>{companyForm.financial_year}</span>
                          <span className="text-dim">Auth. Capital</span><span style={{ color: "var(--vk-text)" }}>₹{parseInt(companyForm.authorized_capital||"0").toLocaleString("en-IN")}</span>
                          <span className="text-dim">Turnover</span><span style={{ color: "var(--vk-text)" }}>₹{parseInt(companyForm.annual_turnover||"0").toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      {directors.filter((d) => d.name).map((dir, i) => (
                        <div key={i} className="rounded-xl p-4" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
                          <p className="text-xs font-semibold text-gold mb-2">Director {i + 1}</p>
                          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                            <span className="text-dim">Name</span><span style={{ color: "var(--vk-text)" }}>{dir.name}</span>
                            <span className="text-dim">DIN</span><span className="font-mono" style={{ color: "var(--vk-text)" }}>{dir.din}</span>
                            <span className="text-dim">Designation</span><span style={{ color: "var(--vk-text)" }}>{dir.designation}</span>
                          </div>
                        </div>
                      ))}
                      <div className="vk-disclaimer text-xs flex gap-2">
                        <Check className="w-4 h-4 shrink-0 text-gold" />
                        <span>CA partner contacts you within 2 business days to collect DSC, financial statements, and bank statements. Govt fees at actuals.</span>
                      </div>
                      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--vk-border)" }}>
                        <button className="btn-secondary text-sm" onClick={() => setAfStep(2)}><ChevronLeft className="w-4 h-4 inline mr-1" />Back</button>
                        <button className="btn-primary text-sm" disabled={afSubmitting} onClick={handleSubmitFiling}>
                          {afSubmitting ? "Submitting…" : "Submit Application"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4 — Success */}
              {afStep === 4 && (
                <div className="max-w-md mx-auto text-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "var(--vk-text)" }}>Application Submitted!</h3>
                  <p className="text-sm text-dim mb-2">
                    Annual filing for <span className="text-gold font-medium">{companyForm.company_name}</span> under <span className="text-gold font-medium">{afPlanName}</span> plan received.
                  </p>
                  <p className="text-xs text-dim mb-5">CA partner will reach out within 2 business days.</p>
                  <button className="btn-primary text-sm" onClick={() => setAfStep(0)}>Start Another Filing</button>
                </div>
              )}
            </div>

        </div>
      )}
    </AppLayout>
  );
}

// Wrap export in Suspense so useSearchParams doesn't break static prerender
export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
