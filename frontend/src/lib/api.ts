import axios, { AxiosInstance } from "axios";

type ValidationErrorItem = {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
};

/** FastAPI returns `detail` as a string or as validation error objects. */
export function formatApiDetail(detail: unknown, fallback = "Something went wrong"): string {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const err = item as ValidationErrorItem;
          const field = err.loc?.filter((part) => part !== "body" && part !== "query").pop();
          const label = field != null ? String(field).replace(/_/g, " ") : null;
          return label && err.msg ? `${label}: ${err.msg}` : err.msg ?? "";
        }
        return "";
      })
      .filter(Boolean);
    return messages.length > 0 ? messages.join(". ") : fallback;
  }
  if (typeof detail === "object" && detail !== null && "msg" in detail) {
    return String((detail as ValidationErrorItem).msg ?? fallback);
  }
  return fallback;
}

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: unknown; message?: string } | undefined;
    if (data?.detail != null) return formatApiDetail(data.detail, fallback);
    if (typeof data?.message === "string") return data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
import type {
  TokenResponse, LoginPayload, RegisterPayload, User,
  Case, Lawyer, LawyerFilters, Invoice, ProAnalytics,
  GeneratedDocument, JudgmentResult, PrecedentResult,
  PaginatedResponse,
} from "@/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001";

// In the browser, talk to the frontend's OWN origin so the auth cookie is
// first-party (set on the frontend domain). Next.js rewrites (next.config.mjs)
// transparently proxy these to the real services. This is what lets the Next
// middleware read `vk_session` and stops the /dashboard redirect loop.
// On the server (SSR) there is no origin, so call the services directly.
const isBrowser = typeof window !== "undefined";
const BACKEND_BASE = isBrowser ? "/api/backend" : `${BACKEND_URL}/api/v1`;
const AI_BASE = isBrowser ? "/api/aiproxy" : AI_URL;

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30_000,
    withCredentials: true, // send httpOnly session cookie automatically
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const url: string = err.config?.url ?? "";
      const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register");
      const isSessionCheck = url.includes("/users/me");
      if (err.response?.status === 401 && !isAuthEndpoint && !isSessionCheck && typeof window !== "undefined") {
        // Session expired — only redirect if the user was previously logged in
        const hadUser = !!localStorage.getItem("vk_user");
        localStorage.removeItem("vk_user");
        if (hadUser) window.location.href = "/";
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export const backendApi = createClient(BACKEND_BASE);
export const aiApi = createClient(AI_BASE);

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const { data } = await backendApi.post<TokenResponse>("/auth/login", payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<TokenResponse> => {
    const { data } = await backendApi.post<TokenResponse>("/auth/register", payload);
    return data;
  },
  logout: async (): Promise<void> => {
    await backendApi.post("/auth/logout");
  },
  refresh: async (): Promise<TokenResponse> => {
    const { data } = await backendApi.post<TokenResponse>("/auth/refresh");
    return data;
  },
  mfaSetup: async (): Promise<{ secret: string; qr_code: string; provisioning_uri: string; instructions: string }> => {
    const { data } = await backendApi.get("/auth/mfa/setup");
    return data;
  },
  mfaEnable: async (code: string): Promise<{ message: string }> => {
    const { data } = await backendApi.post<{ message: string }>("/auth/mfa/enable", { code });
    return data;
  },
  mfaDisable: async (code: string): Promise<{ message: string }> => {
    const { data } = await backendApi.post<{ message: string }>("/auth/mfa/disable", { code });
    return data;
  },
};

// ── Users ─────────────────────────────────────────────────────────────────

export const usersApi = {
  me: async (): Promise<User> => {
    const { data } = await backendApi.get<User>("/users/me");
    return data;
  },
  update: async (id: string, payload: Partial<User>): Promise<User> => {
    const { data } = await backendApi.put<User>(`/users/${id}`, payload);
    return data;
  },
  updateMe: async (payload: Partial<User>): Promise<User> => {
    const { data } = await backendApi.put<User>("/users/me", payload);
    return data;
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await backendApi.post<{ message: string }>(
      "/users/me/change-password",
      { current_password: currentPassword, new_password: newPassword }
    );
    return data;
  },
  upgradePlan: async (
    plan: string,
    paymentDetails?: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
  ): Promise<{ message: string; plan: string; price_inr: number }> => {
    const { data } = await backendApi.post<{ message: string; plan: string; price_inr: number }>(
      "/users/me/subscription",
      {
        plan,
        razorpay_payment_id: paymentDetails?.razorpay_payment_id ?? "",
        razorpay_order_id: paymentDetails?.razorpay_order_id ?? "",
        razorpay_signature: paymentDetails?.razorpay_signature ?? "",
      }
    );
    return data;
  },
};

// ── Marketplace / Lawyers ─────────────────────────────────────────────────

export const marketplaceApi = {
  searchLawyers: async (filters?: LawyerFilters, page = 1): Promise<PaginatedResponse<Lawyer>> => {
    const { data } = await backendApi.get<PaginatedResponse<Lawyer>>("/marketplace/lawyers", {
      params: { ...filters, page, per_page: 12 },
    });
    return data;
  },
  getLawyer: async (id: string): Promise<Lawyer> => {
    const { data } = await backendApi.get<Lawyer>(`/marketplace/lawyers/${id}`);
    return data;
  },
  matchLawyers: async (caseDescription: string, jurisdiction?: string): Promise<Lawyer[]> => {
    const { data } = await backendApi.post<Lawyer[]>("/marketplace/match", {
      case_description: caseDescription,
      jurisdiction,
    });
    return data;
  },
};

// ── Cases ─────────────────────────────────────────────────────────────────

export const casesApi = {
  list: async (page = 1, status?: string): Promise<PaginatedResponse<Case>> => {
    const { data } = await backendApi.get<PaginatedResponse<Case>>("/cases", {
      params: { page, per_page: 20, status },
    });
    return data;
  },
  get: async (id: string): Promise<Case> => {
    const { data } = await backendApi.get<Case>(`/cases/${id}`);
    return data;
  },
  create: async (payload: Partial<Case>): Promise<Case> => {
    const { data } = await backendApi.post<Case>("/cases", payload);
    return data;
  },
  update: async (id: string, payload: Partial<Case>): Promise<Case> => {
    const { data } = await backendApi.put<Case>(`/cases/${id}`, payload);
    return data;
  },
};

// ── Documents ─────────────────────────────────────────────────────────────

export const documentsApi = {
  listGenerated: async (): Promise<GeneratedDocument[]> => {
    const { data } = await backendApi.get<GeneratedDocument[]>("/documents");
    return data;
  },
  upload: async (file: File): Promise<{ url: string; document_id: string }> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await backendApi.post<{ url: string; document_id: string }>(
      "/documents/upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },
};

// ── Analytics ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  getProSummary: async (): Promise<ProAnalytics> => {
    const { data } = await backendApi.get<ProAnalytics>("/analytics/pro/summary");
    return data;
  },
};

