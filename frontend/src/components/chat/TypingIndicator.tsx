import { Scale } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "var(--vk-gold-dim)", border: "1px solid rgba(201,168,76,0.2)" }}
      >
        <Scale className="w-3.5 h-3.5 text-gold" />
      </div>
      <div className="chat-bubble-ai flex items-center gap-1.5 py-3 px-4">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
