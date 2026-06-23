"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanGate } from "@/contexts/PlanGateContext";
import { isProRole } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Bell, Lock } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** If true, non-pro (consumer/client) users are redirected to /dashboard */
  requirePro?: boolean;
  /** If true, pro users are redirected to /pro/dashboard */
  requireConsumer?: boolean;
  /**
   * Feature ID from lib/plans.ts — if the user's plan does not include
   * this feature, the upgrade dialog is shown automatically on page load.
   */
  requiredFeature?: string;
}

export function AppLayout({
  children,
  title,
  subtitle,
  actions,
  requirePro,
  requireConsumer,
  requiredFeature,
}: AppLayoutProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { openGate } = usePlanGate();
  const router = useRouter();

  const isPro = user ? isProRole(user.role) : false;

  // Role-based redirects
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    if (requirePro && !isPro) {
      router.push("/dashboard");
      return;
    }
    if (requireConsumer && isPro) {
      router.push("/pro/dashboard");
    }
  }, [isAuthenticated, isLoading, isPro, requirePro, requireConsumer, router]);

  // Plan-based gate — show upgrade dialog if the feature is locked
  useEffect(() => {
    if (isLoading || !isAuthenticated || !requiredFeature) return;
    openGate(requiredFeature);
  }, [isLoading, isAuthenticated, requiredFeature, openGate]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="text-sm text-dim">Loading VakilAI…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Show lock screen while role redirect is in flight
  if (requirePro && !isPro) {
    return (
      <div className="h-screen flex items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-3 text-center">
          <Lock className="w-8 h-8 text-dim" />
          <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>Pro feature</p>
          <p className="text-xs text-dim">Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-navy">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r" style={{ borderColor: "var(--vk-border)" }}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        {(title || actions) && (
          <header
            className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--vk-border)", background: "rgba(8,15,30,0.6)", backdropFilter: "blur(8px)" }}
          >
            <div>
              {title && <h1 className="page-title">{title}</h1>}
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <button className="btn-ghost p-2 relative" title="Notifications">
                <Bell className="w-4 h-4" />
                <span
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--vk-gold)" }}
                />
              </button>
            </div>
          </header>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
