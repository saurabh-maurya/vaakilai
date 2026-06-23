"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LawyerCard } from "@/components/lawyers/LawyerCard";
import { marketplaceApi } from "@/lib/api";
import type { Lawyer, LawyerFilters } from "@/types";
import { PRACTICE_AREAS, INDIAN_STATES } from "@/lib/utils";
import { Search, Sparkles, SlidersHorizontal, X } from "lucide-react";
import toast from "react-hot-toast";

export default function LawyersPage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchMode, setMatchMode] = useState(false);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<LawyerFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const fetchLawyers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketplaceApi.searchLawyers(filters);
      setLawyers(data.items ?? []);
    } catch {
      // Use mock data when backend is unavailable
      setLawyers(MOCK_LAWYERS);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLawyers();
  }, [fetchLawyers]);

  const handleAIMatch = async () => {
    if (!matchQuery.trim()) return;
    setMatchLoading(true);
    try {
      const matched = await marketplaceApi.matchLawyers(matchQuery);
      setLawyers(matched);
      setMatchMode(true);
    } catch {
      toast.error("AI matching unavailable. Showing all lawyers.");
      setMatchMode(false);
    } finally {
      setMatchLoading(false);
    }
  };

  const displayedLawyers = searchTerm
    ? lawyers.filter(
        (l) =>
          l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.practice_areas.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
          l.location.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : lawyers;

  return (
    <AppLayout
      title="Find a Lawyer"
      subtitle="Discover and connect with verified advocates across India"
      actions={
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`btn-secondary flex items-center gap-1.5 text-xs ${showFilters ? "border-gold text-gold-light" : ""}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
        </button>
      }
    >
      {/* AI Match bar */}
      <div
        className="p-4 rounded-xl mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(30,41,59,0.8) 100%)",
          border: "1px solid rgba(201,168,76,0.2)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-gold-light">AI Lawyer Matching</span>
          <span className="vk-badge vk-badge-gold text-[10px]">Powered by LangGraph</span>
        </div>
        <p className="text-xs text-dim mb-3">
          Describe your legal situation and we&apos;ll match you with the top 3–5 most suitable advocates.
        </p>
        <div className="flex gap-2">
          <textarea
            className="vk-input flex-1 py-2 text-sm resize-none"
            rows={2}
            placeholder="e.g. I need a lawyer for a property dispute in Mumbai regarding ancestral property partition…"
            value={matchQuery}
            onChange={(e) => setMatchQuery(e.target.value)}
          />
          <button
            onClick={handleAIMatch}
            disabled={matchLoading || !matchQuery.trim()}
            className="btn-primary text-xs px-4 shrink-0"
          >
            {matchLoading ? (
              <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
            ) : (
              "Match Me"
            )}
          </button>
        </div>
        {matchMode && (
          <button
            onClick={() => { setMatchMode(false); fetchLawyers(); }}
            className="flex items-center gap-1 mt-2 text-xs text-dim hover:text-muted"
          >
            <X className="w-3 h-3" /> Clear AI match results
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 p-4 rounded-xl animate-fade-in-down"
          style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}
        >
          <div>
            <label className="vk-label text-[11px]">Practice Area</label>
            <select
              className="vk-input text-xs py-2"
              value={filters.practice_area ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, practice_area: e.target.value || undefined }))}
            >
              <option value="">All Areas</option>
              {PRACTICE_AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="vk-label text-[11px]">Location / State</label>
            <select
              className="vk-input text-xs py-2"
              value={filters.location ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value || undefined }))}
            >
              <option value="">All States</option>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="vk-label text-[11px]">Consultation Mode</label>
            <select
              className="vk-input text-xs py-2"
              value={filters.consultation_mode ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  consultation_mode: (e.target.value as "video" | "chat" | "phone" | "in_person") || undefined,
                }))
              }
            >
              <option value="">Any</option>
              <option value="video">Video Call</option>
              <option value="chat">Chat</option>
              <option value="phone">Phone</option>
              <option value="in_person">In Person</option>
            </select>
          </div>
          <div>
            <label className="vk-label text-[11px]">Min Rating</label>
            <select
              className="vk-input text-xs py-2"
              value={filters.min_rating ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, min_rating: e.target.value ? Number(e.target.value) : undefined }))}
            >
              <option value="">Any Rating</option>
              <option value="4.5">4.5+</option>
              <option value="4">4.0+</option>
              <option value="3.5">3.5+</option>
            </select>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
        <input
          className="vk-input pl-10"
          placeholder="Search by name, specialization, or location…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Results */}
      {matchMode && (
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm text-gold-light font-medium">
            AI matched {displayedLawyers.length} advocates for your case
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="vk-card p-5 h-44">
              <div className="flex gap-3 mb-3">
                <div className="vk-skeleton w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="vk-skeleton h-4 w-32" />
                  <div className="vk-skeleton h-3 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="vk-skeleton h-3 w-full" />
                <div className="vk-skeleton h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedLawyers.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--vk-gold-dim)" }}>
            <Search className="w-6 h-6 text-gold" />
          </div>
          <p className="text-sm font-medium mb-1">No lawyers found</p>
          <p className="text-xs text-dim">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedLawyers.map((lawyer) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} showMatchScore={matchMode} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}

// ── Mock data for development ─────────────────────────────────────────────
const MOCK_LAWYERS: Lawyer[] = [
  {
    id: "1", user_id: "u1", name: "Adv. Ramesh Kumar", bar_number: "UP/12345",
    practice_areas: ["Criminal Law", "Family Law", "Constitutional Law"],
    courts: ["Allahabad High Court", "Supreme Court"], experience_years: 15,
    location: "Lucknow", state: "Uttar Pradesh", languages: ["Hindi", "English"],
    bio: "Senior advocate with 15 years of experience in criminal and constitutional matters.",
    education: [{ degree: "LLB", institution: "University of Lucknow", year: 2008 }],
    rating: 4.8, review_count: 127, consultation_modes: ["video", "chat", "in_person"],
    fee_per_hour: 3000, fee_per_session: 1500, is_verified: true, is_available: true,
  },
  {
    id: "2", user_id: "u2", name: "Adv. Priya Sharma", bar_number: "MH/67890",
    practice_areas: ["Corporate Law", "Contract Law", "Intellectual Property"],
    courts: ["Bombay High Court"], experience_years: 10,
    location: "Mumbai", state: "Maharashtra", languages: ["Hindi", "English", "Marathi"],
    bio: "Corporate lawyer specializing in startup law, IP protection, and M&A transactions.",
    education: [{ degree: "LLM", institution: "ILS Law College, Pune", year: 2013 }],
    rating: 4.9, review_count: 89, consultation_modes: ["video", "chat"],
    fee_per_hour: 5000, is_verified: true, is_available: true,
  },
  {
    id: "3", user_id: "u3", name: "Adv. Kavitha Nair", bar_number: "KL/34567",
    practice_areas: ["Family Law", "Property & Real Estate", "Consumer Protection"],
    courts: ["Kerala High Court"], experience_years: 8,
    location: "Kochi", state: "Kerala", languages: ["Malayalam", "English"],
    bio: "Specializes in family disputes, property matters, and consumer rights.",
    education: [{ degree: "LLB", institution: "Government Law College, Thrissur", year: 2015 }],
    rating: 4.7, review_count: 63, consultation_modes: ["video", "phone", "in_person"],
    fee_per_hour: 2500, is_verified: true, is_available: false,
  },
];
