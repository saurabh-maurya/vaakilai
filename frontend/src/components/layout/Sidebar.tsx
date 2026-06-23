"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isProRole, getInitials } from "@/lib/utils";
import {
  MessageSquare, FileText, ShieldCheck, Users, LayoutDashboard,
  Briefcase, BookOpen, Receipt, Settings, LogOut, Scale,
  ChevronDown, ChevronRight, Sparkles, Landmark, Search, CheckSquare,
  Gavel, ArrowLeftRight, Newspaper, BarChart2, FileSignature, Lightbulb,
  UserCheck, Swords, ListChecks, Clock, Library, Brain, Home,
  ClipboardList, Building2, PhoneCall, ShieldAlert, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SidebarMode = "legal" | "compliance";

function isClientRole(role: string) { return role === "client"; }

interface NavItem { href: string; label: string; icon: React.ElementType; badge?: string; }
interface NavSection { type: "section"; label: string; }
interface NavGroup { type: "group"; label: string; badge?: string; icon: React.ElementType; items: NavItem[]; }
type SidebarEntry = NavItem | NavSection | NavGroup;

function isSection(e: SidebarEntry): e is NavSection { return (e as NavSection).type === "section"; }
function isGroup(e: SidebarEntry): e is NavGroup { return (e as NavGroup).type === "group"; }

// ── Paths that belong to Compliance mode ─────────────────────────────────────
const COMPLIANCE_PATHS = ["/compliance-filings", "/company-compliance"];

// ── NAV DEFINITIONS ───────────────────────────────────────────────────────────

// Consumer — Legal
const CONSUMER_LEGAL: SidebarEntry[] = [
  { href: "/dashboard",   label: "Dashboard",       icon: LayoutDashboard },
  { type: "section",      label: "AI & Guidance" },
  { href: "/chat",        label: "AI Legal Chat",   icon: MessageSquare },
  { href: "/rights",      label: "Know Your Rights",icon: ShieldCheck },
  { type: "section",      label: "Documents" },
  { href: "/documents",   label: "Documents",       icon: FileText },
  { type: "section",      label: "Legal Services" },
  { href: "/consultation",label: "Consultation & Review", icon: PhoneCall, badge: "New" },
  { href: "/lawyers",     label: "Find a Lawyer",   icon: Users },
  { href: "/ecourts",     label: "My Court Cases",  icon: Landmark },
  { href: "/odr",         label: "Dispute Resolution", icon: Gavel },
  { type: "section",      label: "Reference" },
  { href: "/ipc-bns",     label: "IPC → BNS",       icon: ArrowLeftRight },
  { href: "/news",        label: "Legal News",       icon: Newspaper },
];

// Consumer — Compliance
const CONSUMER_COMPLIANCE: SidebarEntry[] = [
  { href: "/dashboard",            label: "Dashboard",              icon: LayoutDashboard },
  { type: "section",               label: "Individual Compliance" },
  { href: "/compliance-filings",   label: "Compliance & Filings",  icon: ClipboardList },
  { type: "section",               label: "Business Compliance" },
  { href: "/company-compliance",   label: "Company Compliance",    icon: Building2, badge: "Premium" },
];

// Pro — Legal
const PRO_LEGAL: SidebarEntry[] = [
  { href: "/pro/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { type: "section", label: "Practice" },
  { href: "/pro/cases",     label: "Cases",             icon: Briefcase },
  { href: "/pro/clients",   label: "Clients",           icon: UserCheck },
  { href: "/pro/billing",   label: "Billing & Invoices",icon: Receipt },
  { href: "/pro/contracts", label: "Contracts CLM",     icon: FileSignature },
  { href: "/pro/ip",        label: "IP Portfolio",      icon: Lightbulb },

  { type: "section", label: "Research" },
  { href: "/chat",               label: "AI Chat",          icon: MessageSquare },
  { href: "/pro/research",       label: "AI Research",      icon: BookOpen },
  { href: "/cases/search",       label: "Case Search",      icon: Search },
  { href: "/pro/judge-analytics",label: "Judge Analytics",  icon: BarChart2 },
  { href: "/pro/case-intelligence", label: "Case Intelligence", icon: Brain },
  {
    type: "group",
    label: "Case Analysis",
    icon: Swords,
    items: [
      { href: "/pro/arguments", label: "Argument Builder",  icon: Swords },
      { href: "/pro/issues",    label: "Issue Spotter",     icon: ListChecks },
      { href: "/pro/timeline",  label: "Event Timeline",    icon: Clock },
      { href: "/pro/statute",   label: "Statute Breakdown", icon: Library },
    ],
  },

  { type: "section", label: "Services" },
  { href: "/consultation", label: "Consultation & Review", icon: PhoneCall, badge: "New" },
  { href: "/documents", label: "Documents",         icon: FileText },
  { href: "/ecourts",   label: "My Court Cases",    icon: Landmark },
  { href: "/odr",       label: "Dispute Resolution",icon: Gavel },
  { href: "/ipc-bns",   label: "IPC → BNS",         icon: ArrowLeftRight },
  { href: "/news",      label: "Legal News",         icon: Newspaper },
];

// Pro — Compliance
const PRO_COMPLIANCE: SidebarEntry[] = [
  { href: "/pro/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { type: "section", label: "Compliance Centre" },
  { href: "/compliance-filings",  label: "Compliance & Filings",  icon: ClipboardList },
  { href: "/company-compliance",  label: "Company Compliance",    icon: Building2, badge: "Premium" },

  { type: "section", label: "Client Compliance" },
  { href: "/pro/cases",    label: "Cases",             icon: Briefcase },
  { href: "/pro/clients",  label: "Clients",           icon: UserCheck },
  { href: "/pro/billing",  label: "Billing & Invoices",icon: Receipt },
];

// Client nav (no toggle needed)
const CLIENT_NAV: SidebarEntry[] = [
  { href: "/client", label: "My Portal", icon: Home },
];

// Admin nav (shown instead of standard nav when role === "admin")
const ADMIN_NAV: SidebarEntry[] = [
  { href: "/admin", label: "Admin Dashboard", icon: ShieldAlert },
  { type: "section", label: "Management" },
  { href: "/admin#users", label: "User Management", icon: Users },
  { href: "/admin#ai", label: "AI Metrics", icon: BarChart2 },
  { href: "/admin#security", label: "Security Log", icon: ShieldCheck },
  { href: "/admin#health", label: "System Health", icon: Activity },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItemRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="block mb-0.5">
      <div className={cn("sidebar-item", active && "active")}>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className={cn("vk-badge text-[10px] shrink-0", "vk-badge-gold")}>
            {item.badge}
          </span>
        )}
      </div>
    </Link>
  );
}

