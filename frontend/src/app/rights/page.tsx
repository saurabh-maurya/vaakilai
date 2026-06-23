"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Home, Briefcase, ShoppingCart, Shield, Gavel, Users,
  ChevronDown, ChevronUp, ArrowRight, MessageSquare,
} from "lucide-react";
import Link from "next/link";

const RIGHTS_TOPICS = [
  {
    id: "tenant",
    icon: Home,
    title: "Tenant Rights",
    category: "Property",
    summary: "Rights of tenants under Indian Rent Control Acts and Transfer of Property Act.",
    color: "#60a5fa",
    steps: [
      { title: "Written Agreement", desc: "Always insist on a registered rent agreement. Verbal agreements are harder to enforce." },
      { title: "Notice Period", desc: "Landlord must give 30–90 days notice before eviction (varies by state law)." },
      { title: "Security Deposit", desc: "Maximum 2–3 months rent in most states. Must be refunded within 30 days of vacating." },
      { title: "Essential Services", desc: "Landlord cannot cut water, electricity, or other essential services as eviction tactic." },
      { title: "Maintenance", desc: "Major structural repairs are landlord's responsibility unless lease says otherwise." },
    ],
  },
  {
    id: "employee",
    icon: Briefcase,
    title: "Employee Rights",
    category: "Labour",
    summary: "Rights under Industrial Disputes Act, Payment of Wages Act, and related legislation.",
    color: "#4ade80",
    steps: [
      { title: "Appointment Letter", desc: "Every employee is entitled to a written appointment letter specifying terms." },
      { title: "Notice Before Termination", desc: "For employees with 1+ year of service: 30–90 days notice or equivalent pay." },
      { title: "Gratuity", desc: "After 5 years of continuous service, you are entitled to gratuity under Payment of Gratuity Act." },
      { title: "PF & ESI", desc: "Employer must contribute to Provident Fund (12%) and ESIC where applicable." },
      { title: "Wrongful Termination", desc: "You can challenge wrongful termination via Labour Court within 3 years." },
    ],
  },
  {
    id: "consumer",
    icon: ShoppingCart,
    title: "Consumer Rights",
    category: "Consumer",
    summary: "Rights under Consumer Protection Act 2019 and remedies available.",
    color: "#f59e0b",
    steps: [
      { title: "Right to Information", desc: "Seller must disclose quality, quantity, price, and hazards of goods/services." },
      { title: "Complaint Forum", desc: "District Forum (up to ₹1 crore), State Commission (₹1–10 crore), NCDRC (above ₹10 crore)." },
      { title: "Time Limit", desc: "File complaint within 2 years of cause of action. Can be condoned for valid reasons." },
      { title: "E-Commerce", desc: "CCPA has specific guidelines for e-commerce; refunds must be processed within 30 days." },
      { title: "Unfair Trade Practices", desc: "False advertising, misleading claims are actionable. Penalties up to ₹10 lakh." },
    ],
  },
  {
    id: "arrest",
    icon: Gavel,
    title: "Rights on Arrest",
    category: "Criminal",
    summary: "Constitutional and statutory rights when detained or arrested by police.",
    color: "#a78bfa",
    steps: [
      { title: "Right to Know Grounds", desc: "Police must tell you why you are being arrested under Section 50 CrPC (now BNSS)." },
      { title: "Right to Bail", desc: "For bailable offences, bail is a right. For non-bailable offences, you can apply to Magistrate/Sessions Court." },
      { title: "Right to Lawyer", desc: "You have the right to consult and be defended by a lawyer of your choice (Article 22)." },
      { title: "Produced Before Magistrate", desc: "Must be produced within 24 hours of arrest (excluding travel time)." },
      { title: "No Torture", desc: "Custodial torture is illegal. File complaint with NHRC or High Court if subjected to it." },
    ],
  },
  {
    id: "domestic-violence",
    icon: Shield,
    title: "Domestic Violence",
    category: "Family",
    summary: "Protection under Protection of Women from Domestic Violence Act 2005.",
    color: "#f87171",
    steps: [
      { title: "File Domestic Incident Report", desc: "Report to Protection Officer, police, or service provider. No court fees for victim." },
      { title: "Protection Order", desc: "Court can pass order within 3 days prohibiting abuser from contacting you." },
      { title: "Residence Order", desc: "Right to reside in shared household. Abuser cannot dispossess you." },
      { title: "Maintenance", desc: "Entitled to monetary relief to cover medical expenses, loss of income, etc." },
      { title: "Helplines", desc: "National Women Helpline: 181 | Police: 100 | NCW Helpline: 7827170170" },
    ],
  },
  {
    id: "rti",
    icon: Users,
    title: "RTI — Right to Information",
    category: "Constitutional",
    summary: "How to file an RTI application under the RTI Act 2005.",
    color: "#34d399",
    steps: [
      { title: "Who Can File", desc: "Any Indian citizen can file an RTI to any central or state public authority." },
      { title: "Filing Process", desc: "Write application to PIO of concerned department. Pay ₹10 fee (BPL exempt)." },
      { title: "Response Timeline", desc: "PIO must respond within 30 days (48 hours if life/liberty involved)." },
      { title: "First Appeal", desc: "If unsatisfied, appeal to First Appellate Authority within 30 days of response." },
      { title: "Second Appeal / Complaint", desc: "Appeal to Central/State Information Commission if First Appellate fails." },
    ],
  },
];

