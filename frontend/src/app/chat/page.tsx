"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChat } from "@/hooks/useChat";
import { PRACTICE_AREAS, INDIAN_STATES } from "@/lib/utils";
import {
  Send, StopCircle, Trash2, Mic, Scale, SlidersHorizontal, PhoneCall, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const STARTER_PROMPTS = [
  { label: "Tenant rights", prompt: "What are my rights as a tenant if my landlord wants to evict me without notice?" },
  { label: "Employment", prompt: "What are my legal rights if I am wrongfully terminated from my job?" },
  { label: "Consumer complaint", prompt: "How do I file a consumer complaint against an e-commerce company?" },
  { label: "FIR procedure", prompt: "What is the procedure to file an FIR and what happens after?" },
  { label: "Bail rights", prompt: "What are my rights when arrested? Can I get bail?" },
  { label: "Property dispute", prompt: "How to resolve a property boundary dispute with my neighbour?" },
];

function ChatPageContent() {
  const searchParams = useSearchParams();
  const {
    messages, isStreaming, jurisdiction, setJurisdiction,
    practiceArea, setPracticeArea, sendMessage, clearMessages, stopStreaming,
  } = useChat();

  const [input, setInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pre-fill from URL
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      textareaRef.current?.focus();
    }
  }, [searchParams]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    await sendMessage(q);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStarter = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <AppLayout
      title="AI Legal Assistant"
      subtitle="Ask any legal question — jurisdiction-aware, multi-language, cited answers"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-ghost flex items-center gap-1.5 text-xs ${showFilters ? "text-gold" : ""}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="btn-ghost flex items-center gap-1.5 text-xs text-dim hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col h-full max-w-3xl mx-auto" style={{ height: "calc(100vh - 140px)" }}>
        {/* Filters panel */}
        {showFilters && (
          <div
            className="flex items-center gap-4 px-4 py-3 mb-4 rounded-xl animate-fade-in-down"
            style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}
          >
            <div className="flex-1">
              <label className="vk-label text-[11px]">State / Jurisdiction</label>
              <select
                className="vk-input text-xs py-1.5"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              >
                <option value="">All India</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="vk-label text-[11px]">Practice Area</label>
              <select
                className="vk-input text-xs py-1.5"
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
              >
                <option value="">All Areas</option>
                {PRACTICE_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto chat-scroll space-y-5 pb-4">
          {/* Advocate review CTA — appears after last AI message when not streaming */}
          {!isEmpty && !isStreaming && messages[messages.length - 1]?.role === "assistant" && (
            <div
              className="mx-auto max-w-xl rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in-down"
              style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.25)" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))" }}>
                <PhoneCall className="w-4 h-4 text-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--vk-gold-light)" }}>
                  Want an advocate to review this?
                </p>
                <p className="text-[11px]" style={{ color: "var(--vk-text-muted)" }}>
                  Book a verified lawyer for a second opinion or deeper advice.
                </p>
              </div>
              <Link href="/consultation">
                <button className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-all"
                  style={{ background: "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))", color: "var(--vk-navy)" }}>
                  Book Review <ChevronRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
          )}

          {isEmpty ? (
            <div className="flex flex-col items-center pt-12 pb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.2)" }}
              >
                <Scale className="w-7 h-7 text-gold" />
              </div>
              <h2 className="text-xl font-bold mb-2">How can I help you today?</h2>
              <p className="text-sm text-dim mb-8 text-center max-w-md">
                Ask me anything about Indian law — tenant rights, employment, criminal procedure,
                property, consumer protection, and more.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {STARTER_PROMPTS.map(({ label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => handleStarter(prompt)}
                    className="prompt-card text-xs text-left"
                  >
                    <p className="font-semibold text-gold-light mb-0.5">{label}</p>
                    <p className="text-dim leading-snug line-clamp-2">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <TypingIndicator />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 pt-3"
          style={{ borderTop: "1px solid var(--vk-border)" }}
        >
          <div
            className="flex items-end gap-2 p-2 rounded-xl"
            style={{ background: "var(--vk-navy-light)", border: "1px solid var(--vk-border)" }}
          >
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent text-sm resize-none outline-none px-2 py-2 max-h-32 min-h-[44px]"
              placeholder="Ask a legal question… (Shift+Enter for new line)"
              style={{ color: "var(--vk-text)" }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <div className="flex items-center gap-1.5 pb-1">
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
                  title="Stop"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-dim hover:text-muted hover:bg-white/5 transition-colors"
                    title="Voice input (coming soon)"
                    disabled
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: input.trim()
                        ? "linear-gradient(135deg, var(--vk-gold), var(--vk-gold-dark))"
                        : "rgba(255,255,255,0.06)",
                      color: input.trim() ? "var(--vk-navy)" : "var(--vk-text-dim)",
                    }}
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-center text-dim mt-2">
            VakilAI provides legal information, not legal advice. Always consult a qualified advocate.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageContent />
    </Suspense>
  );
}
