"use client";

import { useThinkingStatus } from "@/components/AiThinking";

export function ThinkingBubble() {
  const label = useThinkingStatus();

  return (
    <div className="chat-bubble-ai flex items-center gap-2 py-3 px-4">
      <div className="flex items-center gap-1.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span className="text-xs text-dim">{label}</span>
    </div>
  );
}
