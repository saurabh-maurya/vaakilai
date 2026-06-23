"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Briefcase, FileText, MessageSquare, Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import { backendApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface ClientCase {
  id: string;
  title: string;
  case_number: string;
  status: string;
  next_hearing?: string;
  lawyer_name?: string;
  updated_at: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size?: number;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_role: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "vk-badge-green",
  pending: "vk-badge-gold",
  closed: "vk-badge-muted",
  adjourned: "vk-badge-blue",
};

export default function ClientPortalPage() {
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedCase, setSelectedCase] = useState<ClientCase | null>(null);
  const [tab, setTab] = useState<"cases" | "documents" | "messages">("cases");
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const load = async () => {
    try {
      const { data } = await backendApi.get("/client-portal/dashboard");
      setCases(data.cases || []);
      setDocuments(data.documents || []);
    } catch { } finally {
      setLoading(false); }
  };

  const loadMessages = async (caseId: string) => {
    try {
      const { data } = await backendApi.get(`/client-portal/messages/${caseId}`);
      setMessages(data.messages || []);
    } catch { setMessages([]); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (selectedCase) loadMessages(selectedCase.id);
  }, [selectedCase]);

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedCase) return;
    setSendingMsg(true);
    try {
      await backendApi.post("/client-portal/messages", { case_id: selectedCase.id, content: newMsg });
      setNewMsg("");
      loadMessages(selectedCase.id);
    } catch { } finally { setSendingMsg(false); }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <AppLayout title="My Legal Portal" subtitle="Track your cases, documents, and messages with your lawyer">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4">
            <div className="vk-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--vk-gold)" }}>{cases.length}</p>
              <p className="text-xs text-dim mt-0.5">Active Cases</p>
            </div>
            <div className="vk-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--vk-gold)" }}>{documents.length}</p>
              <p className="text-xs text-dim mt-0.5">Documents</p>
            </div>
            <div className="vk-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--vk-gold)" }}>
                {cases.filter(c => c.next_hearing && new Date(c.next_hearing) > new Date()).length}
              </p>
              <p className="text-xs text-dim mt-0.5">Upcoming Hearings</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--vk-navy-dark)" }}>
          {[
            { key: "cases", label: "My Cases", icon: Briefcase },
            { key: "documents", label: "Documents", icon: FileText },
            { key: "messages", label: "Messages", icon: MessageSquare },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-md font-semibold transition-colors ${tab === t.key ? "text-navy" : "text-dim"}`}
                style={tab === t.key ? { background: "var(--vk-gold)" } : {}}
                onClick={() => setTab(t.key as any)}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Cases tab */}
        {tab === "cases" && (
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-24 rounded-xl" />)
            ) : cases.length === 0 ? (
              <div className="vk-card p-12 text-center text-dim">
                <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No cases yet</p>
                <p className="text-sm mt-1">Your lawyer will share case updates here.</p>
              </div>
            ) : (
              cases.map(c => (
                <div key={c.id} className="vk-card p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--vk-text)" }}>{c.title}</span>
                        <span className={`vk-badge text-[10px] ${STATUS_COLORS[c.status] || "vk-badge-muted"}`}>{c.status}</span>
                      </div>
                      {c.case_number && <p className="text-xs text-dim mt-0.5">Case No: {c.case_number}</p>}
                      {c.lawyer_name && <p className="text-xs text-dim">Lawyer: {c.lawyer_name}</p>}
                    </div>
                    <button
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                      onClick={() => { setSelectedCase(c); setTab("messages"); }}
                    >
                      <MessageSquare className="w-3 h-3" /> Message
                    </button>
                  </div>
                  {c.next_hearing && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-dim" />
                      <span className="text-dim">Next hearing:</span>
                      <span className="font-semibold" style={{ color: "var(--vk-text)" }}>
                        {new Date(c.next_hearing).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {new Date(c.next_hearing).getTime() - Date.now() < 7 * 86400000 && (
                        <span className="vk-badge vk-badge-red text-[10px]">Soon</span>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-dim">Updated {formatDate(c.updated_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Documents tab */}
        {tab === "documents" && (
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="vk-skeleton h-14 rounded-xl" />)
            ) : documents.length === 0 ? (
              <div className="vk-card p-12 text-center text-dim">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No documents shared yet</p>
                <p className="text-sm mt-1">Your lawyer will share documents related to your case here.</p>
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="vk-card p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(201,168,76,0.15)" }}>
                      <FileText className="w-4 h-4" style={{ color: "var(--vk-gold)" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>{doc.name}</p>
                      <p className="text-xs text-dim">
                        {doc.type}
                        {doc.size ? ` · ${formatFileSize(doc.size)}` : ""}
                        {` · ${formatDate(doc.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <span className="vk-badge vk-badge-muted text-[10px]">View</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Messages tab */}
        {tab === "messages" && (
          <div className="vk-card flex flex-col" style={{ height: "480px" }}>
            {/* Case selector */}
            {cases.length > 0 && (
              <div className="p-3 border-b" style={{ borderColor: "var(--vk-border)" }}>
                <select
                  className="vk-input w-full text-xs"
                  value={selectedCase?.id || ""}
                  onChange={e => {
                    const c = cases.find(x => x.id === e.target.value) || null;
                    setSelectedCase(c);
                  }}
                >
                  <option value="">Select a case to message about...</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.title || c.case_number}</option>)}
                </select>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!selectedCase ? (
                <div className="text-center text-dim py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Select a case to view messages.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-dim py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No messages yet. Send your lawyer a message.</p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_role === "client" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm"
                      style={
                        m.sender_role === "client"
                          ? { background: "var(--vk-gold-dim)", color: "var(--vk-text)" }
                          : { background: "rgba(255,255,255,0.06)", color: "var(--vk-text-muted)" }
                      }
                    >
                      {m.sender_role !== "client" && (
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--vk-gold)" }}>Your Lawyer</p>
                      )}
                      {m.content}
                      <p className="text-[10px] text-dim mt-1">
                        {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            {selectedCase && (
              <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--vk-border)" }}>
                <input
                  className="vk-input flex-1 text-sm"
                  placeholder="Message your lawyer..."
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
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="vk-disclaimer rounded-xl p-4 text-xs text-dim">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />
          This portal provides read-only access to your case information. All communications are securely encrypted.
        </div>
      </div>
    </AppLayout>
  );
}
