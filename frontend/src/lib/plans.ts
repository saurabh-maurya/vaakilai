/**
 * Plan definitions and feature-gate helpers.
 * Single source of truth for what each plan includes.
 */

export type PlanId =
  | "free"
  | "starter"
  | "plus"
  | "advocate_starter"
  | "advocate_pro"
  | "advocate_firm";

export interface FeatureDef {
  id: string;
  name: string;
  description: string;
  /** Plans that include this feature */
  requiredPlans: PlanId[];
  /** Minimum plan to recommend in the upgrade dialog */
  upgradeTo: PlanId;
  upgradeLabel: string;
  /** true = advocate-only feature */
  isAdvocateFeature: boolean;
}

// ── Feature catalogue ────────────────────────────────────────────────────────

export const FEATURES: Record<string, FeatureDef> = {
  // Individual features
  document_generation: {
    id: "document_generation",
    name: "AI Document Generation",
    description: "Generate legal documents from 150+ templates using AI. Requires Starter plan or above.",
    requiredPlans: ["starter", "plus"],
    upgradeTo: "starter",
    upgradeLabel: "Starter Plan",
    isAdvocateFeature: false,
  },
  ai_lawyer_matching: {
    id: "ai_lawyer_matching",
    name: "AI Lawyer Matching",
    description: "Get matched with the best-fit verified lawyer based on your case profile.",
    requiredPlans: ["starter", "plus"],
    upgradeTo: "starter",
    upgradeLabel: "Starter Plan",
    isAdvocateFeature: false,
  },
  odr_filing: {
    id: "odr_filing",
    name: "Online Dispute Resolution",
    description: "File and manage mediation/arbitration cases online via ODR platform.",
    requiredPlans: ["starter", "plus"],
    upgradeTo: "starter",
    upgradeLabel: "Starter Plan",
    isAdvocateFeature: false,
  },
  whatsapp_alerts: {
    id: "whatsapp_alerts",
    name: "WhatsApp & SMS Alerts",
    description: "Receive hearing reminders and case updates via WhatsApp and SMS.",
    requiredPlans: ["plus"],
    upgradeTo: "plus",
    upgradeLabel: "Plus Plan",
    isAdvocateFeature: false,
  },

  // Advocate features — available on all advocate plans
  pro_research: {
    id: "pro_research",
    name: "AI Legal Research",
    description: "Search 4M+ judgments with AI-powered semantic search, precedent finder, and memo generation.",
    requiredPlans: ["advocate_starter", "advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_starter",
    upgradeLabel: "Advocate Starter Plan",
    isAdvocateFeature: true,
  },
  case_management: {
    id: "case_management",
    name: "Case Management",
    description: "Full Kanban + table view case management with hearings, documents, and client linkage.",
    requiredPlans: ["advocate_starter", "advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_starter",
    upgradeLabel: "Advocate Starter Plan",
    isAdvocateFeature: true,
  },

  // Advocate Professional+ features
  judge_analytics: {
    id: "judge_analytics",
    name: "Judge & Court Analytics",
    description: "AI analysis of a judge's ruling tendencies, grant rates, and strategic tips for your matter.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },
  litigation_safety: {
    id: "litigation_safety",
    name: "Litigation Safety Check",
    description: "Pre-filing risk check covering limitation, jurisdiction, locus standi, and cost exposure.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },
  doc_compare: {
    id: "doc_compare",
    name: "Document Comparison (Redline)",
    description: "AI-powered side-by-side comparison of two contract versions with risk change analysis.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },
  contracts_clm: {
    id: "contracts_clm",
    name: "Contract Lifecycle Management",
    description: "Track contracts from draft to expiry with clause vault, milestones, and renewal alerts.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },
  ip_portfolio: {
    id: "ip_portfolio",
    name: "IP Portfolio Management",
    description: "Track patents, trademarks, copyrights, and GI tags with renewal due-date alerts.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },
  risk_score: {
    id: "risk_score",
    name: "Case Risk Scoring",
    description: "Composite risk score across 5 dimensions: factual strength, legal merit, enforcement risk, and more.",
    requiredPlans: ["advocate_pro", "advocate_firm"],
    upgradeTo: "advocate_pro",
    upgradeLabel: "Professional Plan",
    isAdvocateFeature: true,
  },

  // Firm-only
  team_members: {
    id: "team_members",
    name: "Team Members",
    description: "Add up to 10 advocates to a shared firm workspace with pooled cases and clients.",
    requiredPlans: ["advocate_firm"],
    upgradeTo: "advocate_firm",
    upgradeLabel: "Firm Plan",
    isAdvocateFeature: true,
  },
};

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the user's current plan includes the given feature.
 * Falls back to false if plan or feature is unknown.
 */
export function hasFeatureAccess(
  userPlan: string | undefined,
  featureId: string
): boolean {
  if (!userPlan) return false;
  const feat = FEATURES[featureId];
  if (!feat) return true; // unknown feature = allow (fail-open)
  return feat.requiredPlans.includes(userPlan as PlanId);
}
