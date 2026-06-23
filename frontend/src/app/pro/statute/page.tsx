"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BookOpen, Sparkles, AlertCircle, Shield, Scale, Gavel, List } from "lucide-react";
import { aiApi } from "@/lib/api";

const COMMON_STATUTES = [
  { label: "Section 420 IPC — Cheating", value: "Section 420 IPC", text: "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy the whole or any part of a valuable security, or anything which is signed or sealed, and which is capable of being converted into a valuable security, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine." },
  { label: "Section 138 NI Act — Cheque Bounce", value: "Section 138 NI Act", text: "Where any cheque drawn by a person on an account maintained by him with a banker for payment of any amount of money to another person from out of that account for the discharge, in whole or in part, of any debt or other liability, is returned by the bank unpaid, either because of the amount of money standing to the credit of that account is insufficient to honour the cheque or that it exceeds the arrangement made with that bank..." },
  { label: "Article 21 — Right to Life", value: "Article 21 Constitution", text: "No person shall be deprived of his life or personal liberty except according to procedure established by law." },
  { label: "Section 302 IPC — Murder", value: "Section 302 IPC", text: "Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine." },
  { label: "Section 498A IPC — Cruelty by Husband", value: "Section 498A IPC", text: "Whoever, being the husband or the relative of the husband of a woman, subjects such woman to cruelty shall be punished with imprisonment for a term which may extend to three years and shall also be liable to fine." },
];

interface StatuteResult {
  statute_name: string;
  ingredients: string[];
  burden_of_proof: string;
  exceptions: string[];
  punishment: string;
  landmark_cases: string[];
  powered_by: string;
}

function Section({ title, icon: Icon, color, children }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  return (
    <div className="vk-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
        <h3 className="font-semibold text-sm" style={{ color }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function StatuteBreakdownPage() {
  const [statuteText, setStatuteText] = useState("");
  const [statuteName, setStatuteName] = useState("");
  const [result, setResult] = useState<StatuteResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreset = (preset: typeof COMMON_STATUTES[0]) => {
    setStatuteName(preset.value);
    setStatuteText(preset.text);
    setResult(null);
  };

  const handleBreakdown = async () => {
    if (!statuteText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await aiApi.post("/legal-tasks/statute-breakdown", {
        statute_text: statuteText,
        statute_name: statuteName,
      });
      setResult(data);
    } catch {
      setResult({
        statute_name: statuteName,
        ingredients: ["Unable to analyse statute. Please try again."],
        burden_of_proof: "",
        exceptions: [],
        punishment: "",
        landmark_cases: [],
        powered_by: "Error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout requirePro title="Statute Breakdown" subtitle="Element-by-element analysis of any Indian statute — powered by Aalap (OpenNyAI)">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Input */}
        <div className="vk-card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
            <h3 className="font-semibold text-sm">Statute Details</h3>
            <span className="vk-badge vk-badge-gold text-[10px] ml-auto">Aalap AI</span>
          </div>

          {/* Quick presets */}
          <div>
            <p className="vk-label mb-2">Quick Select</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_STATUTES.map(s => (
                <button
                  key={s.value}
                  className="vk-badge vk-badge-muted text-xs py-1.5 px-3 hover:opacity-80 transition-opacity cursor-pointer"
                  onClick={() => loadPreset(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="vk-label">Statute Name / Reference</label>
              <input
                className="vk-input w-full"
                placeholder="e.g. Section 420 IPC, Article 21 Constitution"
                value={statuteName}
                onChange={e => setStatuteName(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="vk-label">Statute Text *</label>
              <textarea
                className="vk-input w-full h-32 resize-none"
                placeholder="Paste the full text of the statute or section here..."
                value={statuteText}
                onChange={e => setStatuteText(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn-primary py-2.5 px-6 flex items-center gap-2"
            onClick={handleBreakdown}
            disabled={loading || !statuteText.trim()}
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Analysing Statute..." : "Analyse Statute"}
          </button>
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="vk-skeleton h-32 rounded-xl" />)}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {result.statute_name && (
                <h2 className="font-bold" style={{ color: "var(--vk-text)" }}>{result.statute_name}</h2>
              )}
              <p className="text-xs text-dim ml-auto">
                Analysed by <span style={{ color: "var(--vk-gold)" }}>{result.powered_by}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ingredients */}
              <div className="col-span-2">
                <Section title="Essential Ingredients" icon={List} color="#4ade80">
                  <div className="space-y-2">
                    {result.ingredients.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg p-2.5" style={{ background: "rgba(34,197,94,0.05)" }}>
                        <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              {/* Burden of proof */}
              {result.burden_of_proof && (
                <Section title="Burden of Proof" icon={Scale} color="#60a5fa">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                    {result.burden_of_proof}
                  </p>
                </Section>
              )}

              {/* Punishment */}
              {result.punishment && (
                <Section title="Punishment / Remedy" icon={Gavel} color="#f87171">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--vk-text-muted)" }}>
                    {result.punishment}
                  </p>
                </Section>
              )}

              {/* Exceptions */}
              {result.exceptions.length > 0 && (
                <Section title="Exceptions &amp; Defences" icon={Shield} color="#fbbf24">
                  <div className="space-y-1.5">
                    {result.exceptions.map((ex, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: "#fbbf24" }} />
                        <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{ex}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Landmark cases */}
              {result.landmark_cases.length > 0 && (
                <Section title="Landmark Cases" icon={BookOpen} color="var(--vk-gold)">
                  <div className="space-y-1.5">
                    {result.landmark_cases.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: "var(--vk-gold)" }} />
                        <p className="text-sm" style={{ color: "var(--vk-text-muted)" }}>{c}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
              AI analysis is for research purposes only. Statutory interpretation depends on judicial precedent and specific facts. Verify against authoritative sources and consult a qualified advocate.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
