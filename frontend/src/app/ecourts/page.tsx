"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Landmark, Plus, RefreshCw, Calendar, AlertCircle, CheckCircle, Trash2, Edit2 } from "lucide-react";
import { backendApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface TrackedCase {
  id: string;
  case_number: string;
  case_title: string;
  court_name: string;
  court_type: string;
  state: string;
  case_status: string;
  next_hearing_date: string;
  source: string;
  updated_at: string;
  days_remaining?: number;
}

const COURT_TYPES = ["district", "high_court", "supreme_court", "tribunal", "consumer_forum"];
const STATES = ["Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Uttar Pradesh", "Gujarat", "Rajasthan", "West Bengal", "Andhra Pradesh", "Kerala", "Other"];

export default function ECourtsPage() {
  const [cases, setCases] = useState<TrackedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    case_number: "", court_type: "district", state: "", district: "",
    case_title: "", next_hearing_date: "", court_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [hearingForm, setHearingForm] = useState({ date: "", notes: "" });

  const load = async () => {
    try {
      const { data } = await backendApi.get("/ecourts/my");
      const enriched = data.cases.map((c: TrackedCase) => ({
        ...c,
        days_remaining: c.next_hearing_date
          ? Math.ceil((new Date(c.next_hearing_date).getTime() - Date.now()) / 86400000)
          : null,
      }));
      setCases(enriched);
    } catch { setCases([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setSaving(true);
    try {
      await backendApi.post("/ecourts/track", form);
      setShowAdd(false);
      setForm({ case_number: "", court_type: "district", state: "", district: "", case_title: "", next_hearing_date: "", court_name: "" });
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await backendApi.delete(`/ecourts/${id}`);
    load();
  };

  const handleUpdateHearing = async (id: string) => {
    await backendApi.patch(`/ecourts/${id}/hearing`, { next_hearing_date: hearingForm.date, notes: hearingForm.notes });
    setEditingId(null);
    load();
  };

  const urgencyColor = (days: number | null | undefined) => {
    if (days == null) return "text-dim";
    if (days <= 1) return "text-red-400";
    if (days <= 7) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <AppLayout title="eCourts Tracker" subtitle="Track hearing dates and case status across Indian courts">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header actions */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-dim">{cases.length} cases tracked</p>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> Track Case
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="vk-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Track New Case</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="vk-label">Case Number *</label>
                <input className="vk-input w-full" placeholder="e.g. CS/123/2024" value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Court Type</label>
                <select className="vk-input w-full" value={form.court_type} onChange={e => setForm(f => ({ ...f, court_type: e.target.value }))}>
                  {COURT_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">State</label>
                <select className="vk-input w-full" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">Select state</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">District</label>
                <input className="vk-input w-full" placeholder="e.g. South Delhi" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="vk-label">Case Title (optional)</label>
                <input className="vk-input w-full" placeholder="e.g. ABC vs XYZ" value={form.case_title} onChange={e => setForm(f => ({ ...f, case_title: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Next Hearing Date (manual)</label>
                <input className="vk-input w-full" type="date" value={form.next_hearing_date} onChange={e => setForm(f => ({ ...f, next_hearing_date: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Court Name</label>
                <input className="vk-input w-full" placeholder="e.g. Delhi High Court" value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))} />
              </div>
            </div>
            <div className="vk-disclaimer rounded-lg p-3 text-xs text-dim">
              We&apos;ll try the free eCourts API first. If unavailable, manual details will be used.
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary text-xs py-2 px-4" onClick={handleAdd} disabled={saving || !form.case_number}>
                {saving ? "Saving..." : "Track Case"}
              </button>
            </div>
          </div>
        )}

        {/* Cases list */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-24 rounded-xl" />)}</div>
        ) : cases.length === 0 ? (
          <div className="vk-card p-12 text-center text-dim">
            <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No cases tracked yet</p>
            <p className="text-sm mt-1">Click &ldquo;Track Case&rdquo; to add your first case.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map(c => (
              <div key={c.id} className="vk-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{c.case_number}</span>
                      <span className="vk-badge vk-badge-muted text-[10px]">{c.court_type.replace("_", " ")}</span>
                      <span className={`vk-badge text-[10px] ${c.case_status === "Disposed" ? "vk-badge-green" : "vk-badge-blue"}`}>{c.case_status}</span>
                      {c.source === "manual" && <span className="vk-badge vk-badge-muted text-[10px]">Manual</span>}
                    </div>
                    {c.case_title && <p className="text-xs text-dim mt-1">{c.case_title}</p>}
                    {c.court_name && <p className="text-[11px] text-dim">{c.court_name} {c.state ? `· ${c.state}` : ""}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="p-1.5 rounded hover:bg-white/10 text-dim" onClick={() => setEditingId(c.id)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-white/10 text-red-400" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Hearing date */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-dim" />
                  <span className="text-xs text-dim">Next hearing:</span>
                  {c.next_hearing_date ? (
                    <>
                      <span className="text-xs font-semibold" style={{ color: "var(--vk-text)" }}>
                        {new Date(c.next_hearing_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className={`text-xs font-bold ${urgencyColor(c.days_remaining)}`}>
                        {c.days_remaining != null && (
                          c.days_remaining < 0 ? "Overdue" :
                          c.days_remaining === 0 ? "Today!" :
                          `${c.days_remaining}d remaining`
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-dim italic">Not set</span>
                  )}
                </div>

                {/* Edit hearing date inline */}
                {editingId === c.id && (
                  <div className="flex gap-2 items-end pt-1 border-t" style={{ borderColor: "var(--vk-border)" }}>
                    <div className="flex-1">
                      <label className="vk-label">Update Hearing Date</label>
                      <input className="vk-input w-full" type="date" value={hearingForm.date} onChange={e => setHearingForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="flex-1">
                      <label className="vk-label">Notes</label>
                      <input className="vk-input w-full" placeholder="Optional notes" value={hearingForm.notes} onChange={e => setHearingForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <button className="btn-primary text-xs py-2 px-3 mb-0.5" onClick={() => handleUpdateHearing(c.id)}>Save</button>
                    <button className="btn-secondary text-xs py-2 px-3 mb-0.5" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
