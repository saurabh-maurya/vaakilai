"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Plus, Mail, MessageSquare, Folder, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { backendApi } from "@/lib/api";
import { getInitials } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  cases_count: number;
  last_activity: string;
  joined_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_role: string;
  created_at: string;
}

export default function LawyerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const load = async () => {
    try {
      const { data } = await backendApi.get("/client-portal/clients");
      setClients(data.clients || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (clientId: string) => {
    try {
      const { data } = await backendApi.get(`/client-portal/messages/${clientId}`);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedClient) loadMessages(selectedClient.id);
  }, [selectedClient]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    setSentMsg("");
    try {
      await backendApi.post("/client-portal/invite", { email: inviteEmail, note: inviteNote });
      setSentMsg(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteNote("");
      setShowInvite(false);
      load();
    } catch {
      setSentMsg("Failed to send invitation.");
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedClient) return;
    setSendingMsg(true);
    try {
      await backendApi.post("/client-portal/messages", {
        case_id: selectedClient.id,
        content: newMsg,
      });
      setNewMsg("");
      loadMessages(selectedClient.id);
    } catch { } finally {
      setSendingMsg(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "active") return "vk-badge-green";
    if (status === "pending") return "vk-badge-gold";
    return "vk-badge-muted";
  };

  return (
    <AppLayout requirePro title="Client Portal" subtitle="Manage clients, share documents, and communicate securely">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-dim">{clients.length} clients</p>
          <button
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            onClick={() => setShowInvite(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Invite Client
          </button>
        </div>

        {sentMsg && (
          <div className="vk-disclaimer rounded-lg p-3 text-xs flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            {sentMsg}
          </div>
        )}

        {/* Invite modal */}
        {showInvite && (
          <div className="vk-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Invite Client</h3>
              <button onClick={() => setShowInvite(false)} className="text-dim hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="vk-label">Client Email *</label>
                <input
                  className="vk-input w-full"
                  type="email"
                  placeholder="client@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="vk-label">Personal Note (optional)</label>
                <textarea
                  className="vk-input w-full h-20 resize-none"
                  placeholder="Add a note to the invitation..."
                  value={inviteNote}
                  onChange={e => setInviteNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setShowInvite(false)}>Cancel</button>
              <button
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                onClick={handleInvite}
                disabled={sending || !inviteEmail.trim()}
              >
                <Mail className="w-3.5 h-3.5" />
                {sending ? "Sending..." : "Send Invitation"}
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
                <p className="text-xs mt-1">Invite clients to get started.</p>
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
                      <p className="text-xs text-dim truncate">{client.email}</p>
                    </div>
                    <span className={`vk-badge text-[10px] shrink-0 ${statusColor(client.status)}`}>{client.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-dim">
                    <span className="flex items-center gap-1"><Folder className="w-3 h-3" />{client.cases_count} cases</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                      {new Date(client.last_activity).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
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
                      <p className="text-xs text-dim">{selectedClient.email}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`vk-badge text-[10px] ${statusColor(selectedClient.status)}`}>{selectedClient.status}</span>
                      <span className="vk-badge vk-badge-muted text-[10px]">{selectedClient.cases_count} cases</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-dim py-8">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No messages yet. Start the conversation.</p>
                    </div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} className={`flex ${m.sender_role === "lawyer" || m.sender_role === "firm_admin" ? "justify-end" : "justify-start"}`}>
                        <div
                          className="max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm"
                          style={
                            m.sender_role === "lawyer" || m.sender_role === "firm_admin"
                              ? { background: "var(--vk-gold-dim)", color: "var(--vk-text)" }
                              : { background: "rgba(255,255,255,0.06)", color: "var(--vk-text-muted)" }
                          }
                        >
                          {m.content}
                          <p className="text-[10px] text-dim mt-1">
                            {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
                    placeholder="Type a message..."
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
