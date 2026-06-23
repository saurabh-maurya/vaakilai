"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Lightbulb, Plus, Clock, AlertTriangle } from "lucide-react";
import { backendApi } from "@/lib/api";

interface IPAsset {
  id: string;
  title: string;
  ip_type: string;
  application_number?: string;
  registration_number?: string;
  status: string;
  owner_name: string;
  expiry_date?: string;
  renewal_due_date?: string;
  days_until_renewal?: number;
  days_until_expiry?: number;
  jurisdiction: string;
  classes: string[];
  created_at: string;
}

interface CreateForm {
  title: string;
  ip_type: string;
  application_number: string;
  registration_number: string;
  filing_date: string;
  expiry_date: string;
  renewal_due_date: string;
  status: string;
  owner_name: string;
  jurisdiction: string;
  description: string;
}

const IP_TYPES = [
  { value: "patent",       label: "Patent",         color: "#60a5fa" },
  { value: "trademark",    label: "Trademark",       color: "var(--vk-gold)" },
  { value: "copyright",    label: "Copyright",       color: "#a78bfa" },
  { value: "design",       label: "Industrial Design", color: "#4ade80" },
  { value: "trade_secret", label: "Trade Secret",    color: "#f87171" },
  { value: "gi_tag",       label: "GI Tag",          color: "#fb923c" },
];

const IP_STATUSES = [
  "filed", "pending", "examination", "published", "opposed",
  "granted", "registered", "renewed", "abandoned", "expired", "lapsed",
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  filed:       { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  pending:     { bg: "rgba(251,191,36,0.15)",  text: "#fbbf24" },
  examination: { bg: "rgba(251,146,60,0.15)",  text: "#fb923c" },
  published:   { bg: "rgba(96,165,250,0.15)",  text: "#60a5fa" },
  opposed:     { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
  granted:     { bg: "rgba(34,197,94,0.15)",   text: "#4ade80" },
  registered:  { bg: "rgba(34,197,94,0.15)",   text: "#4ade80" },
  renewed:     { bg: "rgba(34,197,94,0.15)",   text: "#4ade80" },
  abandoned:   { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  expired:     { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
  lapsed:      { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
};

function IPTypeBadge({ type }: { type: string }) {
  const t = IP_TYPES.find(x => x.value === type);
  if (!t) return null;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${t.color}18`, color: t.color }}>
      {t.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "rgba(255,255,255,0.05)", text: "#94a3b8" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{ background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

export default function IPPortfolioPage() {
  const [assets, setAssets] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    title: "", ip_type: "trademark", application_number: "", registration_number: "",
    filing_date: "", expiry_date: "", renewal_due_date: "", status: "pending",
    owner_name: "", jurisdiction: "India", description: "",
  });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.ip_type = typeFilter;
      const { data } = await backendApi.get("/ip/", { params });
      setAssets(data.assets ?? []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await backendApi.post("/ip/", {
        title: form.title,
        ip_type: form.ip_type,
        application_number: form.application_number || undefined,
        registration_number: form.registration_number || undefined,
        filing_date: form.filing_date || undefined,
        expiry_date: form.expiry_date || undefined,
        renewal_due_date: form.renewal_due_date || undefined,
        status: form.status,
        owner_name: form.owner_name,
        jurisdiction: form.jurisdiction,
        description: form.description || undefined,
      });
      setShowCreate(false);
      fetchAssets();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const renewingCount = assets.filter(a => a.days_until_renewal !== undefined && a.days_until_renewal !== null && a.days_until_renewal >= 0 && a.days_until_renewal <= 60).length;

  return (
    <AppLayout requirePro requiredFeature="ip_portfolio" title="IP Portfolio" subtitle="Manage patents, trademarks, copyrights, and designs — renewal alerts included">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1.5 flex-wrap">
            <button
              className={`text-xs py-1.5 px-3 rounded-md font-semibold transition-colors ${!typeFilter ? "text-navy" : "text-dim"}`}
              style={!typeFilter ? { background: "var(--vk-gold)" } : { background: "rgba(255,255,255,0.05)" }}
              onClick={() => setTypeFilter("")}
            >
              All Types
            </button>
            {IP_TYPES.map(t => (
              <button
                key={t.value}
                className={`text-xs py-1.5 px-3 rounded-md font-semibold transition-colors ${typeFilter === t.value ? "text-navy" : "text-dim"}`}
                style={typeFilter === t.value ? { background: t.color } : { background: "rgba(255,255,255,0.05)" }}
                onClick={() => setTypeFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn-primary px-4 py-2 flex items-center gap-2 text-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Add IP Asset
          </button>
        </div>

        {/* Renewal alert */}
        {renewingCount > 0 && (
          <div className="vk-card p-3 flex items-center gap-2" style={{ border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)" }}>
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-sm" style={{ color: "var(--vk-text)" }}>
              <span className="font-bold text-yellow-400">{renewingCount}</span> asset{renewingCount > 1 ? "s" : ""} due for renewal within 60 days
            </p>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="vk-card p-6 space-y-4" style={{ border: "1px solid rgba(201,168,76,0.3)" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Add IP Asset</h3>
              <button className="text-dim hover:text-white text-lg leading-none" onClick={() => setShowCreate(false)}>&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="vk-label">Title *</label>
                <input className="vk-input w-full" placeholder="e.g. VakilAI Logo — Trademark Application" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">IP Type</label>
                <select className="vk-input w-full" value={form.ip_type} onChange={e => setForm(f => ({ ...f, ip_type: e.target.value }))}>
                  {IP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Status</label>
                <select className="vk-input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {IP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Application Number</label>
                <input className="vk-input w-full" placeholder="e.g. TM-2024-XXXXXX" value={form.application_number} onChange={e => setForm(f => ({ ...f, application_number: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Registration Number</label>
                <input className="vk-input w-full" placeholder="After registration" value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Owner Name</label>
                <input className="vk-input w-full" placeholder="Registered owner / applicant" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Jurisdiction</label>
                <input className="vk-input w-full" value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Expiry Date</label>
                <input type="date" className="vk-input w-full" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Renewal Due Date</label>
                <input type="date" className="vk-input w-full" value={form.renewal_due_date} onChange={e => setForm(f => ({ ...f, renewal_due_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-primary px-5 py-2 text-sm" onClick={handleCreate} disabled={saving || !form.title.trim()}>
                {saving ? "Saving..." : "Add Asset"}
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
        ) : assets.length === 0 ? (
          <div className="vk-card p-8 text-center space-y-2">
            <Lightbulb className="w-8 h-8 mx-auto text-dim" />
            <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>No IP assets yet</p>
            <p className="text-xs text-dim">Add patents, trademarks, or copyrights to track.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map(a => (
              <div key={a.id} className="vk-card vk-card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--vk-text)" }}>{a.title}</p>
                      <IPTypeBadge type={a.ip_type} />
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-dim flex-wrap">
                      {a.owner_name && <span>{a.owner_name}</span>}
                      {a.application_number && <span>App: {a.application_number}</span>}
                      {a.registration_number && <span>Reg: {a.registration_number}</span>}
                      <span>{a.jurisdiction}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    {a.days_until_renewal !== undefined && a.days_until_renewal !== null && a.days_until_renewal >= 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className={`w-3 h-3 ${a.days_until_renewal <= 60 ? "text-yellow-400" : "text-dim"}`} />
                        <p className={`text-xs font-semibold ${a.days_until_renewal <= 60 ? "text-yellow-400" : "text-dim"}`}>
                          Renew in {a.days_until_renewal}d
                        </p>
                      </div>
                    )}
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
