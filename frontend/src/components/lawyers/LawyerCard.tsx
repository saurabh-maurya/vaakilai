import type { Lawyer } from "@/types";
import { Star, MapPin, Clock, BadgeCheck, Video, MessageSquare, Phone } from "lucide-react";
import { formatCurrency, getInitials } from "@/lib/utils";
import Link from "next/link";

interface LawyerCardProps {
  lawyer: Lawyer;
  showMatchScore?: boolean;
}

const MODE_ICONS: Record<string, React.ElementType> = {
  video: Video,
  chat: MessageSquare,
  phone: Phone,
};

export function LawyerCard({ lawyer, showMatchScore }: LawyerCardProps) {
  return (
    <div className="vk-card vk-card-hover p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}
        >
          {getInitials(lawyer.name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate" style={{ color: "var(--vk-text)" }}>
              {lawyer.name}
            </h3>
            {lawyer.is_verified && (
              <span className="vk-badge vk-badge-green text-[10px]">
                <BadgeCheck className="w-3 h-3" />
                Verified
              </span>
            )}
            {showMatchScore && lawyer.match_score !== undefined && (
              <span className="vk-badge vk-badge-gold text-[10px]">
                {Math.round(lawyer.match_score * 100)}% match
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-dim">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lawyer.location}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lawyer.experience_years}y exp.
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-gold" />
              {lawyer.rating.toFixed(1)} ({lawyer.review_count})
            </span>
          </div>

          {/* Practice areas */}
          <div className="flex flex-wrap gap-1 mt-2">
            {lawyer.practice_areas.slice(0, 3).map((area) => (
              <span key={area} className="vk-badge vk-badge-muted">{area}</span>
            ))}
            {lawyer.practice_areas.length > 3 && (
              <span className="vk-badge vk-badge-muted">+{lawyer.practice_areas.length - 3}</span>
            )}
          </div>

          {/* Match reason */}
          {showMatchScore && lawyer.match_reason && (
            <p className="text-xs mt-2 text-dim italic">&ldquo;{lawyer.match_reason}&rdquo;</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--vk-border)" }}>
        <div className="flex items-center gap-2">
          {lawyer.consultation_modes.slice(0, 3).map((mode) => {
            const Icon = MODE_ICONS[mode];
            return Icon ? (
              <span key={mode} className="text-dim" title={mode}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            ) : null;
          })}
          <span className="text-xs text-dim">
            {formatCurrency(lawyer.fee_per_hour)}/hr
          </span>
        </div>
        <Link href={`/lawyers/${lawyer.id}`}>
          <button className="btn-primary text-xs py-1.5 px-3">View Profile</button>
        </Link>
      </div>
    </div>
  );
}
