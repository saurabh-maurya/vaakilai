"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Plus, Mail, MessageSquare, Folder, Clock, CheckCircle, XCircle, Send, UserPlus } from "lucide-react";
import { backendApi, getApiErrorMessage } from "@/lib/api";
import { getInitials } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

interface CaseSummary {
  id: string;
  title: string;
}

interface UpdateLog {
  id: string;
  message: string;
  channel: string;
  sent_at: string;
}

export default function LawyerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-client form
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteToPortal, setInviteToPortal] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [banner, setBanner] = useState("");

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [updates, setUpdates] = useState<UpdateLog[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.get("/clients/");
      setClients(data || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (client: Client) => {
    try {
      const [{ data: caseData }, { data: updateData }] = await Promise.all([
        backendApi.get(`/clients/${client.id}/cases`),
        backendApi.get(`/clients/${client.id}/updates`),
      ]);
      setCases(caseData || []);
      setUpdates(updateData || []);
    } catch {
      setCases([]);
      setUpdates([]);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedClient) loadDetail(selectedClient);
  }, [selectedClient]);

  const resetForm = () => {
    setName(""); setEmail(""); setPhone(""); setNote(""); setInviteToPortal(false); setFormError("");
  };

  const handleAddClient = async () => {
    if (!name.trim()) return;
    if (inviteToPortal && !email.trim()) {
      setFormError("Client email is required to invite them to the portal.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await backendApi.post("/clients/", {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: note.trim() || undefined,
      });

      if (inviteToPortal) {
        try {
          await backendApi.post("/client/invite", {
            client_email: email.trim(),
            client_name: name.trim(),
            message: note.trim(),
          });
          setBanner(`${name.trim()} added and invited to the client portal at ${email.trim()}.`);
        } catch (err) {
          // Client record was still created — only the invite failed.
          setBanner(`${name.trim()} added, but the portal invitation failed: ${getApiErrorMessage(err)}`);
        }
      } else {
        setBanner(`${name.trim()} added to your clients.`);
      }

      resetForm();
      setShowAdd(false);
      load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Failed to add client."));
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedClient) return;
    setSendingMsg(true);
    try {
      await backendApi.post(`/clients/${selectedClient.id}/updates`, {
        message: newMsg,
        channel: "email",
      });
      setNewMsg("");
      loadDetail(selectedClient);
    } catch { } finally {
      setSendingMsg(false);
    }
  };

  return (
    <AppLayout requirePro title="Client Portal" subtitle="Manage clients, share documents, and communicate securely">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-dim">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
          <button
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            onClick={() => { resetForm(); setShowAdd(true); }}
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Client
          </button>
        </div>

        {banner && (
          <div className="vk-disclaimer rounded-lg p-3 text-xs flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            {banner}
          </div>
        )}

        {/* Add client form */}
        {showAdd && (
          <div className="vk-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Add Client</h3>
              <button onClick={() => setShowAdd(false)} className="text-dim hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="vk-label">Client Name *</label>
                <input className="vk-input w-full" placeholder="e.g. Ranjeet Sharma" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="vk-label">Email</label>
                  <input className="vk-input w-full" type="email" placeholder="client@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="vk-label">Phone</label>
                  <input className="vk-input w-full" placeholder="+91…" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg p-3 cursor-pointer" style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={inviteToPortal}
                  onChange={e => setInviteToPortal(e.target.checked)}
                />
                <span className="text-xs" style={{ color: "var(--vk-text-muted)" }}>
                  <span className="font-medium" style={{ color: "var(--vk-text)" }}>Invite to the client portal</span> — if they already
                  have (or should get) a VakilAI account, send an invite to this email so they can log in and track their case.
                </span>
              </label>

              {inviteToPortal && (
                <div>
                  <label className="vk-label">Personal Note (optional)</label>
                  <textarea
                    className="vk-input w-full h-16 resize-none"
                    placeholder="Add a note to the invitation..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
              )}

              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                onClick={handleAddClient}
                disabled={saving || !name.trim()}
              >
                {inviteToPortal ? <Mail className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {saving ? "Saving…" : inviteToPortal ? "Add & Invite" : "Add Client"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Client list */}
          <div className="col-span-1 space-y-2">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="vk-skeleton h-20 rounded-xl" />)
            ) : clients.length === 0 ? (
              <div className="vk-card p-8 text-center text-dim">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">No clients yet</p>
                <p className="text-xs mt-1">Add a client to get started.</p>
              </div>
            ) : (
              clients.map(client => (
                <button
                  key={client.id}
                  className={`w-full text-left vk-card p-3.5 space-y-1.5 transition-colors ${selectedClient?.id === client.id ? "ring-1 ring-[color:var(--vk-gold)]" : ""}`}
                  onClick={() => setSelectedClient(client)}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}
                    >
                      {getInitials(client.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--vk-text)" }}>{client.name}</p>
                      <p className="text-xs text-dim truncate">{client.email || client.phone || "No contact info"}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Client detail / messaging */}
          <div className="col-span-2">
            {!selectedClient ? (
              <div className="vk-card p-12 text-center text-dim h-full flex flex-col items-center justify-center">
                <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-semibold">Select a client</p>
                <p className="text-sm mt-1">View their cases and send secure messages.</p>
              </div>
            ) : (
              <div className="vk-card flex flex-col h-[520px]">
                {/* Client header */}
                <div className="p-4 border-b" style={{ borderColor: "var(--vk-border)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "var(--vk-gold-dim)", color: "var(--vk-gold-light)" }}
                    >
                      {getInitials(selectedClient.name)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{selectedClient.name}</p>
                      <p className="text-xs text-dim">{selectedClient.email || selectedClient.phone || "No contact info"}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="vk-badge vk-badge-muted text-[10px] flex items-center gap-1">
                        <Folder className="w-3 h-3" />{cases.length} case{cases.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Updates / messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {updates.length === 0 ? (
                    <div className="text-center text-dim py-8">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No updates yet. Send the first one.</p>
                    </div>
                  ) : (
                    updates.map(u => (
                      <div key={u.id} className="flex justify-end">
                        <div
                          className="max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm"
                          style={{ background: "var(--vk-gold-dim)", color: "var(--vk-text)" }}
                        >
                          {u.message}
                          <p className="text-[10px] text-dim mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(u.sent_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            {" · "}{u.channel}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message input */}
                <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--vk-border)" }}>
                  <input
                    className="vk-input flex-1 text-sm"
                    placeholder="Send an update to this client..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  />
                  <button
                    className="btn-primary px-3 py-2"
                    onClick={handleSendMessage}
                    disabled={sendingMsg || !newMsg.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
