"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Scale, Zap, Star, ArrowRight, Eye, EyeOff,
  CheckCircle, MessageSquare, FileText, Building2,
  Landmark, ClipboardList, Lightbulb, BookOpen,
  TrendingUp, PhoneCall, Search, ShieldCheck,
} from "lucide-react";
import { isProRole } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const duration = 1600;
      const step = 16;
      const increment = target / (duration / step);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(start));
      }, step);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}{suffix}</span>;
}

// ── Typing headline ───────────────────────────────────────────────────────────
const ROTATING_WORDS = ["instant.", "affordable.", "compliant.", "trusted.", "intelligent."];

function RotatingWord() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % ROTATING_WORDS.length);
        setVisible(true);
      }, 300);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className="gold-gradient-text"
      style={{
        display: "inline-block",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      {ROTATING_WORDS[idx]}
    </span>
  );
}

// ── Bottom panel labels ────────────────────────────────────────────────────────
const HERO_PANELS = ["Our Services", "What we cover", "Trust & numbers"];

// ── Services (bottom rotating grid) ───────────────────────────────────────────
const SERVICES = [
  { icon: MessageSquare, label: "AI Legal Chat",         desc: "Instant answers on any legal matter" },
  { icon: PhoneCall,     label: "Consultation & Review", desc: "Book a lawyer or get docs reviewed" },
  { icon: FileText,      label: "Document Drafting",     desc: "Contracts, notices, agreements" },
  { icon: Building2,     label: "Business Registration", desc: "Company, LLP, OPC, Startup India" },
  { icon: Lightbulb,     label: "Trademark & IPR",       desc: "Trademark, patent & copyright filing" },
  { icon: ClipboardList, label: "Compliance & Filings",  desc: "ITR, GST, ROC, MCA — never miss a deadline" },
  { icon: Landmark,      label: "Court Case Tracking",   desc: "eCourts, hearing dates & updates" },
  { icon: Scale,         label: "Find a Lawyer",         desc: "Verified advocates, 25+ areas" },
  { icon: BookOpen,      label: "Legal Research",        desc: "4M+ judgments, precedents, memos" },
];
const SERVICE_GROUPS = [[0, 1, 2, 3], [4, 5, 6, 7], [8]];

