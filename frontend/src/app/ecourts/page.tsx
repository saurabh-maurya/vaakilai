"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Landmark, Plus, RefreshCw, Calendar, ShieldCheck, ShieldAlert, Trash2, Edit2,
  Briefcase, CalendarClock, AlertTriangle, User,
} from "lucide-react";
import toast from "react-hot-toast";
import { backendApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { isProRole } from "@/lib/utils";
import {
  INDIAN_STATES_UT, districtsOf, citiesOf, OTHER_OPTION,
} from "@/lib/indiaLocations";

interface TrackedCase {
  id: string;
  case_number: string;
  case_title: string;
  court_name: string;
  court_type: string;
  state: string;
  district?: string;
  city?: string;
  client_name?: string;
  case_status: string;
  next_hearing_date: string;
  source: string;
  validated?: boolean;
  validation_failed?: boolean;
  updated_at: string;
  days_remaining?: number;
}

const COURT_TYPES = ["district", "high_court", "supreme_court", "tribunal", "consumer_forum"];

export default function ECourtsPage() {
  const { user } = useAuth();
  // Advocates manage a caseload by client; individuals track their own matters.
  const isLawyer = user ? isProRole(user.role) : false;

  const [cases, setCases] = useState<TrackedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>("");
  const [form, setForm] = useState({
    case_number: "", court_type: "district", state: "", district: "", city: "",
    case_title: "", next_hearing_date: "", court_name: "", client_name: "", validate_on_ecourt: false,
  });
  // "Other…" free-text mode for district / city when not in the list.
  const [districtOther, setDistrictOther] = useState(false);
  const [cityOther, setCityOther] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hearingForm, setHearingForm] = useState({ date: "", notes: "" });

  const districtOptions = form.state ? districtsOf(form.state) : [];
  const cityOptions = form.state && form.district ? citiesOf(form.state, form.district) : [];

  const resetForm = () => {
    setForm({
      case_number: "", court_type: "district", state: "", district: "", city: "",
      case_title: "", next_hearing_date: "", court_name: "", client_name: "", validate_on_ecourt: false,
    });
    setDistrictOther(false);
    setCityOther(false);
  };

  const onStateChange = (state: string) => {
    setForm(f => ({ ...f, state, district: "", city: "" }));
    setDistrictOther(false);
    setCityOther(false);
  };
  const onDistrictChange = (val: string) => {
    if (val === OTHER_OPTION) {
      setDistrictOther(true);
      setForm(f => ({ ...f, district: "", city: "" }));
    } else {
      setDistrictOther(false);
      setForm(f => ({ ...f, district: val, city: "" }));
    }
    setCityOther(false);
  };
  const onCityChange = (val: string) => {
    if (val === OTHER_OPTION) {
      setCityOther(true);
      setForm(f => ({ ...f, city: "" }));
    } else {
      setCityOther(false);
      setForm(f => ({ ...f, city: val }));
    }
  };

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
      const { data } = await backendApi.post("/ecourts/track", form);
      const wantedValidation = form.validate_on_ecourt;
      setShowAdd(false);
      resetForm();
      if (data?.validated) {
        toast.success("Case validated on eCourts and saved");
      } else if (wantedValidation) {
        toast("Couldn't validate on eCourts — saved manually (not validated)", { icon: "⚠️" });
      } else {
        toast.success("Case saved (not validated)");
      }
      load();
    } catch {
      toast.error("Failed to save case. Please try again.");
    } finally { setSaving(false); }
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

  // Distinct clients across the caseload (advocate view).
  const clients = Array.from(
    new Set(cases.map((c) => c.client_name).filter((n): n is string => !!n))
  ).sort();

  const visibleCases = clientFilter
    ? cases.filter((c) => (c.client_name || "") === clientFilter)
    : cases;

  // Caseload summary for advocates.
  const stats = {
    total: cases.length,
    thisWeek: cases.filter((c) => c.days_remaining != null && c.days_remaining >= 0 && c.days_remaining <= 7).length,
    overdue: cases.filter((c) => c.days_remaining != null && c.days_remaining < 0).length,
    validated: cases.filter((c) => c.validated).length,
  };

  return (
    <AppLayout
      title={isLawyer ? "Case Management" : "eCourts Tracker"}
      subtitle={isLawyer
        ? "Manage your court cases and hearings by client"
        : "Track hearing dates and case status across Indian courts"}
    >
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Caseload summary — advocate view only */}
        {isLawyer && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Cases",    value: stats.total,     icon: Briefcase,     color: "#60a5fa" },
              { label: "Hearings ≤ 7d",  value: stats.thisWeek,  icon: CalendarClock, color: "#f59e0b" },
              { label: "Overdue",        value: stats.overdue,   icon: AlertTriangle, color: "#f87171" },
              { label: "eCourts Valid.", value: stats.validated, icon: ShieldCheck,   color: "#4ade80" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="vk-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, color }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color: "var(--vk-text)" }}>{value}</p>
                  <p className="text-[11px] text-dim mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Header actions */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-sm text-dim">
              {isLawyer ? `${visibleCases.length} of ${cases.length} cases` : `${cases.length} cases tracked`}
            </p>
            {/* Client filter — advocate view only */}
            {isLawyer && clients.length > 0 && (
              <select
                className="vk-input text-xs py-1.5"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">All clients</option>
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> {isLawyer ? "Add Case" : "Track Case"}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="vk-card p-5 space-y-4">
            <h3 className="font-semibold text-sm">{isLawyer ? "Add New Case" : "Track New Case"}</h3>
            {isLawyer && (
              <div>
                <label className="vk-label">Client</label>
                <input
                  className="vk-input w-full"
                  placeholder="e.g. Ranjeet Sharma"
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                />
              </div>
            )}
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
                <label className="vk-label">State / UT</label>
                <select className="vk-input w-full" value={form.state} onChange={e => onStateChange(e.target.value)}>
                  <option value="">Select state / UT</option>
                  {INDIAN_STATES_UT.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="vk-label">District</label>
                {form.state && districtOptions.length > 0 && !districtOther ? (
                  <select
                    className="vk-input w-full"
                    value={form.district || ""}
                    onChange={e => onDistrictChange(e.target.value)}
                  >
                    <option value="">Select district</option>
                    {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value={OTHER_OPTION}>Other…</option>
                  </select>
                ) : (
                  <input
                    className="vk-input w-full"
                    placeholder={form.state ? "Type district name" : "Select a state first"}
                    disabled={!form.state}
                    value={form.district}
                    onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                  />
                )}
              </div>
              <div>
                <label className="vk-label">City</label>
                {form.district && cityOptions.length > 0 && !cityOther ? (
                  <select
                    className="vk-input w-full"
                    value={form.city || ""}
                    onChange={e => onCityChange(e.target.value)}
                  >
                    <option value="">Select city</option>
                    {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value={OTHER_OPTION}>Other…</option>
                  </select>
                ) : (
                  <input
                    className="vk-input w-full"
                    placeholder={form.district ? "Type city name" : "Select a district first"}
                    disabled={!form.district && !districtOther}
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  />
                )}
              </div>
              <div>
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
            {/* Validate on eCourts */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 rounded-lg" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-[var(--vk-gold)] cursor-pointer"
                checked={form.validate_on_ecourt}
                onChange={e => setForm(f => ({ ...f, validate_on_ecourt: e.target.checked }))}
              />
              <span className="text-xs">
                <span className="font-semibold" style={{ color: "var(--vk-text)" }}>Validate on eCourts</span>
                <span className="text-dim block mt-0.5">
                  When checked, we verify the case against the free eCourts API before saving.
                  If it can&apos;t be confirmed (or this is left unchecked), the case is saved
                  manually and marked <span className="font-medium">Not validated</span>.
                </span>
              </span>
            </label>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</button>
              <button className="btn-primary text-xs py-2 px-4" onClick={handleAdd} disabled={saving || !form.case_number}>
                {saving ? "Saving..." : "Track Case"}
              </button>
            </div>
          </div>
        )}

        {/* Cases list */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-24 rounded-xl" />)}</div>
        ) : visibleCases.length === 0 ? (
          <div className="vk-card p-12 text-center text-dim">
            <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">
              {cases.length === 0
                ? (isLawyer ? "No cases yet" : "No cases tracked yet")
                : "No cases for this client"}
            </p>
            <p className="text-sm mt-1">
              {cases.length === 0
                ? `Click “${isLawyer ? "Add" : "Track"} Case” to add your first case.`
                : "Try a different client filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCases.map(c => (
              <div key={c.id} className="vk-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{c.case_number}</span>
                      <span className="vk-badge vk-badge-muted text-[10px]">{c.court_type.replace("_", " ")}</span>
                      <span className={`vk-badge text-[10px] ${c.case_status === "Disposed" ? "vk-badge-green" : "vk-badge-blue"}`}>{c.case_status}</span>
                      {c.validated ? (
                        <span className="vk-badge vk-badge-green text-[10px] flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> eCourts Validated
                        </span>
                      ) : (
                        <span className="vk-badge vk-badge-gold text-[10px] flex items-center gap-1" title={c.validation_failed ? "Validation was attempted but eCourts couldn't confirm this case" : "Saved manually — not validated on eCourts"}>
                          <ShieldAlert className="w-3 h-3" /> Not validated
                        </span>
                      )}
                    </div>
                    {isLawyer && c.client_name && (
                      <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: "var(--vk-gold-light)" }}>
                        <User className="w-3 h-3" /> {c.client_name}
                      </p>
                    )}
                    {c.case_title && <p className="text-xs text-dim mt-1">{c.case_title}</p>}
                    {(c.court_name || c.city || c.district || c.state) && (
                      <p className="text-[11px] text-dim">
                        {[c.court_name, c.city, c.district, c.state].filter(Boolean).join(" · ")}
                      </p>
                    )}
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
