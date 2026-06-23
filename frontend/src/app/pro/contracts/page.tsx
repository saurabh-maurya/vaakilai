"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileSignature, Plus, Search, Clock, AlertTriangle, CheckCircle, XCircle, Filter } from "lucide-react";
import { backendApi } from "@/lib/api";

interface Contract {
  id: string;
  title: string;
  contract_type: string;
  parties: string[];
  status: string;
  value?: number;
  end_date?: string;
  days_until_expiry?: number;
  auto_renew: boolean;
  created_at: string;
}

interface CreateForm {
  title: string;
  contract_type: string;
  parties_input: string;
  value: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  description: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:        { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  under_review: { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24" },
  pending_sign: { bg: "rgba(251,146,60,0.15)",  text: "#fb923c" },
  active:       { bg: "rgba(34,197,94,0.15)",   text: "#4ade80" },
  expired:      { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
  terminated:   { bg: "rgba(239,68,68,0.2)",    text: "#ef4444" },
  renewed:      { bg: "rgba(96,165,250,0.15)",  text: "#60a5fa" },
};

const CONTRACT_TYPES = [
  "nda", "employment", "service", "lease", "partnership",
  "shareholder", "vendor", "loan", "ip_assignment", "other",
];

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ background: c.bg, color: c.text }}>
      {status.replace("_", " ")}
    </span>
  );
}

function formatCurrency(v?: number) {
  if (!v) return "-";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState<CreateForm>({
    title: "", contract_type: "other", parties_input: "",
    value: "", start_date: "", end_date: "", auto_renew: false, description: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await backendApi.get("/contracts/", { params });
      setContracts(data.contracts ?? []);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await backendApi.post("/contracts/", {
        title: form.title,
        contract_type: form.contract_type,
        parties: form.parties_input.split(",").map(s => s.trim()).filter(Boolean),
        value: form.value ? parseFloat(form.value) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        auto_renew: form.auto_renew,
        description: form.description || undefined,
      });
      setShowCreate(false);
      setForm({ title: "", contract_type: "other", parties_input: "", value: "", start_date: "", end_date: "", auto_renew: false, description: "" });
      fetchContracts();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const expiringCount = contracts.filter(c => c.days_until_expiry !== null && c.days_until_expiry !== undefined && c.days_until_expiry >= 0 && c.days_until_expiry <= 30).length;

  return (
    <AppLayout requirePro requiredFeature="contracts_clm" title="Contract Management" subtitle="Track contract lifecycle from drafting to expiry — CLM for law practices">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <select
              className="vk-input text-sm py-1.5 px-3"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {Object.keys(STATUS_COLORS).map(s => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary px-4 py-2 flex items-center gap-2 text-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Contract
          </button>
        </div>

        {/* Alert: expiring */}
        {expiringCount > 0 && (
          <div className="vk-card p-3 flex items-center gap-2" style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)" }}>
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-sm" style={{ color: "var(--vk-text)" }}>
              <span className="font-bold text-yellow-400">{expiringCount}</span> contract{expiringCount > 1 ? "s" : ""} expiring within 30 days
            </p>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="vk-card p-6 space-y-4" style={{ border: "1px solid rgba(201,168,76,0.3)" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">New Contract</h3>
              <button className="text-dim hover:text-white text-lg leading-none" onClick={() => setShowCreate(false)}>&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="vk-label">Contract Title *</label>
                <input className="vk-input w-full" placeholder="e.g. Service Agreement — ABC Corp" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Contract Type</label>
                <select className="vk-input w-full" value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}>
                  {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Contract Value (INR)</label>
                <input type="number" className="vk-input w-full" placeholder="e.g. 500000" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="vk-label">Parties (comma-separated)</label>
                <input className="vk-input w-full" placeholder="e.g. ABC Corporation, XYZ Pvt Ltd" value={form.parties_input} onChange={e => setForm(f => ({ ...f, parties_input: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Start Date</label>
                <input type="date" className="vk-input w-full" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">End / Expiry Date</label>
                <input type="date" className="vk-input w-full" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="vk-label">Description</label>
                <textarea className="vk-input w-full h-20 resize-none" placeholder="Brief description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="auto_renew" checked={form.auto_renew} onChange={e => setForm(f => ({ ...f, auto_renew: e.target.checked }))} />
                <label htmlFor="auto_renew" className="text-xs" style={{ color: "var(--vk-text-muted)" }}>Auto-renew on expiry</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-primary px-5 py-2 text-sm" onClick={handleCreate} disabled={saving || !form.title.trim()}>
                {saving ? "Saving..." : "Create Contract"}
              </button>
              <button className="btn-secondary px-5 py-2 text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="vk-skeleton h-20 rounded-xl" />)}
          </div>
        ) : contracts.length === 0 ? (
          <div className="vk-card p-8 text-center space-y-2">
            <FileSignature className="w-8 h-8 mx-auto text-dim" />
            <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>No contracts yet</p>
            <p className="text-xs text-dim">Create your first contract to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map(c => (
              <div key={c.id} className="vk-card vk-card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--vk-text)" }}>{c.title}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-dim flex-wrap">
                      <span className="capitalize">{c.contract_type.replace("_", " ")}</span>
                      {c.parties.length > 0 && <span>{c.parties.slice(0, 2).join(" · ")}</span>}
                      {c.value && <span>{formatCurrency(c.value)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.days_until_expiry !== null && c.days_until_expiry !== undefined && c.days_until_expiry >= 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3 h-3 ${c.days_until_expiry <= 30 ? "text-yellow-400" : "text-dim"}`} />
                        <p className={`text-xs font-semibold ${c.days_until_expiry <= 30 ? "text-yellow-400" : "text-dim"}`}>
                          {c.days_until_expiry}d left
                        </p>
                      </div>
                    )}
                    {c.auto_renew && <p className="text-[10px] text-dim mt-0.5">Auto-renew</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