// ── Animated flow steps (upper section, always visible) ───────────────────────
const FLOW_STEPS = [
  {
    icon: MessageSquare,
    num: "01",
    title: "Describe",
    subtitle: "Your legal need",
    detail: "Plain English — no jargon, no forms, no stress.",
  },
  {
    icon: Search,
    num: "02",
    title: "AI Analyses",
    subtitle: "4M+ judgments scanned",
    detail: "India-specific law, precedents & compliance rules — in seconds.",
  },
  {
    icon: CheckCircle,
    num: "03",
    title: "AI Answer",
    subtitle: "Cited & jurisdiction-aware",
    detail: "Clear guidance with sources — know exactly where you stand.",
  },
  {
    icon: PhoneCall,
    num: "04",
    title: "Advocate Review",
    subtitle: "Optional · verified lawyer",
    detail: "Escalate to a real advocate for complex matters — one click.",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated, isLoading, login, register, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [heroPanel, setHeroPanel] = useState(0);
  const [serviceGroupIdx, setServiceGroupIdx] = useState(0);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "consumer",
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.push(isProRole(user.role) ? "/pro/dashboard" : "/dashboard");
    }
  }, [isAuthenticated, isLoading, user, router]);


  // Auto-rotate bottom panels every 5s
  useEffect(() => {
    const t = setInterval(() => setHeroPanel((i) => (i + 1) % HERO_PANELS.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Rotate service grid every 2.5s (only when "Our Services" tab active)
  useEffect(() => {
    if (heroPanel !== 0) return;
    const t = setInterval(() => setServiceGroupIdx((i) => (i + 1) % SERVICE_GROUPS.length), 2500);
    return () => clearInterval(t);
  }, [heroPanel]);

  // Flow animation — always running, self-repeating cycle (4 steps)
  const [flowStep, setFlowStep] = useState(0);
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setFlowStep(0);
      timers.push(setTimeout(() => setFlowStep(1), 1500));
      timers.push(setTimeout(() => setFlowStep(2), 3000));
      timers.push(setTimeout(() => setFlowStep(3), 4500));
      timers.push(setTimeout(() => { timers.forEach(clearTimeout); timers = []; run(); }, 6500));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (tab === "login") {
        await login({ email: form.email, password: form.password });
        toast.success("Welcome back!");
      } else {
        await register({
          name: form.name, email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: form.role as "consumer" | "lawyer",
        });
        toast.success("Account created!");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;


  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "var(--vk-navy)" }}>

      {/* ── Left: Hero ────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col flex-1 overflow-hidden relative"
        style={{ background: "linear-gradient(145deg, #080F1E 0%, #0F172A 60%, #111827 100%)" }}
      >
        {/* Decorative mesh */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{
            position: "absolute", top: "-20%", left: "-10%",
            width: "600px", height: "600px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)",
          }} />
          <div style={{
            position: "absolute", bottom: "10%", right: "-5%",
            width: "400px", height: "400px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
          }} />
        </div>

        <div className="relative z-10 flex flex-col h-full px-12 py-8">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))" }}>
              <Scale className="w-5 h-5 text-navy" />
            </div>
            <div>
              <span className="text-lg font-bold gold-gradient-text">VakilAI</span>
              <span className="block text-[11px] text-dim leading-none mt-0.5">Legal Intelligence Platform</span>
            </div>
            <span className="ml-auto vk-badge vk-badge-gold text-[10px]">
              <Zap className="w-2.5 h-2.5" /> India&apos;s #1 Legal AI
            </span>
          </div>

          {/* Headline */}
          <div className="mb-6">
            <h1 className="text-4xl xl:text-[2.6rem] font-bold leading-tight mb-3">
              Legal help that&apos;s{" "}<br />
              <RotatingWord />
            </h1>
            <p className="text-sm leading-relaxed max-w-md" style={{ color: "var(--vk-text-muted)" }}>
              AI-powered legal guidance, compliance tracking, and verified lawyers — all built for India.
            </p>
          </div>

          {/* ── Animated How it works flow ── */}
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--vk-text-dim)" }}>
              How it works
            </p>

            {/* Step cards + connectors — fixed height, only visual properties animate */}
            <div className="flex items-stretch gap-0" style={{ height: "130px" }}>
              {FLOW_STEPS.map(({ icon: Icon, num, title, subtitle, detail }, i) => {
                const isActive = flowStep === i;
                const isDone = flowStep > i;
                return (
                  <div key={num} className="flex items-stretch"
                    style={{ flex: isActive ? 2 : 1, transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
                    {/* Card — fixed padding, only visual properties change */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-3 py-3 rounded-2xl transition-all duration-500 cursor-default"
                      style={{
                        background: isActive
                          ? "rgba(201,168,76,0.11)"
                          : isDone ? "rgba(201,168,76,0.03)" : "rgba(255,255,255,0.015)",
                        border: isActive
                          ? "1px solid rgba(201,168,76,0.5)"
                          : isDone ? "1px solid rgba(201,168,76,0.12)" : "1px solid rgba(255,255,255,0.05)",
                        boxShadow: isActive
                          ? "0 0 40px rgba(201,168,76,0.18), 0 0 80px rgba(201,168,76,0.06), inset 0 0 20px rgba(201,168,76,0.04)"
                          : "none",
                        opacity: isActive ? 1 : isDone ? 0.55 : 0.38,
                      }}>
                      {/* Icon with pulse ring — fixed 38px, only style changes */}
                      <div className="relative mb-2 shrink-0" style={{ width: "38px", height: "38px" }}>
                        {isActive && (
                          <>
                            <div className="absolute inset-0 rounded-full animate-ping"
                              style={{ background: "rgba(201,168,76,0.2)", animationDuration: "1.8s" }} />
                            <div className="absolute inset-0 rounded-full animate-ping"
                              style={{ background: "rgba(201,168,76,0.12)", animationDuration: "1.8s", animationDelay: "0.5s" }} />
                          </>
                        )}
                        <div className="w-full h-full rounded-full flex items-center justify-center relative transition-all duration-500"
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))"
                              : isDone ? "linear-gradient(135deg, var(--vk-gold-dark), #a87c30)" : "var(--vk-gold-dim)",
                            boxShadow: isActive ? "0 0 24px rgba(201,168,76,0.8), 0 0 48px rgba(201,168,76,0.3)" : "none",
                          }}>
                          <Icon className="w-4 h-4 transition-colors duration-500"
                            style={{ color: isActive || isDone ? "var(--vk-navy)" : "var(--vk-gold-light)" }} />
                        </div>
                      </div>

                      {/* Step num */}
                      <span className="text-[9px] font-bold tracking-widest mb-0.5 transition-colors duration-500"
                        style={{ color: isActive ? "var(--vk-gold)" : "var(--vk-text-dim)" }}>
                        {num}
                      </span>

                      {/* Title */}
                      <p className="text-xs font-bold mb-0.5 transition-colors duration-500 leading-tight"
                        style={{ color: isActive ? "var(--vk-gold-light)" : isDone ? "var(--vk-text)" : "var(--vk-text-muted)" }}>
                        {title}
                      </p>

                      {/* Subtitle — always visible, just dims */}
                      <p className="text-[10px] transition-colors duration-500 leading-tight"
                        style={{ color: isActive ? "var(--vk-text-muted)" : "rgba(148,163,184,0.45)" }}>
                        {subtitle}
                      </p>
                    </div>

                    {/* Connector */}
                    {i < FLOW_STEPS.length - 1 && (
                      <div className="flex items-center shrink-0" style={{ width: "20px" }}>
                        <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.07)", position: "relative" }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: isDone ? "100%" : isActive ? "50%" : "0%",
                            background: "linear-gradient(90deg, var(--vk-gold-dark), var(--vk-gold))",
                            boxShadow: isDone || isActive ? "0 0 8px rgba(201,168,76,0.7)" : "none",
                            transition: "width 0.8s ease, box-shadow 0.8s ease",
                          }} />
                          <div style={{
                            position: "absolute", top: "50%",
                            left: isDone ? "100%" : isActive ? "50%" : "0%",
                            transform: "translate(-50%, -50%)",
                            width: "5px", height: "5px", borderRadius: "50%",
                            background: isDone || isActive ? "var(--vk-gold)" : "rgba(255,255,255,0.15)",
                            boxShadow: isDone || isActive ? "0 0 8px rgba(201,168,76,0.8)" : "none",
                            transition: "left 0.8s ease, background 0.5s, box-shadow 0.5s",
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress track */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  height: "100%",
                  width: flowStep === 0 ? "25%" : flowStep === 1 ? "50%" : flowStep === 2 ? "75%" : "100%",
                  background: "linear-gradient(90deg, var(--vk-gold-dark), var(--vk-gold))",
                  boxShadow: "0 0 6px rgba(201,168,76,0.4)",
                  transition: "width 1s ease",
                }} />
              </div>
              <span className="text-[9px] font-semibold shrink-0" style={{ color: "var(--vk-text-dim)" }}>
                {flowStep + 1} / {FLOW_STEPS.length}{flowStep === 3 ? " · opt-in" : ""}
              </span>
            </div>
          </div>

          {/* Golden glow separator */}
          <div className="flex justify-center my-5">
            <div style={{
              width: "65%", height: "1px",
              background: "linear-gradient(90deg, transparent, var(--vk-gold), transparent)",
              boxShadow: "0 0 10px rgba(201,168,76,0.45), 0 0 24px rgba(201,168,76,0.15)",
            }} />
          </div>

          {/* ── Bottom rotating panels ── */}
          <div className="flex-1 flex flex-col">

            {/* Tab selectors */}
            <div className="flex items-center gap-2 mb-4">
              {HERO_PANELS.map((label, i) => (
                <button key={i} onClick={() => setHeroPanel(i)}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200"
                  style={heroPanel === i
                    ? { background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)", border: "1px solid rgba(201,168,76,0.3)" }
                    : { background: "transparent", color: "var(--vk-text-dim)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: heroPanel === i ? "var(--vk-gold)" : "rgba(255,255,255,0.2)" }} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 relative overflow-hidden">

              {/* Panel 0: Our Services */}
              <div className="absolute inset-0 transition-all duration-500"
                style={{ opacity: heroPanel === 0 ? 1 : 0, transform: heroPanel === 0 ? "translateY(0)" : "translateY(10px)", pointerEvents: heroPanel === 0 ? "auto" : "none" }}>
                <div className="relative" style={{ height: "108px" }}>
                  {SERVICE_GROUPS.map((group, gi) => (
                    <div key={gi} className="absolute inset-0 grid grid-cols-2 gap-1.5 transition-all duration-500"
                      style={{ opacity: gi === serviceGroupIdx ? 1 : 0, transform: gi === serviceGroupIdx ? "translateY(0)" : "translateY(8px)", pointerEvents: gi === serviceGroupIdx ? "auto" : "none" }}>
                      {group.map((idx) => {
                        const { icon: Icon, label, desc } = SERVICES[idx];
                        return (
                          <div key={label}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 cursor-default"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(201,168,76,0.06)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(201,168,76,0.2)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                              <Icon className="w-3 h-3 text-gold" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold truncate" style={{ color: "var(--vk-text)" }}>{label}</p>
                              <p className="text-[10px] truncate text-dim">{desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-4">
                  {SERVICE_GROUPS.map((_, i) => (
                    <button key={i} onClick={() => setServiceGroupIdx(i)}
                      className="rounded-full transition-all duration-200"
                      style={{ width: i === serviceGroupIdx ? "14px" : "4px", height: "4px", background: i === serviceGroupIdx ? "var(--vk-gold)" : "rgba(255,255,255,0.15)" }} />
                  ))}
                </div>
              </div>

              {/* Panel 1: What we cover */}
              <div className="absolute inset-0 transition-all duration-500"
                style={{ opacity: heroPanel === 1 ? 1 : 0, transform: heroPanel === 1 ? "translateY(0)" : "translateY(10px)", pointerEvents: heroPanel === 1 ? "auto" : "none" }}>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--vk-text-dim)" }}>
                      <ClipboardList className="w-3 h-3 text-gold" /> Filings &amp; Compliance
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["ITR Filing","GST Returns","ROC / MCA","AOC-4 & MGT-7","Director KYC","TDS Returns","Labour & PF","LLP Compliance","Trademark Filing","Property Tax"].map((f) => (
                        <span key={f} className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                          style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)", border: "1px solid rgba(201,168,76,0.18)" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--vk-text-dim)" }}>
                      <Scale className="w-3 h-3 text-gold" /> Legal Features
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["AI Legal Chat","Consultation & Review","Document Drafting","Find a Lawyer","Court Cases","Legal Research","Know Your Rights","Dispute Resolution","Argument Builder","Judge Analytics","IP Portfolio"].map((f) => (
                        <span key={f} className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                          style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)", border: "1px solid rgba(201,168,76,0.18)" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 2: Trust & numbers */}
              <div className="absolute inset-0 transition-all duration-500"
                style={{ opacity: heroPanel === 2 ? 1 : 0, transform: heroPanel === 2 ? "translateY(0)" : "translateY(10px)", pointerEvents: heroPanel === 2 ? "auto" : "none" }}>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { target: 4,  suffix: "M+", label: "Judgments" },
                      { target: 12, suffix: "K+", label: "Lawyers" },
                      { target: 50, suffix: "K+", label: "Filings" },
                      { target: 99, suffix: "%",  label: "Uptime" },
                    ].map(({ target, suffix, label }) => (
                      <div key={label} className="text-center p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--vk-border)" }}>
                        <p className="text-xl font-bold gold-gradient-text"><Counter target={target} suffix={suffix} /></p>
                        <p className="text-[10px] text-dim mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-gold fill-current" />)}
                    <span className="text-xs text-dim ml-2">Rated 4.9 / 5 by 8,000+ users</span>
                  </div>
                  <div className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                    style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.18)" }}>
                    <ClipboardList className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gold" />
                    <div>
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--vk-gold-light)" }}>Compliance &amp; Filings — AI-powered</p>
                      <p className="text-[10px] leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                        ITR · GST · ROC &amp; MCA · Director KYC · Labour &amp; PF — reminders, score tracking, AI-generated filings.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
                    style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                    <TrendingUp className="w-3.5 h-3.5 text-gold shrink-0" />
                    <p className="text-[11px]" style={{ color: "var(--vk-text-muted)" }}>
                      <span className="font-semibold text-gold">New:</span> Business Registration, Trademark &amp; Startup Packs.{" "}
                      <span className="font-semibold" style={{ color: "var(--vk-text)" }}>Free first consultation.</span>
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Vertical golden separator ──────────────────────────────────────── */}
      <div className="hidden lg:flex items-center justify-center w-px shrink-0">
        <div style={{
          width: "1px", height: "65%",
          background: "linear-gradient(180deg, transparent, var(--vk-gold), transparent)",
          boxShadow: "0 0 10px rgba(201,168,76,0.45), 0 0 24px rgba(201,168,76,0.15)",
        }} />
      </div>

      {/* ── Right: Auth card ───────────────────────────────────────────────── */}
      <div className="w-full lg:w-[440px] shrink-0 flex items-center justify-center p-6 lg:p-10">
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: "var(--vk-navy-light)",
            border: "1px solid var(--vk-border)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))" }}>
              <Scale className="w-4 h-4 text-navy" />
            </div>
            <span className="font-bold gold-gradient-text">VakilAI</span>
          </div>

          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--vk-text)" }}>
            {tab === "login" ? "Welcome back" : "Get started free"}
          </h2>
          <p className="text-sm text-dim mb-6">
            {tab === "login" ? "Sign in to your account" : "Create your VakilAI account"}
          </p>

          {/* Tabs */}
          <div className="flex rounded-lg p-0.5 mb-6"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--vk-border)" }}>
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-all duration-150"
                style={tab === t
                  ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" }
                  : { color: "var(--vk-text-muted)" }}
              >
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <>
                <div>
                  <label className="vk-label">Full Name</label>
                  <input className="vk-input" placeholder="Priya Mehta"
                    value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="vk-label">Phone (optional)</label>
                  <input className="vk-input" placeholder="+91 98765 43210"
                    value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="vk-label">I am a</label>
                  <select className="vk-input" value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="consumer">Individual / Business</option>
                    <option value="lawyer">Advocate / Lawyer</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="vk-label">Email</label>
              <input className="vk-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="vk-label mb-0">Password</label>
                {tab === "login" && (
                  <button type="button" className="text-[11px] text-gold hover:underline">Forgot?</button>
                )}
              </div>
              <div className="relative">
                <input className="vk-input pr-10"
                  type={showPass ? "text" : "password"} placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required minLength={8} />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-muted transition-colors"
                  onClick={() => setShowPass((v) => !v)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                  {tab === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {tab === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* What you get on register */}
          {tab === "register" && (
            <div className="mt-4 space-y-1.5">
              {[
                "Free AI legal consultation",
                "ITR, GST & ROC compliance tracking",
                "Document templates + 4M+ judgments",
              ].map((b) => (
                <div key={b} className="flex items-center gap-2 text-[11px] text-dim">
                  <CheckCircle className="w-3 h-3 text-gold shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          )}

          {/* Trust markers */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--vk-border)" }}>
            <div className="flex items-center justify-center gap-4 text-[11px] text-dim">
              {["256-bit encrypted", "DPDP 2023 compliant", "Free to start"].map((t) => (
                <span key={t} className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-gold" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
