"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import {
  Briefcase, Users, Receipt, TrendingUp, Clock,
  AlertCircle, Calendar, ArrowRight, CheckCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const REVENUE_DATA = [
  { month: "Jan", revenue: 45000 }, { month: "Feb", revenue: 62000 },
  { month: "Mar", revenue: 58000 }, { month: "Apr", revenue: 71000 },
  { month: "May", revenue: 84000 }, { month: "Jun", revenue: 96000 },
];

const UPCOMING_HEARINGS = [
  { case: "Sharma vs. Govt of UP", court: "Allahabad HC", date: "2026-06-20", type: "Criminal" },
  { case: "Nexus Ventures Ltd. vs. ABC Corp", court: "Delhi HC", date: "2026-06-22", type: "Commercial" },
  { case: "Mehta v. Housing Society", court: "Mumbai Sessions", date: "2026-06-25", type: "Civil" },
];

const RECENT_ACTIVITY = [
  { label: "New client added", sub: "Priya Mehta", time: "2h ago", icon: Users, color: "#4ade80" },
  { label: "Invoice #INV-042 sent", sub: "₹25,000 — Nexus Ventures", time: "4h ago", icon: Receipt, color: "#60a5fa" },
  { label: "Case hearing updated", sub: "Sharma vs. Govt — Jun 20", time: "Yesterday", icon: Calendar, color: "#fbbf24" },
  { label: "Research memo generated", sub: "Bail jurisprudence — Sec 439", time: "Yesterday", icon: CheckCircle, color: "#a78bfa" },
];

export default function ProDashboardPage() {
  return (
    <AppLayout
      title="Pro Dashboard"
      subtitle="Your practice at a glance"
      actions={
        <Link href="/pro/cases">
          <button className="btn-primary text-xs">+ New Case</button>
        </Link>
      }
    >
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Cases" value="24" icon={Briefcase} trend={{ value: 4, label: "this month" }} />
        <StatCard title="Total Clients" value="67" icon={Users} trend={{ value: 12, label: "this quarter" }} />
        <StatCard title="Revenue (Jun)" value={formatCurrency(96000)} icon={TrendingUp} trend={{ value: 14, label: "vs. May" }} />
        <StatCard title="Pending Invoices" value="₹1.2L" subtitle="3 overdue" icon={Receipt} trend={{ value: -5, label: "overdue" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 vk-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Revenue Trend (2026)</h2>
            <span className="vk-badge vk-badge-green text-xs">+14% vs. last month</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "var(--vk-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--vk-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                contentStyle={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)", borderRadius: "0.5rem", fontSize: 12 }}
                formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#C9A84C" strokeWidth={2} fill="url(#goldGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming hearings */}
        <div className="vk-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Upcoming Hearings</h2>
            <Link href="/pro/cases" className="text-xs text-gold hover:text-gold-light">View all</Link>
          </div>
          <div className="space-y-3">
            {UPCOMING_HEARINGS.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--vk-border)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium truncate max-w-[160px]">{h.case}</p>
                    <p className="text-[11px] text-dim mt-0.5">{h.court}</p>
                  </div>
                  <span className="vk-badge vk-badge-muted text-[10px] shrink-0">{h.type}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Calendar className="w-3 h-3 text-gold" />
                  <span className="text-[11px] text-gold">{formatDate(h.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 vk-card p-5">
          <h2 className="text-sm font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map(({ label, sub, time, icon: Icon, color }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[11px] text-dim">{sub}</p>
                </div>
                <span className="text-[11px] text-dim shrink-0">{time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="vk-card p-5">
          <h2 className="text-sm font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: "/pro/cases", label: "Add new case", icon: Briefcase },
              { href: "/pro/research", label: "AI legal research", icon: Clock },
              { href: "/pro/billing", label: "Generate invoice", icon: Receipt },
              { href: "/chat", label: "AI consultation", icon: AlertCircle },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                  <Icon className="w-4 h-4 text-gold" />
                  <span className="text-sm flex-1">{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-dim group-hover:text-gold transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
