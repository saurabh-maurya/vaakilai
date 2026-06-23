"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { backendApi } from "@/lib/api";
import {
  CheckSquare, AlertCircle, Clock, CheckCircle, Calendar, Building2,
} from "lucide-react";
import toast from "react-hot-toast";

interface ComplianceItem {
  id: string;
  name: string;
  category: string;
  due_date: string;
  description: string;
  status: string;
  days_remaining: number | null;
}

const CATEGORIES = ["GST", "Income Tax", "MCA", "Court", "Limitation", "SEBI", "RBI", "Custom"];
const LIMITATION_TYPES = [
  "Civil suit (money recovery)", "Consumer complaint", "Cheque bounce (Section 138)",
  "Service matter", "Motor accident claim", "Writ petition", "Labour dispute", "Tax appeal",
];
const categoryColor: Record<string, string> = {
  GST: "vk-badge-gold", "Income Tax": "vk-badge-blue", MCA: "vk-badge-green",
  Court: "vk-badge-red", Limitation: "vk-badge-red", SEBI: "vk-badge-blue", Custom: "vk-badge-muted",
};

export default function CompanyCompliancePage() {
  const [items, setItems]           = useState<ComplianceItem[]>([]);
  const [upcoming, setUpcoming]     = useState<ComplianceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [trackerTab, setTrackerTab] = useState<"calendar" | "add" | "corporate" | "limitation">("calendar");
  const [addForm, setAddForm]       = useState({ name: "", category: "GST", due_date: "", description: "" });
  const [corpForm, setCorpForm]     = useState({ company_name: "" });
  const [limitForm, setLimitForm]   = useState({ matter_type: LIMITATION_TYPES[0], incident_date: "", cause_of_action: "" });
  const [limitResult, setLimitResult] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [ir, ur] = await Promise.all([
          backendApi.get("/compliance/items"),
          backendApi.get("/compliance/upcoming?days=30"),
        ]);
        setItems(ir.data.items ?? []);
        setUpcoming(ur.data.items ?? []);
      } catch { /* backend not connected */ }
      finally { setLoadingItems(false); }
    })();
  }, []);

  const loadItems = async () => {
    try {
      const [ir, ur] = await Promise.all([
        backendApi.get("/compliance/items"),
        backendApi.get("/compliance/upcoming?days=30"),
      ]);
      setItems(ir.data.items ?? []);
      setUpcoming(ur.data.items ?? []);
    } catch { /* ignore */ }
  };

  const urgencyStyle = (days: number | null) => {
    if (days == null) return {};
    if (days <= 1)  return { color: "#f87171" };
    if (days <= 7)  return { color: "#fbbf24" };
    if (days <= 30) return { color: "#60a5fa" };
    return { color: "#4ade80" };
  };

  const handleAddItem = async () => {
    setSaving(true);
    try {
      await backendApi.post("/compliance/items", addForm);
      setAddForm({ name: "", category: "GST", due_date: "", description: "" });
      setTrackerTab("calendar");
      loadItems();
      toast.success("Compliance item added");
    } catch { toast.error("Failed to save — backend unreachable"); }
    finally { setSaving(false); }
  };

  const handleComplete = async (id: string) => {
    await backendApi.patch(`/compliance/items/${id}/complete`);
    loadItems();
  };

  const handleCorporateSetup = async () => {
    if (!corpForm.company_name) return;
    setSaving(true);
    try {
      await backendApi.post(`/compliance/corporate/setup?company_name=${encodeURIComponent(corpForm.company_name)}`);
      setTrackerTab("calendar");
      loadItems();
      toast.success("Compliance calendar generated");
    } catch { toast.error("Setup failed — backend unreachable"); }
    finally { setSaving(false); }
  };

  const handleLimitation = async () => {
    try {
      const { data } = await backendApi.post("/compliance/limitation", limitForm);
      setLimitResult(data);
    } catch { toast.error("Calculation failed"); }
  };

  return (
    <AppLayout
      title="Company Compliance"
      subtitle="Track compliance deadlines, MCA filings, and limitation periods"
    >
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Upcoming alert */}
        {upcoming.length > 0 && (
          <div className="vk-card p-4" style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">{upcoming.length} deadlines in next 30 days</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcoming.slice(0, 4).map((u) => (
                <div key={u.id} className="text-xs rounded px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--vk-text)" }}>{u.name}</span>
                  <span className="ml-2 font-bold" style={urgencyStyle(u.days_remaining)}>
                    {u.days_remaining === 0 ? "Today" : `${u.days_remaining}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--vk-navy-dark)" }}>
          {[
            { key: "calendar",   label: "Calendar" },
            { key: "add",        label: "Add Item" },
            { key: "corporate",  label: "Corporate Setup" },
            { key: "limitation", label: "Limitation Period" },
          ].map((t) => (
            <button
              key={t.key}
              className={`flex-1 text-xs py-2 rounded-md font-semibold transition-colors ${trackerTab === t.key ? "text-navy" : "text-dim"}`}
              style={trackerTab === t.key ? { background: "var(--vk-gold)" } : {}}
              onClick={() => setTrackerTab(t.key as typeof trackerTab)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Calendar */}
        {trackerTab === "calendar" && (
          <div className="space-y-3">
            {loadingItems ? (
              [...Array(4)].map((_, i) => <div key={i} className="vk-skeleton h-16 rounded-xl" />)
            ) : items.length === 0 ? (
              <div className="vk-card p-12 text-center text-dim">
                <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No compliance items yet</p>
                <p className="text-sm mt-1">Add items manually or use Corporate Setup for auto-generation.</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className={`vk-card p-4 flex items-center justify-between gap-4 ${item.status === "completed" ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>{item.name}</span>
                      <span className={`vk-badge text-[10px] ${categoryColor[item.category] ?? "vk-badge-muted"}`}>{item.category}</span>
                      {item.status === "completed" && <span className="vk-badge vk-badge-green text-[10px]">Done</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-dim flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {item.days_remaining != null && item.status !== "completed" && (
                        <span className="text-xs font-bold" style={urgencyStyle(item.days_remaining)}>
                          {item.days_remaining < 0 ? "Overdue" : item.days_remaining === 0 ? "Due today" : `${item.days_remaining} days left`}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-dim mt-0.5 truncate">{item.description}</p>}
                  </div>
                  {item.status !== "completed" && (
                    <button className="shrink-0 p-1.5 rounded-lg text-dim hover:text-green-400 transition-colors" onClick={() => handleComplete(item.id)} title="Mark complete">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Add item */}
        {trackerTab === "add" && (
          <div className="vk-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Add Compliance Item</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="vk-label">Name *</label>
                <input className="vk-input w-full" placeholder="e.g. GSTR-3B Filing — July 2025" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Category</label>
                <select className="vk-input w-full" value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Due Date *</label>
                <input className="vk-input w-full" type="date" value={addForm.due_date} onChange={(e) => setAddForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="vk-label">Notes</label>
                <input className="vk-input w-full" placeholder="Optional notes" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary text-sm" onClick={handleAddItem} disabled={saving || !addForm.name || !addForm.due_date}>
              {saving ? "Saving…" : "Add Item"}
            </button>
          </div>
        )}

        {/* Corporate Setup */}
        {trackerTab === "corporate" && (
          <div className="vk-card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 mt-0.5 shrink-0 text-gold" />
              <div>
                <h3 className="font-semibold text-sm">Corporate Compliance Auto-Setup</h3>
                <p className="text-xs text-dim mt-0.5">Auto-generate GST, MCA, and Income Tax compliance calendar for your company.</p>
              </div>
            </div>
            <div>
              <label className="vk-label">Company Name</label>
              <input className="vk-input w-full" placeholder="e.g. Acme Pvt Ltd" value={corpForm.company_name} onChange={(e) => setCorpForm({ company_name: e.target.value })} />
            </div>
            <div className="vk-disclaimer text-xs space-y-1">
              <p className="font-semibold">Will generate:</p>
              <p>• GSTR-1 (11th of each month) &nbsp;• GSTR-3B (20th of each month)</p>
              <p>• TDS Returns (quarterly) &nbsp;• Advance Tax (4 installments)</p>
              <p>• MCA Annual Return (MGT-7) &nbsp;• Financial Statement (AOC-4)</p>
            </div>
            <button className="btn-primary text-sm" onClick={handleCorporateSetup} disabled={saving || !corpForm.company_name}>
              {saving ? "Setting up…" : "Generate Compliance Calendar"}
            </button>
          </div>
        )}

        {/* Limitation Period */}
        {trackerTab === "limitation" && (
          <div className="vk-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">Limitation Period Calculator</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="vk-label">Matter Type</label>
                <select className="vk-input w-full" value={limitForm.matter_type} onChange={(e) => setLimitForm((f) => ({ ...f, matter_type: e.target.value }))}>
                  {LIMITATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">Date of Incident / Cause of Action</label>
                <input className="vk-input w-full" type="date" value={limitForm.incident_date} onChange={(e) => setLimitForm((f) => ({ ...f, incident_date: e.target.value }))} />
              </div>
              <div>
                <label className="vk-label">Brief Description</label>
                <input className="vk-input w-full" placeholder="Optional" value={limitForm.cause_of_action} onChange={(e) => setLimitForm((f) => ({ ...f, cause_of_action: e.target.value }))} />
              </div>
            </div>
            <button className="btn-primary text-sm" onClick={handleLimitation} disabled={!limitForm.incident_date}>Calculate</button>
            {limitResult && (
              <div className={`rounded-xl p-4 space-y-2 border ${(limitResult as {status:string}).status === "expired" ? "border-red-500/30 bg-red-500/5" : (limitResult as {warning?:boolean}).warning ? "border-yellow-500/30 bg-yellow-500/5" : "border-green-500/30 bg-green-500/5"}`}>
                <div className="flex items-center gap-2">
                  {(limitResult as {status:string}).status === "expired" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-green-400" />}
                  <span className="font-semibold text-sm">{String((limitResult as Record<string,unknown>).matter_type)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><p className="text-dim">Limitation Period</p><p className="font-bold">{String((limitResult as Record<string,unknown>).limitation_years)} years</p></div>
                  <div><p className="text-dim">Expiry Date</p><p className="font-bold">{new Date(String((limitResult as Record<string,unknown>).expiry_date)).toLocaleDateString("en-IN")}</p></div>
                  <div>
                    <p className="text-dim">Status</p>
                    <p className={`font-bold ${(limitResult as {status:string}).status === "expired" ? "text-red-400" : (limitResult as {warning?:boolean}).warning ? "text-yellow-400" : "text-green-400"}`}>
                      {(limitResult as {status:string}).status === "expired" ? "EXPIRED" : `${String((limitResult as Record<string,unknown>).days_remaining)} days left`}
                    </p>
                  </div>
                </div>
                {(limitResult as {warning?:boolean}).warning && <p className="text-xs text-yellow-400">Warning: Less than 30 days remaining. File immediately.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
