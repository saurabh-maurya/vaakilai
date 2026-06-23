import type { ChatMessage } from "@/types";
import { Scale, AlertCircle } from "lucide-react";
import { CitationChip } from "./CitationChip";
import { getConfidenceLevel, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuth();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5 animate-fade-in">
        <div className="chat-bubble-user">{message.content}</div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 self-end"
          style={{ background: "var(--vk-gold)", color: "var(--vk-navy)" }}
        >
          {user ? getInitials(user.name) : "U"}
        </div>
      </div>
    );
  }

  const confidenceLevel = message.confidence
    ? getConfidenceLevel(message.confidence)
    : null;

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* AI avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.2)" }}
      >
        <Scale className="w-3.5 h-3.5 text-gold" />
      </div>

      <div className="max-w-[80%] space-y-2">
        <div className="chat-bubble-ai whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 bg-gold align-middle animate-pulse" />
          )}
        </div>

        {/* Confidence */}
        {!message.isStreaming && message.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <div className="confidence-bar w-24">
              <div
                className={cn("confidence-fill", `confidence-${confidenceLevel}`)}
                style={{ width: `${Math.round(message.confidence * 100)}%` }}
              />
            </div>
            <span className="text-xs text-dim">
              {Math.round(message.confidence * 100)}% confidence
            </span>
          </div>
        )}

        {/* Citations */}
        {!message.isStreaming && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((c, i) => (
              <CitationChip key={c.id} citation={c} index={i} />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {!message.isStreaming && message.disclaimer && (
          <div className="vk-disclaimer text-[11px]">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              This is AI-generated legal information, not legal advice. Consult a
              qualified advocate before acting on this guidance.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