export default function RightsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const categories = Array.from(new Set(RIGHTS_TOPICS.map((t) => t.category)));
  const filtered = selectedCategory
    ? RIGHTS_TOPICS.filter((t) => t.category === selectedCategory)
    : RIGHTS_TOPICS;

  return (
    <AppLayout
      title="Know Your Rights"
      subtitle="Plain-language guides to your legal rights in India"
    >
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory("")}
          className={`vk-badge cursor-pointer ${!selectedCategory ? "vk-badge-gold" : "vk-badge-muted"}`}
        >
          All Topics
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
            className={`vk-badge cursor-pointer ${selectedCategory === cat ? "vk-badge-gold" : "vk-badge-muted"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((topic) => {
          const Icon = topic.icon;
          const isExpanded = expandedId === topic.id;
          return (
            <div key={topic.id} className="vk-card overflow-hidden">
              {/* Header */}
              <button
                className="w-full flex items-start gap-4 p-5 text-left"
                onClick={() => setExpandedId(isExpanded ? null : topic.id)}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${topic.color}18`, color: topic.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{topic.title}</span>
                    <span className="vk-badge vk-badge-muted text-[10px]">{topic.category}</span>
                  </div>
                  <p className="text-xs text-dim leading-relaxed">{topic.summary}</p>
                </div>
                <div className="shrink-0 mt-0.5 text-dim">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Steps */}
              {isExpanded && (
                <div
                  className="px-5 pb-5 animate-fade-in"
                  style={{ borderTop: "1px solid var(--vk-border)" }}
                >
                  <div className="space-y-3 mt-4">
                    {topic.steps.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{ background: `${topic.color}20`, color: topic.color }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-0.5">{step.title}</p>
                          <p className="text-xs text-dim leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--vk-border)" }}>
                    <Link
                      href={`/chat?q=${encodeURIComponent(`Tell me more about ${topic.title} in India`)}`}
                      className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ask AI for more details
                    </Link>
                    <span className="text-dim">·</span>
                    <Link
                      href="/lawyers"
                      className="flex items-center gap-1.5 text-xs text-dim hover:text-muted transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Find a specialist lawyer
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emergency contacts */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
      >
        <p className="text-xs font-semibold text-red-400 mb-2">Emergency Helplines</p>
        <div className="flex flex-wrap gap-4 text-xs text-dim">
          {[
            { label: "Police", num: "100" },
            { label: "Women Helpline", num: "181" },
            { label: "Child Helpline", num: "1098" },
            { label: "Legal Aid (NALSA)", num: "15100" },
            { label: "Senior Citizens", num: "14567" },
          ].map(({ label, num }) => (
            <span key={label}>
              <span className="text-muted font-medium">{label}:</span>{" "}
              <a href={`tel:${num}`} className="text-gold hover:text-gold-light">{num}</a>
            </span>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
