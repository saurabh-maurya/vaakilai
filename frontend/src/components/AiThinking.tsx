"use client";

import { useEffect, useState } from "react";

// Status phases shown while we wait for an AI response. The later phases
// reassure the user during a cold start (the Render service can take 30-60s to
// wake), so a loading state never looks frozen.
const PHASES: { after: number; label: string }[] = [
  { after: 0, label: "Thinking…" },
  { after: 5, label: "Analyzing your request…" },
  { after: 12, label: "Reviewing legal sources…" },
  { after: 22, label: "Warming up the server, almost there…" },
  { after: 40, label: "Still working — this is taking longer than usual…" },
];

/** Evolving status label based on how long we've been waiting. */
export function useThinkingStatus(): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return [...PHASES].reverse().find((p) => elapsed >= p.after)?.label ?? PHASES[0].label;
}

/** Inline "AI is working" row: animated dots + evolving status text. */
export function AiThinking({ className = "" }: { className?: string }) {
  const label = useThinkingStatus();
  return (
    <div className={`flex items-center gap-2 text-sm text-dim ${className}`}>
      <div className="flex items-center gap-1.5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span>{label}</span>
    </div>
  );
}
