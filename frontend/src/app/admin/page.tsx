"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { backendApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Overview {
  users: { total: number; lawyers: number; new_today: number; new_week: number };
  consultations: { total: number; active: number };
  ai: { queries_today: number; queries_week: number; tokens_week: number; cost_usd_week: number };
  revenue: { mtd_inr: number };
  security: { blacklisted_tokens: number; locked_accounts: number };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  subscription_plan: string;
  created_at: string;
}

interface UsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

interface AiMetrics {
  period_days: number;
  by_day: { date: string; queries: number; tokens: number; cost_usd: number }[];
  top_users: { user_id: string; email?: string; queries: number; tokens: number }[];
  by_endpoint: { endpoint: string; queries: number }[];
}

interface SecurityLog {
  locked_accounts: { email: string; attempts: number; locked_until: string; last_attempt: string }[];
  revoked_tokens: { user_id: string; revoked_at: string; expires_at: string }[];
  generated_at: string;
}

interface Health {
  overall: string;
  services: Record<string, string>;
  checked_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const ROLE_BADGE: Record<string, string> = {
  admin: "vk-badge-red",
  lawyer: "vk-badge-blue",
  firm_admin: "vk-badge-blue",
  consumer: "vk-badge-muted",
  client_portal: "vk-badge-muted",
};

const VALID_ROLES = ["consumer", "lawyer", "firm_admin", "client_portal", "admin"];
const VALID_PLANS = ["free", "starter", "plus", "advocate_starter", "advocate_pro", "advocate_firm", "basic", "business", "pro"];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="vk-card p-5">
      <p className="section-label mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[var(--vk-muted)] mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ text, cls }: { text: string; cls?: string }) {
  return <span className={`vk-badge ${cls ?? "vk-badge-muted"} text-xs`}>{text}</span>;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

interface ConfigItem {
  key: string;
  label: string;
  category: string;
  sensitive: boolean;
  source: "db" | "env" | "not_set";
  masked_value: string;
  updated_at: string | null;
  updated_by: string | null;
}

type Tab = "overview" | "users" | "ai" | "security" | "health" | "config";

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  // Overview
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<UsersResponse | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userActive, setUserActive] = useState<"" | "true" | "false">("");
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [patchData, setPatchData] = useState({ role: "", subscription_plan: "", is_active: "" });
  const [patchLoading, setPatchLoading] = useState(false);

  // AI Metrics
  const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null);
  const [aiDays, setAiDays] = useState(7);
  const [aiLoading, setAiLoading] = useState(false);

  // Security
  const [secLog, setSecLog] = useState<SecurityLog | null>(null);
  const [secLoading, setSecLoading] = useState(false);
  const [secLimit, setSecLimit] = useState(50);
  const [unlockingEmail, setUnlockingEmail] = useState<string | null>(null);

  // Health
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Config
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configModal, setConfigModal] = useState<{ key: string; label: string } | null>(null);
  const [configValue, setConfigValue] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configShowValue, setConfigShowValue] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [configError, setConfigError] = useState("");

  // Guard: admin only
  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  // ── Data fetchers ────────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setOvLoading(true);
    try {
      const { data } = await backendApi.get("/api/v1/admin/overview");
      setOverview(data);
    } catch {
      // silently fail — server-side auth returns 403 for non-admins
    } finally {
      setOvLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params: Record<string, string | number> = { page: userPage, per_page: 20 };
      if (userSearch) params.search = userSearch;
      if (userRole) params.role = userRole;
      if (userActive !== "") params.is_active = userActive;
      const { data } = await backendApi.get("/api/v1/admin/users", { params });
      setUsers(data);
    } catch {
      //
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userSearch, userRole, userActive]);

  const fetchAiMetrics = useCallback(async () => {
    setAiLoading(true);
    try {
      const { data } = await backendApi.get(`/api/v1/admin/ai-metrics?days=${aiDays}`);
      setAiMetrics(data);
    } catch {
      //
    } finally {
      setAiLoading(false);
    }
  }, [aiDays]);

  const fetchSecurity = useCallback(async () => {
    setSecLoading(true);
    try {
      const { data } = await backendApi.get(`/api/v1/admin/security-log?limit=${secLimit}`);
      setSecLog(data);
    } catch {
      //
    } finally {
      setSecLoading(false);
    }
  }, [secLimit]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const { data } = await backendApi.get("/api/v1/admin/health");
      setHealth(data);
    } catch {
      //
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const { data } = await backendApi.get("/api/v1/admin/config");
      setConfigItems(data.items);
    } catch {
      //
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Load data on tab change
  useEffect(() => {
    if (tab === "overview") fetchOverview();
    if (tab === "users") fetchUsers();
    if (tab === "ai") fetchAiMetrics();
    if (tab === "security") fetchSecurity();
    if (tab === "health") fetchHealth();
    if (tab === "config") fetchConfig();
  }, [tab, fetchOverview, fetchUsers, fetchAiMetrics, fetchSecurity, fetchHealth, fetchConfig]);

  // Reload users when filters change
  useEffect(() => {
    if (tab === "users") fetchUsers();
  }, [userPage, userSearch, userRole, userActive]); // eslint-disable-line

  // Reload security log when limit changes
  useEffect(() => {
    if (tab === "security") fetchSecurity();
  }, [secLimit]); // eslint-disable-line

  // ── Patch user ───────────────────────────────────────────────────────────────

  async function handlePatch() {
    if (!editUser) return;
    setPatchLoading(true);
    try {
      const body: Record<string, string | boolean> = {};
      if (patchData.role) body.role = patchData.role;
      if (patchData.subscription_plan) body.subscription_plan = patchData.subscription_plan;
      if (patchData.is_active !== "") body.is_active = patchData.is_active === "true";
      await backendApi.patch(`/api/v1/admin/users/${editUser.id}`, body);
      setEditUser(null);
      fetchUsers();
    } catch {
      //
    } finally {
      setPatchLoading(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this user? They will lose access immediately.")) return;
    try {
      await backendApi.delete(`/api/v1/admin/users/${id}`);
      fetchUsers();
    } catch {
      //
    }
  }

  async function handleUnlock(email: string) {
    setUnlockingEmail(email);
    try {
      await backendApi.delete(`/api/v1/admin/security/lockout/${encodeURIComponent(email)}`);
      fetchSecurity();
    } catch {
      //
    } finally {
      setUnlockingEmail(null);
    }
  }

  // ── Config handlers ──────────────────────────────────────────────────────────

  function openConfigModal(item: ConfigItem) {
    setConfigModal({ key: item.key, label: item.label });
    setConfigValue("");
    setConfigShowValue(false);
    setConfigError("");
  }

  function openCustomModal() {
    setConfigModal({ key: "__custom__", label: "Custom Key" });
    setCustomKey("");
    setConfigValue("");
    setConfigShowValue(false);
    setConfigError("");
  }

  async function handleConfigSave() {
    const key = configModal?.key === "__custom__" ? customKey.toUpperCase().trim() : configModal?.key;
    if (!key) return;
    if (!configValue.trim()) { setConfigError("Value cannot be empty."); return; }
    setConfigSaving(true);
    setConfigError("");
    try {
      await backendApi.put(`/api/v1/admin/config/${key}`, { value: configValue });
      setConfigModal(null);
      fetchConfig();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Save failed.";
      setConfigError(String(msg));
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleConfigDelete(key: string) {
    if (!confirm(`Remove "${key}" from the database?\nThe system will fall back to the environment variable if one exists.`)) return;
    try {
      await backendApi.delete(`/api/v1/admin/config/${key}`);
      fetchConfig();
    } catch {
      //
    }
  }

  // ── Tab definitions ──────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "ai", label: "AI Metrics" },
    { id: "security", label: "Security" },
    { id: "health", label: "Health" },
    { id: "config", label: "Config & Keys" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform management and monitoring</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t.id
                  ? "text-[var(--vk-gold)] border-b-2 border-[var(--vk-gold)]"
                  : "text-[var(--vk-muted)] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ───────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {ovLoading && <div className="vk-skeleton h-48 rounded-xl" />}
            {overview && (
              <>
                <div>
                  <p className="section-label mb-3">Users</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Users" value={fmt(overview.users.total)} />
                    <StatCard label="Lawyers / Firms" value={fmt(overview.users.lawyers)} />
                    <StatCard label="New Today" value={fmt(overview.users.new_today)} />
                    <StatCard label="New This Week" value={fmt(overview.users.new_week)} />
                  </div>
                </div>
                <div>
                  <p className="section-label mb-3">Consultations</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total" value={fmt(overview.consultations.total)} />
                    <StatCard label="Active" value={fmt(overview.consultations.active)} />
                    <StatCard label="Revenue MTD" value={fmtCurrency(overview.revenue.mtd_inr)} />
                  </div>
                </div>
                <div>
                  <p className="section-label mb-3">AI Usage</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Queries Today" value={fmt(overview.ai.queries_today)} />
                    <StatCard label="Queries (7d)" value={fmt(overview.ai.queries_week)} />
                    <StatCard label="Tokens (7d)" value={fmt(overview.ai.tokens_week)} />
                    <StatCard label="Cost (7d)" value={`$${overview.ai.cost_usd_week.toFixed(4)}`} sub="USD estimate" />
                  </div>
                </div>
                <div>
                  <p className="section-label mb-3">Security</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Locked Accounts" value={fmt(overview.security.locked_accounts)} />
                    <StatCard label="Active Blacklisted Tokens" value={fmt(overview.security.blacklisted_tokens)} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Users Tab ──────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search name or email…"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                className="vk-input w-64"
              />
              <select
                value={userRole}
                onChange={(e) => { setUserRole(e.target.value); setUserPage(1); }}
                className="vk-input w-44"
              >
                <option value="">All roles</option>
                {VALID_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={userActive}
                onChange={(e) => { setUserActive(e.target.value as "" | "true" | "false"); setUserPage(1); }}
                className="vk-input w-44"
              >
                <option value="">Any status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button onClick={fetchUsers} className="btn-secondary text-sm px-4 py-2">Refresh</button>
            </div>

            {/* Table */}
            {usersLoading ? (
              <div className="vk-skeleton h-64 rounded-xl" />
            ) : users && (
              <>
                <div className="overflow-x-auto">
                  <table className="vk-table w-full">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.items.map((u) => (
                        <tr key={u.id}>
                          <td className="font-medium text-white">{u.name || "—"}</td>
                          <td className="text-[var(--vk-muted)]">{u.email}</td>
                          <td><Badge text={u.role} cls={ROLE_BADGE[u.role]} /></td>
                          <td className="text-[var(--vk-muted)]">{u.subscription_plan || "—"}</td>
                          <td>
                            <Badge
                              text={u.is_active ? "Active" : "Inactive"}
                              cls={u.is_active ? "vk-badge-green" : "vk-badge-red"}
                            />
                          </td>
                          <td className="text-[var(--vk-muted)] text-xs">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditUser(u);
                                  setPatchData({ role: u.role, subscription_plan: u.subscription_plan || "", is_active: String(u.is_active) });
                                }}
                                className="text-[var(--vk-gold)] hover:underline text-xs"
                              >
                                Edit
                              </button>
                              {u.is_active && (
                                <button
                                  onClick={() => handleDeactivate(u.id)}
                                  className="text-red-400 hover:underline text-xs"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between text-sm text-[var(--vk-muted)]">
                  <span>{fmt(users.total)} total users</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      disabled={userPage === 1}
                      className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="px-2 py-1">Page {userPage}</span>
                    <button
                      onClick={() => setUserPage((p) => p + 1)}
                      disabled={!users.has_more}
                      className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Edit Modal */}
            {editUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="vk-card w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Edit User</h3>
                  <p className="text-[var(--vk-muted)] text-sm">{editUser.email}</p>

                  <div>
                    <label className="vk-label">Role</label>
                    <select
                      value={patchData.role}
                      onChange={(e) => setPatchData((d) => ({ ...d, role: e.target.value }))}
                      className="vk-input w-full mt-1"
                    >
                      {VALID_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="vk-label">Subscription Plan</label>
                    <select
                      value={patchData.subscription_plan}
                      onChange={(e) => setPatchData((d) => ({ ...d, subscription_plan: e.target.value }))}
                      className="vk-input w-full mt-1"
                    >
                      <option value="">— no change —</option>
                      {VALID_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="vk-label">Status</label>
                    <select
                      value={patchData.is_active}
                      onChange={(e) => setPatchData((d) => ({ ...d, is_active: e.target.value }))}
                      className="vk-input w-full mt-1"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={handlePatch} disabled={patchLoading} className="btn-primary flex-1">
                      {patchLoading ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={() => setEditUser(null)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Metrics Tab ─────────────────────────────────────────────────── */}
        {tab === "ai" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <label className="vk-label">Period:</label>
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setAiDays(d)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    aiDays === d ? "btn-primary" : "btn-secondary"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {aiLoading ? (
              <div className="vk-skeleton h-64 rounded-xl" />
            ) : aiMetrics && (
              <>
                {/* By day table */}
                <div className="vk-card p-5">
                  <p className="section-label mb-3">Daily Usage</p>
                  <div className="overflow-x-auto">
                    <table className="vk-table w-full">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="text-right">Queries</th>
                          <th className="text-right">Tokens</th>
                          <th className="text-right">Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiMetrics.by_day.map((row) => (
                          <tr key={row.date}>
                            <td className="text-[var(--vk-muted)]">{row.date}</td>
                            <td className="text-right font-medium text-white">{fmt(row.queries)}</td>
                            <td className="text-right text-[var(--vk-muted)]">{fmt(row.tokens)}</td>
                            <td className="text-right text-[var(--vk-muted)]">${row.cost_usd.toFixed(4)}</td>
                          </tr>
                        ))}
                        {aiMetrics.by_day.length === 0 && (
                          <tr><td colSpan={4} className="text-center text-[var(--vk-muted)] py-4">No data</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top users + by endpoint side by side */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="vk-card p-5">
                    <p className="section-label mb-3">Top Users by Query Count</p>
                    <div className="space-y-2">
                      {aiMetrics.top_users.map((u, i) => (
                        <div key={u.user_id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <div>
                            <span className="text-[var(--vk-gold)] font-medium mr-2">#{i + 1}</span>
                            <span className="text-sm text-white">{u.email || u.user_id.slice(0, 12) + "…"}</span>
                          </div>
                          <div className="text-right text-sm">
                            <span className="text-white font-medium">{fmt(u.queries)} queries</span>
                            <span className="text-[var(--vk-muted)] ml-2">{fmt(u.tokens)} tok</span>
                          </div>
                        </div>
                      ))}
                      {aiMetrics.top_users.length === 0 && (
                        <p className="text-[var(--vk-muted)] text-sm">No data</p>
                      )}
                    </div>
                  </div>

                  <div className="vk-card p-5">
                    <p className="section-label mb-3">By Endpoint</p>
                    <div className="space-y-2">
                      {aiMetrics.by_endpoint.map((e) => (
                        <div key={e.endpoint} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <span className="text-sm text-[var(--vk-muted)] font-mono">{e.endpoint || "unknown"}</span>
                          <span className="text-white font-medium text-sm">{fmt(e.queries)}</span>
                        </div>
                      ))}
                      {aiMetrics.by_endpoint.length === 0 && (
                        <p className="text-[var(--vk-muted)] text-sm">No data</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Security Tab ───────────────────────────────────────────────────── */}
        {tab === "security" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={fetchSecurity} className="btn-secondary text-sm px-4 py-2">Refresh</button>
              <label className="vk-label">Show last:</label>
              {[50, 100, 200].map((n) => (
                <button key={n} onClick={() => setSecLimit(n)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${secLimit === n ? "btn-primary" : "btn-secondary"}`}>
                  {n}
                </button>
              ))}
            </div>

            {secLoading ? (
              <div className="vk-skeleton h-48 rounded-xl" />
            ) : secLog && (
              <>
                {/* Locked accounts */}
                <div className="vk-card p-5">
                  <p className="section-label mb-3">
                    Locked Accounts
                    <span className="ml-2 vk-badge vk-badge-red">{secLog.locked_accounts.length}</span>
                  </p>
                  {secLog.locked_accounts.length === 0 ? (
                    <p className="text-[var(--vk-muted)] text-sm">No currently locked accounts.</p>
                  ) : (
                    <table className="vk-table w-full">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th className="text-right">Attempts</th>
                          <th>Locked Until</th>
                          <th>Last Attempt</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secLog.locked_accounts.map((acc, i) => (
                          <tr key={i}>
                            <td className="text-white">{acc.email}</td>
                            <td className="text-right text-red-400 font-medium">{acc.attempts}</td>
                            <td className="text-[var(--vk-muted)] text-xs">{acc.locked_until ? new Date(acc.locked_until).toLocaleString("en-IN") : "—"}</td>
                            <td className="text-[var(--vk-muted)] text-xs">{acc.last_attempt ? new Date(acc.last_attempt).toLocaleString("en-IN") : "—"}</td>
                            <td>
                              <button
                                onClick={() => handleUnlock(acc.email)}
                                disabled={unlockingEmail === acc.email}
                                className="text-[var(--vk-gold)] hover:underline text-xs disabled:opacity-50"
                              >
                                {unlockingEmail === acc.email ? "Unlocking…" : "Unlock"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Revoked tokens */}
                <div className="vk-card p-5">
                  <p className="section-label mb-3">
                    Active Revoked Tokens
                    <span className="ml-2 vk-badge vk-badge-gold">{secLog.revoked_tokens.length}</span>
                  </p>
                  {secLog.revoked_tokens.length === 0 ? (
                    <p className="text-[var(--vk-muted)] text-sm">No active revoked tokens.</p>
                  ) : (
                    <table className="vk-table w-full">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Revoked At</th>
                          <th>Expires At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secLog.revoked_tokens.map((tok, i) => (
                          <tr key={i}>
                            <td className="text-[var(--vk-muted)] font-mono text-xs">{tok.user_id || "—"}</td>
                            <td className="text-[var(--vk-muted)] text-xs">{tok.revoked_at ? new Date(tok.revoked_at).toLocaleString("en-IN") : "—"}</td>
                            <td className="text-[var(--vk-muted)] text-xs">{tok.expires_at ? new Date(tok.expires_at).toLocaleString("en-IN") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <p className="text-xs text-[var(--vk-muted)]">
                  Generated at: {new Date(secLog.generated_at).toLocaleString("en-IN")}
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Health Tab ─────────────────────────────────────────────────────── */}
        {tab === "health" && (
          <div className="space-y-4">
            <button onClick={fetchHealth} className="btn-secondary text-sm px-4 py-2">Check Now</button>

            {healthLoading ? (
              <div className="vk-skeleton h-48 rounded-xl" />
            ) : health && (
              <div className="vk-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${health.overall === "ok" ? "bg-green-400" : "bg-red-400"}`} />
                  <span className={`text-lg font-semibold ${health.overall === "ok" ? "text-green-400" : "text-red-400"}`}>
                    {health.overall === "ok" ? "All Systems Operational" : "Degraded"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(health.services).map(([svc, status]) => (
                    <div key={svc} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-white font-medium capitalize">{svc.replace(/_/g, " ")}</span>
                      <Badge
                        text={status}
                        cls={status === "ok" ? "vk-badge-green" : "vk-badge-red"}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[var(--vk-muted)]">
                  Checked at: {new Date(health.checked_at).toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Config & Keys Tab ──────────────────────────────────────────────── */}
        {tab === "config" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Platform Configuration</p>
                <p className="text-xs text-[var(--vk-muted)] mt-0.5">
                  DB values take precedence over environment variables. Values are encrypted (AES-256-GCM) with a per-entry salt.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchConfig} className="btn-secondary text-sm px-4 py-2">Refresh</button>
                <button onClick={openCustomModal} className="btn-primary text-sm px-4 py-2">+ Custom Key</button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="vk-badge vk-badge-green">DB</span> Stored encrypted in database</span>
              <span className="flex items-center gap-1.5"><span className="vk-badge vk-badge-blue">ENV</span> From environment variable</span>
              <span className="flex items-center gap-1.5"><span className="vk-badge vk-badge-red">NOT SET</span> Not configured</span>
            </div>

            {configLoading ? (
              <div className="vk-skeleton h-64 rounded-xl" />
            ) : (
              (() => {
                const categories = Array.from(new Set(configItems.map((i) => i.category)));
                return categories.map((cat) => (
                  <div key={cat} className="vk-card p-5">
                    <p className="section-label mb-3">{cat}</p>
                    <div className="space-y-2">
                      {configItems.filter((i) => i.category === cat).map((item) => (
                        <div key={item.key}
                          className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/3 border border-white/8 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{item.label}</span>
                              <Badge
                                text={item.source === "db" ? "DB" : item.source === "env" ? "ENV" : "NOT SET"}
                                cls={item.source === "db" ? "vk-badge-green" : item.source === "env" ? "vk-badge-blue" : "vk-badge-red"}
                              />
                              {item.sensitive && <span className="text-[10px] text-[var(--vk-muted)]">sensitive</span>}
                            </div>
                            <p className="text-[10px] font-mono text-[var(--vk-muted)] mt-0.5">{item.key}</p>
                            {item.masked_value && (
                              <p className="text-xs font-mono text-[var(--vk-muted)] mt-0.5">{item.masked_value}</p>
                            )}
                            {item.updated_at && (
                              <p className="text-[10px] text-[var(--vk-muted)] mt-0.5">
                                Updated {new Date(item.updated_at).toLocaleString("en-IN")}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => openConfigModal(item)}
                              className="text-[var(--vk-gold)] hover:underline text-xs"
                            >
                              {item.source === "not_set" ? "Set" : "Update"}
                            </button>
                            {item.source === "db" && (
                              <button
                                onClick={() => handleConfigDelete(item.key)}
                                className="text-red-400 hover:underline text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}

            {/* Set / Update modal */}
            {configModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="vk-card w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white">
                    {configModal.key === "__custom__" ? "Add Custom Key" : `Set: ${configModal.label}`}
                  </h3>

                  {configModal.key === "__custom__" && (
                    <div>
                      <label className="vk-label">Key Name</label>
                      <input
                        type="text"
                        placeholder="MY_API_KEY"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                        className="vk-input w-full mt-1 font-mono"
                      />
                      <p className="text-[10px] text-[var(--vk-muted)] mt-1">Uppercase letters, digits, and underscores only.</p>
                    </div>
                  )}

                  <div>
                    <label className="vk-label">
                      {configModal.key !== "__custom__" && <span className="font-mono text-[var(--vk-gold)] mr-1">{configModal.key}</span>}
                      Value
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={configShowValue ? "text" : "password"}
                        placeholder="Paste the secret value…"
                        value={configValue}
                        onChange={(e) => setConfigValue(e.target.value)}
                        className="vk-input w-full pr-16 font-mono"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setConfigShowValue((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--vk-muted)] hover:text-white"
                      >
                        {configShowValue ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-[10px] text-[var(--vk-muted)] mt-1">
                      Encrypted with AES-256-GCM before storage. Never stored in plaintext.
                    </p>
                  </div>

                  {configError && (
                    <p className="text-red-400 text-sm">{configError}</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={handleConfigSave} disabled={configSaving} className="btn-primary flex-1">
                      {configSaving ? "Saving…" : "Save Encrypted"}
                    </button>
                    <button onClick={() => setConfigModal(null)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
