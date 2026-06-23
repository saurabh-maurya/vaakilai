"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { marketplaceApi } from "@/lib/api";
import type { Lawyer } from "@/types";
import {
  Star, MapPin, Clock, BadgeCheck, Video, MessageSquare,
  Phone, MapIcon, ArrowLeft, Calendar,
} from "lucide-react";
import { formatCurrency, getInitials } from "@/lib/utils";
import toast from "react-hot-toast";

const MODE_LABELS: Record<string, { icon: React.ElementType; label: string }> = {
  video: { icon: Video, label: "Video Call" },
  chat: { icon: MessageSquare, label: "Chat" },
  phone: { icon: Phone, label: "Phone" },
  in_person: { icon: MapIcon, label: "In Person" },
};

export default function LawyerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<string>("");

  useEffect(() => {
    marketplaceApi
      .getLawyer(id)
      .then(setLawyer)
      .catch(() => {
        // Use mock
        setLawyer(MOCK_LAWYER);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppLayout title="Lawyer Profile">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="vk-card p-6">
            <div className="flex gap-4">
              <div className="vk-skeleton w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="vk-skeleton h-5 w-40" />
                <div className="vk-skeleton h-4 w-28" />
                <div className="vk-skeleton h-3 w-52" />
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!lawyer) {
    return (
      <AppLayout title="Lawyer Not Found">
        <p className="text-dim">This lawyer profile could not be found.</p>
      </AppLayout>
    );
  }

  const handleBook = () => {
    if (!selectedMode) { toast.error("Please select a consultation mode"); return; }
    toast.success(`Booking ${MODE_LABELS[selectedMode]?.label} consultation with ${lawyer.name}…`);
  };

  return (
    <AppLayout title="Lawyer Profile">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-dim hover:text-muted mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to search
        </button>

        {/* Header card */}
        <div className="vk-card p-6 mb-4">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
              style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}
            >
              {getInitials(lawyer.name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-lg font-bold">{lawyer.name}</h1>
                {lawyer.is_verified && (
                  <span className="vk-badge vk-badge-green">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
                {!lawyer.is_available && (
                  <span className="vk-badge vk-badge-muted">Unavailable</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-dim mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lawyer.location}, {lawyer.state}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lawyer.experience_years} years experience</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-gold" />
                  {lawyer.rating.toFixed(1)} ({lawyer.review_count} reviews)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lawyer.practice_areas.map((a) => (
                  <span key={a} className="vk-badge vk-badge-gold text-[11px]">{a}</span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-dim">Starting from</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(lawyer.fee_per_session ?? lawyer.fee_per_hour)}</p>
              <p className="text-xs text-dim">{lawyer.fee_per_session ? "per session" : "per hour"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: Details */}
          <div className="md:col-span-2 space-y-4">
            {/* Bio */}
            <div className="vk-card p-5">
              <h2 className="text-sm font-semibold mb-3">About</h2>
              <p className="text-sm text-dim leading-relaxed">{lawyer.bio}</p>
            </div>

            {/* Education */}
            <div className="vk-card p-5">
              <h2 className="text-sm font-semibold mb-3">Education</h2>
              <div className="space-y-2">
                {lawyer.education.map((edu, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    <span className="text-sm text-dim">
                      {edu.degree} — {edu.institution} ({edu.year})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Courts */}
            <div className="vk-card p-5">
              <h2 className="text-sm font-semibold mb-3">Enrolled Courts</h2>
              <div className="flex flex-wrap gap-2">
                {lawyer.courts.map((court) => (
                  <span key={court} className="vk-badge vk-badge-muted">{court}</span>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div className="vk-card p-5">
              <h2 className="text-sm font-semibold mb-3">Languages</h2>
              <div className="flex flex-wrap gap-2">
                {lawyer.languages.map((lang) => (
                  <span key={lang} className="vk-badge vk-badge-blue">{lang}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Booking */}
          <div>
            <div className="vk-card p-5 sticky top-4">
              <h2 className="text-sm font-semibold mb-4">Book Consultation</h2>

              <p className="text-xs text-dim mb-2">Select mode</p>
              <div className="space-y-2 mb-4">
                {lawyer.consultation_modes.map((mode) => {
                  const { icon: Icon, label } = MODE_LABELS[mode] ?? {};
                  if (!Icon) return null;
                  return (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-sm transition-all"
                      style={{
                        background: selectedMode === mode ? "var(--vk-gold-dim)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${selectedMode === mode ? "rgba(201,168,76,0.3)" : "var(--vk-border)"}`,
                        color: selectedMode === mode ? "var(--vk-gold-light)" : "var(--vk-text-muted)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--vk-border)" }}>
                <Calendar className="w-4 h-4 text-dim" />
                <span className="text-xs text-dim">Calendar booking coming soon</span>
              </div>

              <button
                onClick={handleBook}
                disabled={!lawyer.is_available}
                className="btn-primary w-full"
              >
                {lawyer.is_available ? "Book Now" : "Currently Unavailable"}
              </button>

              <p className="text-[10px] text-dim text-center mt-3">
                Secure escrow payment · GST-compliant invoice
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

const MOCK_LAWYER: Lawyer = {
  id: "1", user_id: "u1", name: "Adv. Ramesh Kumar", bar_number: "UP/12345",
  practice_areas: ["Criminal Law", "Family Law", "Constitutional Law"],
  courts: ["Allahabad High Court", "Supreme Court of India"], experience_years: 15,
  location: "Lucknow", state: "Uttar Pradesh", languages: ["Hindi", "English"],
  bio: "Senior advocate Ramesh Kumar has over 15 years of experience handling criminal, constitutional, and family law matters. He has appeared before the Allahabad High Court and Supreme Court of India in several landmark cases. His approach combines meticulous research with a client-centric communication style.",
  education: [
    { degree: "LLM (Criminal Law)", institution: "National Law University, Delhi", year: 2010 },
    { degree: "LLB", institution: "University of Lucknow", year: 2008 },
  ],
  rating: 4.8, review_count: 127,
  consultation_modes: ["video", "chat", "phone", "in_person"],
  fee_per_hour: 3000, fee_per_session: 1500, is_verified: true, is_available: true,
};
