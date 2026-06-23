import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy, h:mm a");
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + "…" : str;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function getConfidenceLabel(score: number): string {
  const pct = Math.round(score * 100);
  if (pct >= 75) return `${pct}% confident`;
  if (pct >= 50) return `${pct}% confident (moderate)`;
  return `${pct}% confident (low)`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
];

export const PRACTICE_AREAS = [
  "Family Law", "Property & Real Estate", "Criminal Law", "Consumer Protection",
  "Labour & Employment", "Corporate & Business", "Intellectual Property", "Taxation",
  "Banking & Finance", "Immigration", "Cyber Law", "Environmental Law",
  "Constitutional Law", "Contract Law", "Insurance", "Medical Negligence",
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "ml", label: "Malayalam" },
  { code: "pa", label: "Punjabi" },
];

export function isProRole(role: string): boolean {
  return ["lawyer", "firm_admin", "admin"].includes(role);
}

export function planDisplayName(plan: string): string {
  const names: Record<string, string> = {
    free: "Free",
    basic: "Basic",
    business: "Business",
    pro: "Pro",
    firm: "Firm",
  };
  return names[plan] ?? plan;
}
