// ── Auth & Users ──────────────────────────────────────────────────────────

export type UserRole = "consumer" | "lawyer" | "firm_admin" | "client_portal" | "admin";

export type SubscriptionPlan =
  | "free" | "starter" | "plus"
  | "advocate_starter" | "advocate_pro" | "advocate_firm"
  | "basic" | "business" | "pro"; // legacy aliases

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  subscription_plan: SubscriptionPlan;
  language_preference: string;
  state?: string;
  is_active: boolean;
  mfa_enabled: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole;
}

/** Auth response — JWT is in the httpOnly cookie, not in the body. */
export interface TokenResponse {
  token_type: string;
  user: User;
}

// ── Chat / Consultation ──────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface Citation {
  id: string;
  title: string;
  court?: string;
  year?: number;
  citation_id?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  citations?: Citation[];
  confidence?: number;
  disclaimer?: boolean;
  isStreaming?: boolean;
}

export interface ConsultRequest {
  query: string;
  jurisdiction?: string;
  practice_area?: string;
  language?: string;
  conversation_history?: { role: MessageRole; content: string }[];
}

export interface ConsultStreamChunk {
  type: "content" | "citations" | "confidence" | "done" | "error";
  data: string | Citation[] | number | null;
}

// ── Lawyers / Marketplace ────────────────────────────────────────────────

export type ConsultationMode = "video" | "chat" | "phone" | "in_person";

export interface Lawyer {
  id: string;
  user_id: string;
  name: string;
  avatar?: string;
  bar_number: string;
  practice_areas: string[];
  courts: string[];
  experience_years: number;
  location: string;
  state: string;
  languages: string[];
  bio: string;
  education: { degree: string; institution: string; year: number }[];
  rating: number;
  review_count: number;
  consultation_modes: ConsultationMode[];
  fee_per_hour: number;
  fee_per_session?: number;
  is_verified: boolean;
  is_available: boolean;
  match_score?: number;
  match_reason?: string;
}

export interface LawyerFilters {
  practice_area?: string;
  location?: string;
  language?: string;
  min_rating?: number;
  max_fee?: number;
  consultation_mode?: ConsultationMode;
}

// ── Cases ────────────────────────────────────────────────────────────────

export type CaseStatus = "active" | "pending" | "closed" | "on_hold" | "appealed";

export interface Case {
  id: string;
  case_number?: string;
  title: string;
  client_name: string;
  client_id: string;
  practice_area: string;
  court?: string;
  judge?: string;
  status: CaseStatus;
  next_hearing?: string;
  filing_date: string;
  description?: string;
  documents_count: number;
  tasks_pending: number;
  lawyer_id: string;
}

// ── Documents ────────────────────────────────────────────────────────────

export type DocumentStatus = "draft" | "generated" | "reviewed" | "signed";

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: DocumentField[];
  estimated_time?: number;
}

export interface DocumentField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface GeneratedDocument {
  id: string;
  name: string;
  template_id: string;
  status: DocumentStatus;
  created_at: string;
  download_url?: string;
  preview_url?: string;
}

// ── Research ─────────────────────────────────────────────────────────────

export interface JudgmentResult {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  practice_area: string;
  summary: string;
  similarity_score: number;
  url?: string;
  is_landmark?: boolean;
  status?: "valid" | "overruled" | "upheld";
}

export interface PrecedentResult {
  judgment: JudgmentResult;
  relevance: string;
  key_principle: string;
}

// ── Billing / Finance ─────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_id: string;
  case_id?: string;
  amount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  due_date: string;
  issued_date: string;
  paid_date?: string;
  items: { description: string; hours?: number; rate?: number; amount: number }[];
}

export interface TimeEntry {
  id: string;
  case_id: string;
  case_title: string;
  description: string;
  hours: number;
  rate: number;
  date: string;
  billed: boolean;
}

// ── Analytics ────────────────────────────────────────────────────────────

export interface ProAnalytics {
  total_cases: number;
  active_cases: number;
  closed_cases: number;
  total_clients: number;
  revenue_month: number;
  revenue_year: number;
  win_rate: number;
  avg_case_duration_days: number;
  pending_invoices: number;
  overdue_amount: number;
}

// ── Notifications ─────────────────────────────────────────────────────────

export type NotificationType = "hearing" | "payment" | "message" | "document" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  link?: string;
}

// ── Know Your Rights ──────────────────────────────────────────────────────

export interface RightsTopic {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  steps?: { step: number; title: string; description: string }[];
}

// ── API Responses ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