// ── Billing ───────────────────────────────────────────────────────────────

export const billingApi = {
  listInvoices: async (): Promise<Invoice[]> => {
    const { data } = await backendApi.get<Invoice[]>("/billing/invoices");
    return data;
  },
  createInvoice: async (payload: Partial<Invoice>): Promise<Invoice> => {
    const { data } = await backendApi.post<Invoice>("/billing/invoices", payload);
    return data;
  },
};

// ── AI Service ────────────────────────────────────────────────────────────

export const aiConsultApi = {

  consult: async (query: string, practiceArea?: string): Promise<{ answer: string; citations?: unknown[]; confidence?: number }> => {
    const body = { query, practice_area: practiceArea ?? "" };
    // Retry with backoff so a cold-started AI service (Render free tier spins
    // down when idle and returns 502/timeouts while waking) self-heals instead
    // of failing on the first request. Only retry transient failures.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await aiApi.post<{ answer: string; citations?: unknown[]; confidence?: number }>(
          "/ai/consult", body, { timeout: 90_000 }
        );
        return data;
      } catch (err) {
        lastErr = err;
        const status = (err as { response?: { status?: number } }).response?.status;
        const transient = status === undefined || status === 502 || status === 503 || status === 504;
        if (!transient || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); // 3s, then 6s
      }
    }
    throw lastErr;
  },

  generate: async (templateId: string, fields: Record<string, string>): Promise<{ content: string; download_url?: string }> => {
    const { data } = await aiApi.post<{ content: string; download_url?: string }>(
      "/ai/documents/generate",
      { template_id: templateId, fields }
    );
    return data;
  },

  review: async (documentText: string): Promise<{
    risks: { severity: "high" | "medium" | "low"; clause: string; explanation: string }[];
    suggestions: { clause: string; suggestion: string }[];
    summary: string;
    risk_score: number;
  }> => {
    const { data } = await aiApi.post("/ai/documents/review", { document_text: documentText });
    return data;
  },

  searchResearch: async (query: string, filters?: { court?: string; year_from?: number; practice_area?: string }): Promise<JudgmentResult[]> => {
    const { data } = await aiApi.post<JudgmentResult[]>("/ai/research/search", { query, ...filters });
    return data;
  },

  findPrecedents: async (facts: string, practiceArea: string): Promise<PrecedentResult[]> => {
    const { data } = await aiApi.post<PrecedentResult[]>("/ai/research/precedents", { facts, practice_area: practiceArea });
    return data;
  },

  generateMemo: async (topic: string, judgments: string[]): Promise<{ memo: string }> => {
    const { data } = await aiApi.post<{ memo: string }>("/ai/research/memo", { topic, judgment_ids: judgments });
    return data;
  },

  matchScore: async (caseDescription: string, lawyerId: string): Promise<{ score: number; reason: string }> => {
    const { data } = await aiApi.post<{ score: number; reason: string }>("/ai/match/score", {
      case_description: caseDescription,
      lawyer_id: lawyerId,
    });
    return data;
  },
};
