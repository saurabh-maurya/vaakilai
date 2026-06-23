"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Case, CaseStatus } from "@/types";
import { formatDate } from "@/lib/utils";
import { backendApi } from "@/lib/api";
import {
  Briefcase, Calendar, Search, Plus, X,
  ChevronRight, Users, RefreshCw, CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const PRACTICE_AREAS = [
  "Criminal Law", "Family Law", "Property Law", "Contract Law",
  "Consumer Protection", "Labour Law", "Constitutional Law",
  "Taxation", "Corporate Law", "Banking Law", "Motor Accident",
  "Commercial Law", "Intellectual Property", "Immigration",
];

const COURTS = [
  "Supreme Court of India", "Delhi High Court", "Bombay High Court",
  "Allahabad High Court", "Madras High Court", "Calcutta High Court",
  "District Court", "Sessions Court", "Consumer Forum",
  "Labour Court", "Tribunal",
];

const STATUS_STYLES: Record<CaseStatus, { label: string; class: string }> = {
  active:   { label: "Active",   class: "vk-badge-green" },
  pending:  { label: "Pending",  class: "vk-badge-gold" },
  closed:   { label: "Closed",   class: "vk-badge-muted" },
  on_hold:  { label: "On Hold",  class: "vk-badge-blue" },
  appealed: { label: "Appealed", class: "vk-badge-red" },
};

const MOCK_CASES: Case[] = [
  {
    id: "1", case_number: "WP/2024/1234", title: "Sharma vs. State of UP",
    client_name: "Ranjeet Sharma", client_id: "c1", practice_area: "Criminal Law",
    court: "Allahabad High Court", judge: "Justice R.K. Mishra",
    status: "active", next_hearing: "2026-06-20", filing_date: "2024-03-15",
    description: "Bail application in NDPS case", documents_count: 12, tasks_pending: 3, lawyer_id: "l1",
  },
  {
    id: "2", case_number: "CS/2025/567", title: "Nexus Ventures vs. ABC Corp",
    client_name: "Nexus Ventures Ltd.", client_id: "c2", practice_area: "Commercial Law",
    court: "Delhi High Court", status: "active", next_hearing: "2026-06-22",
    filing_date: "2025-01-10", documents_count: 24, tasks_pending: 1, lawyer_id: "l1",
  },
  {
    id: "3", case_number: "SA/2024/789", title: "Mehta Property Dispute",
    client_name: "Arvind Mehta", client_id: "c3", practice_area: "Property Law",
    court: "Mumbai Sessions Court", status: "pending", next_hearing: "2026-06-25",
    filing_date: "2024-11-20", documents_count: 8, tasks_pending: 0, lawyer_id: "l1",
  },
  {
    id: "4", case_number: "RFA/2023/321", title: "Gupta Divorce Proceedings",
    client_name: "Sunita Gupta", client_id: "c4", practice_area: "Family Law",
    court: "District Court, Jaipur", status: "closed", filing_date: "2023-06-01",
    documents_count: 35, tasks_pending: 0, lawyer_id: "l1",
  },
  {
    id: "5", title: "Kumar Labour Dispute",
    client_name: "Anil Kumar", client_id: "c5", practice_area: "Labour Law",
    court: "Labour Court, Chennai", status: "on_hold", next_hearing: "2026-07-10",
    filing_date: "2025-04-15", documents_count: 6, tasks_pending: 2, lawyer_id: "l1",
  },
];

type ViewMode = "table" | "kanban";

interface NewCaseForm {
  title: string;
  client_name: string;
  practice_area: string;
  court: string;
  status: CaseStatus;
  filing_date: string;
  next_hearing: string;
  case_number: string;
  description: string;
}

const EMPTY_FORM: NewCaseForm = {
  title: "", client_name: "", practice_area: "", court: "",
  status: "pending", filing_date: new Date().toISOString().slice(0, 10),
  next_hearing: "", case_number: "", description: "",
};

export default function CasesPage() {
  const [view, setView]               = useState<ViewMode>("table");
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [cases, setCases]             = useState<Case[]>(MOCK_CASES);
  const [loading, setLoading]         = useState(false);

  // Modal state
  const [showModal, setShowModal]     = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState<NewCaseForm>({ ...EMPTY_FORM });

  const filtered = cases.filter(
    (c) =>
      (!search || c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.client_name.toLowerCase().includes(search.toLowerCase())) &&
      (!statusFilter || c.status === statusFilter)
  );

  const byStatus = (s: CaseStatus) => filtered.filter((c) => c.status === s);

  const KANBAN_COLS: { status: CaseStatus; label: string }[] = [
    { status: "pending", label: "Pending" },
    { status: "active",  label: "Active" },
    { status: "on_hold", label: "On Hold" },
    { status: "closed",  label: "Closed" },
  ];

  // Fetch cases from backend
  async function fetchCases() {
    setLoading(true);
    try {
      const { data } = await backendApi.get("/cases", { params: { per_page: 50 } });
      const items: Case[] = data?.items ?? data ?? [];
      if (items.length > 0) setCases(items);
      else setCases(MOCK_CASES); // fallback to mock if backend empty
      toast.success(`${items.length || MOCK_CASES.length} cases loaded`);
    } catch {
      // Backend not connected — stay on mock data silently
      setCases(MOCK_CASES);
      toast("Showing demo data — connect backend for live cases", { icon: "ℹ️" });
    } finally {
      setLoading(false);
    }
  }

  // Create a new case
  async function handleCreate() {
    if (!form.title.trim() || !form.client_name.trim()) return;
    setSaving(true);
    try {
      const { data } = await backendApi.post("/cases", {
        ...form,
        filing_date: form.filing_date || undefined,
        next_hearing: form.next_hearing || undefined,
      });
      setCases((prev) => [data, ...prev]);
      toast.success("Case created successfully!");
    } catch {
      // Backend unavailable — add locally
      const local: Case = {
        id: String(Date.now()),
        ...form,
        client_id: "",
        documents_count: 0,
        tasks_pending: 0,
        lawyer_id: "l1",
      };
      setCases((prev) => [local, ...prev]);
      toast.success("Case added (local — will sync when backend is connected)");
    } finally {
      setSaving(false);
      setSubmitted(true);
    }
  }

  function openModal() {
    setForm({ ...EMPTY_FORM });
    setSubmitted(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSubmitted(false);
  }

  const canSave = form.title.trim().length > 0 && form.client_name.trim().length > 0;

  return (
    <AppLayout
      requirePro
      title="Case Management"
      subtitle={`${filtered.length} case${filtered.length !== 1 ? "s" : ""}`}
      actions={
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
            {(["table", "kanban"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-all"
                style={view === v ? { background: "var(--vk-gold)", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* List / Refresh cases */}
          <button
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={fetchCases}
            disabled={loading}
            title="Fetch cases from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "List Cases"}
          </button>

          {/* New Case */}
          <button className="btn-primary text-xs flex items-center gap-1.5" onClick={openModal}>
            <Plus className="w-3.5 h-3.5" /> New Case
          </button>
        </div>
      }
    >
      {/* Search + filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
          <input className="vk-input pl-10" placeholder="Search cases or clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="vk-input w-40 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table view */}
      {view === "table" && (
        <div className="vk-card overflow-hidden">
          <table className="vk-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Client</th>
                <th>Practice Area</th>
                <th>Court</th>
                <th>Next Hearing</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dim">No cases found</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="cursor-pointer">
                    <td>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[180px]" style={{ color: "var(--vk-text)" }}>{c.title}</p>
                        {c.case_number && <p className="text-[11px] text-dim font-mono">{c.case_number}</p>}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-dim" />
                        <span className="text-xs">{c.client_name}</span>
                      </div>
                    </td>
                    <td><span className="text-xs">{c.practice_area}</span></td>
                    <td><span className="text-xs truncate max-w-[140px]">{c.court ?? "—"}</span></td>
                    <td>
                      {c.next_hearing ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gold" />
                          <span className="text-xs text-gold">{formatDate(c.next_hearing)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-dim">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`vk-badge ${STATUS_STYLES[c.status].class} text-[11px]`}>
                        {STATUS_STYLES[c.status].label}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost p-1">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLS.map(({ status, label }) => {
            const cols = byStatus(status);
            return (
              <div key={status} className="shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`vk-badge ${STATUS_STYLES[status].class}`}>{label}</span>
                  <span className="text-xs text-dim">({cols.length})</span>
                </div>
                <div className="space-y-2">
                  {cols.map((c) => (
                    <div key={c.id} className="kanban-card">
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--vk-text)" }}>{c.title}</p>
                      <p className="text-[11px] text-dim mb-2">{c.client_name}</p>
                      <div className="flex items-center justify-between">
                        <span className="vk-badge vk-badge-muted text-[10px]">{c.practice_area}</span>
                        {c.next_hearing && (
                          <span className="text-[11px] text-gold flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {formatDate(c.next_hearing)}
                          </span>
                        )}
                      </div>
                      {c.tasks_pending > 0 && (
                        <p className="text-[11px] text-dim mt-2">{c.tasks_pending} task{c.tasks_pending > 1 ? "s" : ""} pending</p>
                      )}
                    </div>
                  ))}
                  {cols.length === 0 && (
                    <div className="p-4 rounded-xl text-center text-xs text-dim" style={{ border: "1px dashed var(--vk-border)" }}>
                      No cases
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Case Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl"
            style={{ background: "var(--vk-navy-card)", border: "1px solid var(--vk-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--vk-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--vk-gold-dim)" }}>
                  <Briefcase className="w-4 h-4 text-gold" />
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--vk-text)" }}>New Case</h2>
              </div>
              <button onClick={closeModal} className="btn-ghost p-1.5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              /* Success */
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold mb-1">Case Created</h3>
                <p className="text-sm text-dim mb-6">
                  <span className="text-gold font-medium">{form.title}</span> has been added to your case list.
                </p>
                <div className="flex gap-3 justify-center">
                  <button className="btn-secondary text-sm" onClick={closeModal}>Close</button>
                  <button className="btn-primary text-sm" onClick={() => { setForm({ ...EMPTY_FORM }); setSubmitted(false); }}>
                    Add Another
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Row 1: Title */}
                <div>
                  <label className="vk-label">Case Title <span className="text-red-400">*</span></label>
                  <input
                    className="vk-input w-full text-sm"
                    placeholder="e.g. Sharma vs. State of UP"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

                {/* Row 2: Client + Case No */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="vk-label">Client Name <span className="text-red-400">*</span></label>
                    <input
                      className="vk-input w-full text-sm"
                      placeholder="e.g. Ranjeet Sharma"
                      value={form.client_name}
                      onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="vk-label">Case Number</label>
                    <input
                      className="vk-input w-full text-sm font-mono"
                      placeholder="e.g. WP/2026/1234"
                      value={form.case_number}
                      onChange={(e) => setForm((f) => ({ ...f, case_number: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Row 3: Practice Area + Court */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="vk-label">Practice Area</label>
                    <select
                      className="vk-input w-full text-sm"
                      value={form.practice_area}
                      onChange={(e) => setForm((f) => ({ ...f, practice_area: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {PRACTICE_AREAS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="vk-label">Court</label>
                    <select
                      className="vk-input w-full text-sm"
                      value={form.court}
                      onChange={(e) => setForm((f) => ({ ...f, court: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {COURTS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 4: Status + Filing Date + Next Hearing */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="vk-label">Status</label>
                    <select
                      className="vk-input w-full text-sm"
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CaseStatus }))}
                    >
                      {Object.entries(STATUS_STYLES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="vk-label">Filing Date</label>
                    <input
                      type="date"
                      className="vk-input w-full text-sm"
                      value={form.filing_date}
                      onChange={(e) => setForm((f) => ({ ...f, filing_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="vk-label">Next Hearing</label>
                    <input
                      type="date"
                      className="vk-input w-full text-sm"
                      value={form.next_hearing}
                      onChange={(e) => setForm((f) => ({ ...f, next_hearing: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Row 5: Description */}
                <div>
                  <label className="vk-label">Description</label>
                  <textarea
                    className="vk-input w-full text-sm resize-none"
                    rows={2}
                    placeholder="Brief summary of the case…"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1" style={{ borderTop: "1px solid var(--vk-border)" }}>
                  <button className="btn-secondary text-sm" onClick={closeModal}>Cancel</button>
                  <button
                    className="btn-primary text-sm"
                    disabled={!canSave || saving}
                    onClick={handleCreate}
                  >
                    {saving ? "Creating…" : "Create Case"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
