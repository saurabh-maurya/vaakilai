import axios, { AxiosInstance } from "axios";
import type {
  TokenResponse, LoginPayload, RegisterPayload, User,
  Case, Lawyer, LawyerFilters, Invoice, ProAnalytics,
  GeneratedDocument, JudgmentResult, PrecedentResult,
  PaginatedResponse,
} from "@/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001";

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

export const backendApi = createClient(`${BACKEND_URL}/api/v1`);
export const aiApi = createClient(AI_URL);

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