function NavGroupRow({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isAnyActive = group.items.some((i) => pathname === i.href || pathname.startsWith(i.href));
  const [open, setOpen] = useState(isAnyActive);
  const Icon = group.icon;
  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("sidebar-item w-full text-left", isAnyActive && "active")}
        style={{ display: "flex" }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{group.label}</span>
        {group.badge && <span className="vk-badge vk-badge-blue text-[10px] shrink-0">{group.badge}</span>}
        {open
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: "var(--vk-text-dim)" }} />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: "var(--vk-text-dim)" }} />}
      </button>
      {open && (
        <div className="mt-0.5 ml-3 pl-3" style={{ borderLeft: "1px solid var(--vk-border)" }}>
          {group.items.map((item) => (
            <NavItemRow key={item.href} item={item}
              active={pathname === item.href || pathname.startsWith(item.href)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--vk-text-dim)" }}>
        {label}
      </p>
    </div>
  );
}

// ── Mode Toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: SidebarMode; onChange: (m: SidebarMode) => void }) {
  return (
    <div className="px-3 py-3 border-b" style={{ borderColor: "var(--vk-border)" }}>
      <div
        className="flex rounded-lg p-0.5 relative"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--vk-border)" }}
      >
        {/* Sliding pill */}
        <div
          className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-200"
          style={{
            left: mode === "legal" ? "2px" : "calc(50%)",
            background: mode === "legal"
              ? "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))"
              : "linear-gradient(135deg, #F0D68A, #C9A84C)",
          }}
        />
        {(["legal", "compliance"] as const).map((m) => {
          const Icon = m === "legal" ? Scale : ClipboardList;
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors duration-150"
              style={{ color: isActive ? "var(--vk-navy)" : "var(--vk-text-muted)" }}
            >
              <Icon className="w-3 h-3" />
              {m === "legal" ? "Legal" : "Compliance"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Auto-detect mode from pathname
  const defaultMode: SidebarMode = COMPLIANCE_PATHS.some((p) => pathname.startsWith(p))
    ? "compliance"
    : "legal";
  const [mode, setMode] = useState<SidebarMode>(defaultMode);

  // Keep mode in sync when user navigates directly via URL
  useEffect(() => {
    if (COMPLIANCE_PATHS.some((p) => pathname.startsWith(p))) {
      setMode("compliance");
    } else if (!pathname.startsWith("/settings") && !pathname.startsWith("/client")) {
      setMode("legal");
    }
  }, [pathname]);

  const isPro = user ? isProRole(user.role) : false;
  const isClient = user ? isClientRole(user.role) : false;
  const isAdmin = user?.role === "admin";

  // Pick nav based on role + mode
  const navEntries: SidebarEntry[] = isAdmin
    ? ADMIN_NAV
    : isClient
      ? CLIENT_NAV
      : isPro
        ? (mode === "legal" ? PRO_LEGAL : PRO_COMPLIANCE)
        : (mode === "legal" ? CONSUMER_LEGAL : CONSUMER_COMPLIANCE);

  // When switching mode, navigate to the mode's home if currently on wrong section
  const handleModeChange = (m: SidebarMode) => {
    setMode(m);
    if (m === "compliance" && !COMPLIANCE_PATHS.some((p) => pathname.startsWith(p))) {
      router.push("/compliance-filings");
    } else if (m === "legal" && COMPLIANCE_PATHS.some((p) => pathname.startsWith(p))) {
      router.push(isPro ? "/pro/dashboard" : "/dashboard");
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.push("/");
  };

  return (
    <aside className="flex flex-col h-full" style={{ background: "var(--vk-navy-dark)" }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--vk-border)" }}>
        <Link href={isAdmin ? "/admin" : isPro ? "/pro/dashboard" : isClient ? "/client" : "/dashboard"} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))" }}>
            <Scale className="w-4 h-4 text-navy" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight gold-gradient-text">VakilAI</span>
            <span className="block text-[10px] leading-none" style={{ color: "var(--vk-text-dim)" }}>Legal Intelligence</span>
          </div>
        </Link>
      </div>

      {/* Mode toggle — shown for consumer + pro, hidden for client/admin */}
      {!isClient && !isAdmin && <ModeToggle mode={mode} onChange={handleModeChange} />}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {navEntries.map((entry, i) => {
          if (isSection(entry)) return <SectionLabel key={i} label={entry.label} />;
          if (isGroup(entry)) return <NavGroupRow key={entry.label} group={entry} pathname={pathname} />;
          const item = entry as NavItem;
          return (
            <NavItemRow
              key={item.href}
              item={item}
              active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
            />
          );
        })}

        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--vk-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pb-1.5" style={{ color: "var(--vk-text-dim)" }}>
            Account
          </p>
          <NavItemRow
            item={{ href: "/settings", label: "Settings", icon: Settings }}
            active={pathname === "/settings"}
          />
        </div>
      </nav>

      {/* Upgrade nudge (consumer free only) */}
      {!isPro && !isClient && !isAdmin && user?.subscription_plan === "free" && (
        <div className="mx-3 mb-3 p-3 rounded-lg" style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.15)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold" style={{ color: "var(--vk-gold-light)" }}>Free Plan</span>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--vk-text-muted)" }}>5 AI queries/day</p>
          <Link href="/settings?tab=billing">
            <button className="w-full text-xs py-1.5 rounded-md font-semibold transition-colors"
              style={{ background: "var(--vk-gold)", color: "var(--vk-navy)" }}>
              Upgrade to Pro
            </button>
          </Link>
        </div>
      )}

      {/* User footer */}
      <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: "var(--vk-border)" }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}>
            {user ? getInitials(user.name) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--vk-text)" }}>
              {user?.name ?? "Guest"}
            </p>
            <p className="text-[10px] truncate capitalize" style={{ color: "var(--vk-text-dim)" }}>
              {user?.role?.replace("_", " ")} · {user?.subscription_plan}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="p-1.5 rounded-md transition-colors hover:bg-white/10"
            style={{ color: "var(--vk-text-dim)" }}
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
