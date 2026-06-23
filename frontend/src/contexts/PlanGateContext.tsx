"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Lock, Zap, ArrowRight, X, Crown, TrendingUp, Building2,
  BadgeCheck, Sparkles,
} from "lucide-react";

import { FEATURES, hasFeatureAccess, type FeatureDef } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";

// ── Context ───────────────────────────────────────────────────────────────────

interface PlanGateContextValue {
  /** Check access and open upgrade dialog if blocked. Returns true if allowed. */
  openGate: (featureId: string) => boolean;
}

const PlanGateContext = createContext<PlanGateContextValue | null>(null);

export function PlanGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<FeatureDef | null>(null);

  const openGate = useCallback(
    (featureId: string): boolean => {
      const allowed = hasFeatureAccess(user?.subscription_plan, featureId);
      if (!allowed) {
        const feat = FEATURES[featureId];
        if (feat) setBlocked(feat);
      }
      return allowed;
    },
    [user?.subscription_plan]
  );

  return (
    <PlanGateContext.Provider value={{ openGate }}>
      {children}
      {blocked && (
        <PlanGateDialog feature={blocked} onClose={() => setBlocked(null)} />
      )}
    </PlanGateContext.Provider>
  );
}

export function usePlanGate() {
  const ctx = useContext(PlanGateContext);
  if (!ctx) throw new Error("usePlanGate must be used inside PlanGateProvider");
  return ctx;
}

// ── Plan meta ────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: TrendingUp,
  plus: Sparkles,
  advocate_starter: BadgeCheck,
  advocate_pro: Crown,
  advocate_firm: Building2,
};

const PLAN_PRICES: Record<string, string> = {
  starter: "₹199 / mo",
  plus: "₹499 / mo",
  advocate_starter: "₹999 / mo",
  advocate_pro: "₹2,499 / mo",
  advocate_firm: "₹6,999 / mo",
};

const ADVOCATE_HIGHLIGHTS = [
  "Unlimited AI research across 4M+ judgments",
  "Full case & client management",
  "Judge analytics & litigation safety check",
];

const INDIVIDUAL_HIGHLIGHTS = [
  "Unlimited AI legal queries",
  "150+ document templates & AI generation",
  "AI lawyer matching & case tracker",
];

// ── Dialog ────────────────────────────────────────────────────────────────────

function PlanGateDialog({
  feature,
  onClose,
}: {
  feature: FeatureDef;
  onClose: () => void;
}) {
  const router = useRouter();
  const PlanIcon = PLAN_ICONS[feature.upgradeTo] ?? Zap;
  const planPrice = PLAN_PRICES[feature.upgradeTo] ?? "";
  const highlights = feature.isAdvocateFeature ? ADVOCATE_HIGHLIGHTS : INDIVIDUAL_HIGHLIGHTS;

  function goToPlans() {
    onClose();
    router.push("/settings?tab=billing");
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--vk-navy-card)", border: "1px solid var(--vk-border)" }}
      >
        {/* Gold top strip */}
        <div className="h-1" style={{ background: "linear-gradient(90deg, var(--vk-gold), var(--vk-gold-light))" }} />

        <div className="p-6">
          {/* Close button */}
          <div className="flex justify-end -mt-1 mb-3">
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)" }}
            >
              <Lock className="w-7 h-7 text-gold" />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--vk-text)" }}>
              {feature.name}
            </h2>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--vk-text-muted)" }}>
              {feature.description}
            </p>
          </div>

          {/* Required plan pill */}
          <div
            className="rounded-xl p-4 mb-5 flex items-center gap-4"
            style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.25)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(201,168,76,0.2)" }}
            >
              <PlanIcon className="w-5 h-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]" style={{ color: "var(--vk-text-muted)" }}>Required plan</p>
              <p className="text-sm font-bold text-gold truncate">{feature.upgradeLabel}</p>
            </div>
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--vk-text)" }}>
              {planPrice}
            </span>
          </div>

          {/* What you get */}
          <p className="text-xs font-medium mb-2.5" style={{ color: "var(--vk-text-muted)" }}>
            Unlock with this plan:
          </p>
          <ul className="space-y-2 mb-6">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                <span className="text-xs" style={{ color: "var(--vk-text-muted)" }}>{h}</span>
              </li>
            ))}
            <li className="flex items-center gap-2.5 pl-4">
              <span className="text-xs" style={{ color: "var(--vk-text-muted)" }}>…and much more on the plan page</span>
            </li>
          </ul>

          {/* CTA */}
          <button
            className="btn-primary w-full text-sm flex items-center justify-center gap-2 mb-2"
            onClick={goToPlans}
          >
            <Zap className="w-4 h-4" />
            View Plans & Upgrade
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            className="w-full text-xs py-2 transition-colors"
            style={{ color: "var(--vk-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--vk-gold)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--vk-text-muted)")}
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
