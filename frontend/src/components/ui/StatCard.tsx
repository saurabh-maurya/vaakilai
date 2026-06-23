import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; label?: string };
  icon?: React.ElementType;
  iconColor?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = "var(--vk-gold)",
  className,
}: StatCardProps) {
  const trendPositive = trend && trend.value > 0;
  const trendNeutral = trend && trend.value === 0;

  return (
    <div className={cn("vk-stat group", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vk-text-dim)" }}>
            {title}
          </p>
          <p className="text-2xl font-bold mt-1.5 tracking-tight" style={{ color: "var(--vk-text)" }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: "var(--vk-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(201,168,76,0.1)", color: iconColor }}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {trend && (
        <div className="flex items-center gap-1.5 mt-3">
          {trendNeutral ? (
            <Minus className="w-3.5 h-3.5 text-dim" />
          ) : trendPositive ? (
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--vk-success)" }} />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" style={{ color: "var(--vk-error)" }} />
          )}
          <span
            className="text-xs font-semibold"
            style={{
              color: trendNeutral
                ? "var(--vk-text-dim)"
                : trendPositive
                ? "var(--vk-success)"
                : "var(--vk-error)",
            }}
          >
            {trendPositive && "+"}
            {trend.value}%
          </span>
          {trend.label && (
            <span className="text-xs text-dim">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
