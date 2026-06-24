"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, FileText, Users, Scale, ArrowRight,
  Clock, Shield, BookOpen, Zap, PhoneCall,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

const QUICK_ACTIONS = [
  { href: "/chat",         label: "Ask a legal question",  icon: MessageSquare, desc: "AI answers in seconds",        color: "var(--vk-gold)" },
  { href: "/consultation", label: "Consultation & Review",  icon: PhoneCall,     desc: "Book a lawyer or review docs", color: "#f97316" },
  { href: "/documents",    label: "Generate a document",    icon: FileText,      desc: "150+ legal templates",         color: "#60a5fa" },
  { href: "/lawyers",      label: "Find a lawyer",          icon: Users,         desc: "AI-matched advocates",          color: "#4ade80" },
];

const RECENT_TOPICS = [
  "Can my landlord evict me without notice?",
  "Employee rights during termination",
  "How to file an RTI application?",
  "Consumer complaint against e-commerce",
];

export default function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();

  return (
    <AppLayout
      title={`Good ${now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, ${user?.name?.split(" ")[0] ?? "there"}`}
      subtitle="Your legal dashboard — all your tools in one place"
      requireConsumer
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="AI Queries Today"
          value="0"
          subtitle={user?.subscription_plan === "free" ? "Free plan: 5/day" : "Unlimited"}
          icon={MessageSquare}
        />
        <StatCard
          title="Documents"
          value="0"
          subtitle="Generated this month"
          icon={FileText}
        />
        <StatCard
          title="Consultations"
          value="0"
          subtitle="With advocates"
          icon={Users}
        />
        <StatCard
          title="Member Since"
          value={user ? formatDate(user.created_at) : "—"}
          subtitle={`Plan: ${user?.subscription_plan ?? "free"}`}
          icon={Scale}
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-dim mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, desc, color }) => (
            <Link key={href} href={href}>
              <div className="vk-card vk-card-hover p-4 h-full cursor-pointer group">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--vk-text)" }}>
                  {label}
                </p>
                <p className="text-xs text-dim">{desc}</p>
                <ArrowRight className="w-3.5 h-3.5 mt-3 text-dim group-hover:text-gold transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent AI queries */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim mb-4">
            Try Asking
          </h2>
          <div className="vk-card overflow-hidden">
            {RECENT_TOPICS.map((topic, i) => (
              <Link key={i} href={`/chat?q=${encodeURIComponent(topic)}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ borderBottom: i < RECENT_TOPICS.length - 1 ? "1px solid var(--vk-border)" : "none" }}
                >
                  <MessageSquare className="w-4 h-4 text-gold shrink-0" />
                  <span className="text-sm flex-1" style={{ color: "var(--vk-text-muted)" }}>
                    {topic}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-dim" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Resources / Upgrade */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim mb-4">
            Resources
          </h2>
          <div className="space-y-3">
            {[
              { href: "/rights", icon: Shield, label: "Know Your Rights", desc: "Tenant, Employee, Consumer rights explained", color: "#a78bfa" },
              { href: "/lawyers", icon: Users, label: "Lawyer Marketplace", desc: "500+ verified advocates across India", color: "#4ade80" },
              { href: "/documents", icon: FileText, label: "Document Templates", desc: "150+ ready-to-use legal templates", color: "#60a5fa" },
            ].map(({ href, icon: Icon, label, desc, color }) => (
              <Link key={href} href={href}>
                <div className="vk-card vk-card-hover p-4 flex items-center gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--vk-text)" }}>{label}</p>
                    <p className="text-xs text-dim">{desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-dim" />
                </div>
              </Link>
            ))}

            {user?.subscription_plan === "free" && (
              <div
                className="p-4 rounded-xl mt-2"
                style={{
                  background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(15,23,42,0.8) 100%)",
                  border: "1px solid rgba(201,168,76,0.2)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold text-gold-light">Upgrade to Pro</span>
                </div>
                <p className="text-xs text-dim mb-3">
                  Unlimited AI queries, priority lawyer matching, and document generation.
                </p>
                <Link href="/settings?tab=billing">
                  <button className="btn-primary text-xs py-2">View Plans</button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
