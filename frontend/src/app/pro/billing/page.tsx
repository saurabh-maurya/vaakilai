"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import type { Invoice, InvoiceStatus } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Receipt, TrendingUp, Clock, AlertCircle, Plus, Download, Eye,
  X, Trash2, Mail, CheckCircle,
} from "lucide-react";


const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "vk-badge-muted",
  sent: "vk-badge-blue",
  paid: "vk-badge-green",
  overdue: "vk-badge-red",
  cancelled: "vk-badge-muted",
};

const MOCK_INVOICES: Invoice[] = [
  {
    id: "1", invoice_number: "INV-2026-042", client_name: "Nexus Ventures Ltd.", client_id: "c2",
    case_id: "2", amount: 21186, tax: 3814, total: 25000, status: "sent",
    due_date: "2026-07-01", issued_date: "2026-06-10",
    items: [{ description: "Legal consultation — June 2026", hours: 4, rate: 5000, amount: 20000 }, { description: "Document review", amount: 1186 }],
  },
  {
    id: "2", invoice_number: "INV-2026-041", client_name: "Ranjeet Sharma", client_id: "c1",
    case_id: "1", amount: 8474, tax: 1526, total: 10000, status: "paid",
    due_date: "2026-06-01", issued_date: "2026-05-15", paid_date: "2026-05-28",
    items: [{ description: "Court appearance — Allahabad HC", hours: 2, rate: 4237, amount: 8474 }],
  },
  {
    id: "3", invoice_number: "INV-2026-040", client_name: "Arvind Mehta", client_id: "c3",
    amount: 12712, tax: 2288, total: 15000, status: "overdue",
    due_date: "2026-05-20", issued_date: "2026-05-01",
    items: [{ description: "Property dispute consultation", hours: 3, rate: 4237, amount: 12712 }],
  },
  {
    id: "4", invoice_number: "INV-2026-039", client_name: "Sunita Gupta", client_id: "c4",
    amount: 42373, tax: 7627, total: 50000, status: "draft",
    due_date: "2026-07-15", issued_date: "2026-06-17",
    items: [{ description: "Divorce proceedings — full representation", amount: 42373 }],
  },
];

interface LineItem {
  description: string;
  hours: string;
  rate: string;
  amount: string;
}

const EMPTY_ITEM: LineItem = { description: "", hours: "", rate: "", amount: "" };

function nextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear();
  const nums = invoices
    .map((i) => parseInt(i.invoice_number.split("-")[2] ?? "0", 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `INV-${year}-${String(next).padStart(3, "0")}`;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"invoices" | "time" | "annual-filing">("invoices");

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);

  const filtered = invoices.filter((inv) => !statusFilter || inv.status === statusFilter);
  const totalBilled = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.total, 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total, 0);

  // Auto-compute amount when hours × rate changes
  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
      if (field === "hours" || field === "rate") {
        const h = parseFloat(next[idx].hours) || 0;
        const r = parseFloat(next[idx].rate) || 0;
        if (h > 0 && r > 0) next[idx] = { ...next[idx], amount: (h * r).toFixed(2) };
      }
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0),
    [items]
  );
  const gst = useMemo(() => (subtotal * parseFloat(gstRate || "0")) / 100, [subtotal, gstRate]);
  const grandTotal = subtotal + gst;

  function openModal() {
    setClientName("");
    setClientEmail("");
    setDueDate("");
    setNotes("");
    setGstRate("18");
    setSendEmail(false);
    setEmailTo(user?.email ?? "");
    setItems([{ ...EMPTY_ITEM }]);
    setSubmitted(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSubmitted(false);
  }

  function handleCreate(asDraft: boolean) {
    if (!clientName.trim() || items.every((it) => !it.description.trim())) return;

    const newInv: Invoice = {
      id: String(Date.now()),
      invoice_number: nextInvoiceNumber(invoices),
      client_name: clientName.trim(),
      client_id: "",
      amount: subtotal,
      tax: Math.round(gst),
      total: Math.round(grandTotal),
      status: asDraft ? "draft" : "sent",
      due_date: dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      issued_date: new Date().toISOString().slice(0, 10),
      items: items
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description,
          ...(it.hours ? { hours: parseFloat(it.hours) } : {}),
          ...(it.rate ? { rate: parseFloat(it.rate) } : {}),
          amount: parseFloat(it.amount) || 0,
        })),
    };

    setInvoices((prev) => [newInv, ...prev]);
    setSubmitted(true);
  }

  return (
    <AppLayout
      requirePro
      title="Billing & Invoices"
      subtitle="Invoices, time tracking, and client management"
      actions={
        <button className="btn-primary text-xs flex items-center gap-1.5" onClick={openModal}>
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </button>
      }
    >
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Billed" value={formatCurrency(totalBilled)} icon={TrendingUp} subtitle="This quarter" />
        <StatCard title="Received" value={formatCurrency(totalPaid)} icon={Receipt} trend={{ value: 14, label: "vs last month" }} />
        <StatCard title="Pending" value={formatCurrency(totalPending)} icon={Clock} subtitle="Awaiting payment" />
        <StatCard title="Overdue" value={formatCurrency(totalOverdue)} subtitle="1 invoice" icon={AlertCircle} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
        {([
          { key: "invoices", label: "Invoices" },
          { key: "time", label: "Time Tracker" },
        ] as Array<{ key: "invoices" | "time"; label: string; badge?: string }>).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={activeTab === t.key ? { background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" } : { color: "var(--vk-text-muted)" }}
          >
            {t.label}
            {t.badge && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === t.key ? "rgba(15,23,42,0.3)" : "var(--vk-gold-dim)",
                  color: activeTab === t.key ? "var(--vk-navy)" : "var(--vk-gold)",
                  border: activeTab === t.key ? "none" : "1px solid rgba(201,168,76,0.3)",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "invoices" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <select className="vk-input w-40 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {Object.keys(STATUS_STYLES).map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>

          <div className="vk-card overflow-hidden">
            <table className="vk-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <p className="text-sm font-mono font-medium" style={{ color: "var(--vk-text)" }}>{inv.invoice_number}</p>
                    </td>
                    <td><span className="text-xs">{inv.client_name}</span></td>
                    <td>
                      <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>{formatCurrency(inv.total)}</p>
                      <p className="text-[11px] text-dim">incl. ₹{inv.tax.toLocaleString("en-IN")} GST</p>
                    </td>
                    <td><span className="text-xs">{formatDate(inv.issued_date)}</span></td>
                    <td>
                      <span className={`text-xs ${inv.status === "overdue" ? "text-red-400 font-medium" : ""}`}>
                        {formatDate(inv.due_date)}
                      </span>
                    </td>
                    <td>
                      <span className={`vk-badge ${STATUS_STYLES[inv.status]} capitalize text-[11px]`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost p-1" title="View"><Eye className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost p-1" title="Download"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "time" && (
        <div className="max-w-2xl mx-auto">
          <div className="vk-card p-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--vk-gold-dim)" }}>
              <Clock className="w-8 h-8 text-gold" />
            </div>
            <h2 className="text-lg font-bold mb-2">Time Tracking</h2>
            <p className="text-sm text-dim mb-4">
              Track billable hours per case with one-click timers. Generate invoices automatically from time entries.
            </p>
            <button className="btn-primary">Start Timer</button>
          </div>
          <div className="mt-4 vk-card p-4">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-dim">This week — Time Entries</span>
              <span className="text-gold font-semibold">12.5 hrs billed</span>
            </div>
            {[
              { case: "Sharma vs. State of UP", hours: 4, date: "2026-06-16", desc: "Bail application drafting" },
              { case: "Nexus Ventures vs. ABC Corp", hours: 3, date: "2026-06-15", desc: "Contract review" },
              { case: "Mehta Property Dispute", hours: 5.5, date: "2026-06-14", desc: "Document preparation & client meeting" },
            ].map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: i < 2 ? "1px solid var(--vk-border)" : "none" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--vk-gold-dim)" }}>
                  <Clock className="w-4 h-4 text-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{entry.desc}</p>
                  <p className="text-[11px] text-dim">{entry.case} · {formatDate(entry.date)}</p>
                </div>
                <span className="text-sm font-semibold text-gold">{entry.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── New Invoice Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl shadow-2xl"
            style={{ background: "var(--vk-navy-card)", border: "1px solid var(--vk-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--vk-border)" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--vk-text)" }}>New Invoice</h2>
                <p className="text-xs text-dim mt-0.5">{nextInvoiceNumber(invoices)}</p>
              </div>
              <button onClick={closeModal} className="btn-ghost p-1.5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              /* Success state */
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold mb-1">Invoice Created</h3>
                <p className="text-sm text-dim mb-2">{nextInvoiceNumber(invoices)} has been added to your invoices.</p>
                {sendEmail && (
                  <p className="text-xs text-dim flex items-center justify-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gold" />
                    A copy will be sent to <span className="text-gold ml-1">{emailTo}</span>
                  </p>
                )}
                <button className="btn-primary mt-6 text-sm" onClick={closeModal}>Done</button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Client details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="vk-label">Client Name <span className="text-red-400">*</span></label>
                    <input
                      className="vk-input w-full text-sm"
                      placeholder="e.g. Ranjeet Sharma"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="vk-label">Client Email</label>
                    <input
                      type="email"
                      className="vk-input w-full text-sm"
                      placeholder="client@example.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="vk-label">Due Date</label>
                    <input
                      type="date"
                      className="vk-input w-full text-sm"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="vk-label">GST Rate (%)</label>
                    <select className="vk-input w-full text-sm" value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="vk-label mb-0">Line Items <span className="text-red-400">*</span></label>
                    <button onClick={addItem} className="text-xs text-gold hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--vk-border)" }}>
                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-0 px-3 py-2 text-[11px] text-dim" style={{ background: "var(--vk-navy-light)" }}>
                      <span className="col-span-5">Description</span>
                      <span className="col-span-2 text-right">Hrs</span>
                      <span className="col-span-2 text-right">Rate (₹)</span>
                      <span className="col-span-2 text-right">Amount (₹)</span>
                      <span className="col-span-1"></span>
                    </div>

                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-1 items-center px-3 py-2"
                        style={{ borderTop: "1px solid var(--vk-border)" }}
                      >
                        <input
                          className="vk-input col-span-5 text-xs py-1.5"
                          placeholder="Service description"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                        />
                        <input
                          className="vk-input col-span-2 text-xs py-1.5 text-right"
                          placeholder="—"
                          type="number"
                          min="0"
                          value={item.hours}
                          onChange={(e) => updateItem(idx, "hours", e.target.value)}
                        />
                        <input
                          className="vk-input col-span-2 text-xs py-1.5 text-right"
                          placeholder="—"
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) => updateItem(idx, "rate", e.target.value)}
                        />
                        <input
                          className="vk-input col-span-2 text-xs py-1.5 text-right"
                          placeholder="0"
                          type="number"
                          min="0"
                          value={item.amount}
                          onChange={(e) => updateItem(idx, "amount", e.target.value)}
                        />
                        <button
                          className="col-span-1 flex justify-center btn-ghost p-1 rounded"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-3 space-y-1 text-xs text-right pr-8">
                    <div className="flex justify-end gap-12">
                      <span className="text-dim">Subtotal</span>
                      <span className="font-medium w-24 text-right">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-end gap-12">
                      <span className="text-dim">GST ({gstRate}%)</span>
                      <span className="font-medium w-24 text-right">{formatCurrency(gst)}</span>
                    </div>
                    <div className="flex justify-end gap-12 pt-1" style={{ borderTop: "1px solid var(--vk-border)" }}>
                      <span className="font-semibold" style={{ color: "var(--vk-text)" }}>Total</span>
                      <span className="font-bold text-sm w-24 text-right text-gold">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="vk-label">Notes (optional)</label>
                  <textarea
                    className="vk-input w-full text-sm resize-none"
                    rows={2}
                    placeholder="Payment terms, bank details, or any additional information…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Send by email toggle */}
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                      style={{ background: sendEmail ? "var(--vk-gold)" : "var(--vk-border)" }}
                      onClick={() => setSendEmail((v) => !v)}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                        style={{ transform: sendEmail ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--vk-text)" }}>
                        <Mail className="inline w-3.5 h-3.5 mr-1.5 text-gold" />
                        Send invoice by email
                      </p>
                      <p className="text-[11px] text-dim">Deliver a PDF copy to the recipient after creation</p>
                    </div>
                  </label>

                  {sendEmail && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="vk-label">To (recipient)</label>
                        <input
                          type="email"
                          className="vk-input w-full text-sm"
                          placeholder="recipient@example.com"
                          value={emailTo}
                          onChange={(e) => setEmailTo(e.target.value)}
                        />
                        <p className="text-[10px] text-dim mt-1">Pre-filled with your account email</p>
                      </div>
                      <div>
                        <label className="vk-label">CC (optional)</label>
                        <input
                          type="email"
                          className="vk-input w-full text-sm"
                          placeholder="cc@example.com"
                          defaultValue={clientEmail}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1" style={{ borderTop: "1px solid var(--vk-border)" }}>
                  <button className="btn-secondary text-sm" onClick={() => handleCreate(true)}>
                    Save as Draft
                  </button>
                  <button
                    className="btn-primary text-sm"
                    onClick={() => handleCreate(false)}
                    disabled={!clientName.trim() || items.every((it) => !it.description.trim())}
                  >
                    {sendEmail ? "Create & Send" : "Create Invoice"}
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
