"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  Briefcase, Users, Receipt, TrendingUp,
  Clock, AlertCircle, Calendar, ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function ProDashboardPage() {
  const { user } = useAuth();

  return (
    <AppLayout
      title={`Welcome, ${user?.name?.split(" ")[0] ?? "Advocate"}`}
      subtitle="Your practice at a glance"
      requirePro
      actions={
        <Link href="/pro/cases">
          <button className="btn-primary text-xs">+ New Case</button>
        </Link>
      }
    >
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Cases" value="0" subtitle="No cases yet" icon={Briefcase} />
        <StatCard title="Total Clients" value="0" subtitle="No clients yet" icon={Users} />
        <StatCard title="Revenue (This Month)" value="₹0" subtitle="No invoices yet" icon={TrendingUp} />
        <StatCard title="Pending Invoices" value="0" subtitle="All clear" icon={Receipt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Empty revenue state */}
        <div className="lg:col-span-2 vk-card p-5">
          <h2 className="text-sm font-semibold mb-4">Revenue Trend</h2>
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <TrendingUp className="w-10 h-10 mb-3" style={{ color: "var(--vk-text-dim)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--vk-text-muted)" }}>No revenue data yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--vk-text-dim)" }}>Create invoices to track your earnings</p>
            <Link href="/pro/billing" className="mt-3">
              <button className="btn-secondary text-xs">Go to Billing</button>
            </Link>
          </div>
        </div>

        {/* Empty hearings state */}
        <div className="vk-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Upcoming Hearings</h2>
            <Link href="/pro/cases" className="text-xs text-gold hover:text-gold-light">View all</Link>
          </div>
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Calendar className="w-8 h-8 mb-3" style={{ color: "var(--vk-text-dim)" }} />
            <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>No upcoming hearings</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--vk-text-dim)" }}>Add cases to track hearings</p>
          </div>
        </div>
      </div>

      {/* Activity + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Empty activity state */}
        <div className="lg:col-span-2 vk-card p-5">
          <h2 className="text-sm font-semibold mb-4">Recent Activity</h2>
          <div className="flex flex-col items-center justify-center h-36 text-center">
            <Clock className="w-8 h-8 mb-3" style={{ color: "var(--vk-text-dim)" }} />
            <p className="text-xs" style={{ color: "var(--vk-text-muted)" }}>No activity yet</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--vk-text-dim)" }}>Your actions will appear here</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="vk-card p-5">
          <h2 className="text-sm font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: "/pro/cases",    label: "Add new case",       icon: Briefcase },
              { href: "/pro/research", label: "AI legal research",   icon: Clock },
              { href: "/pro/billing",  label: "Generate invoice",    icon: Receipt },
              { href: "/chat",         label: "AI consultation",     icon: AlertCircle },
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
