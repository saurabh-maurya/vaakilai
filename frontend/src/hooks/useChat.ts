"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, Citation } from "@/types";
import { generateId } from "@/lib/utils";

const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [practiceArea, setPracticeArea] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const aiMsgId = generateId();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let fullContent = "";

      try {
        const params = new URLSearchParams({ query });
        if (jurisdiction) params.set("jurisdiction", jurisdiction);
        if (practiceArea) params.set("practice_area", practiceArea);

        // credentials: "include" sends the httpOnly session cookie automatically
        // No token is passed in headers or URL params to avoid exposure in logs
        const response = await fetch(
          `${AI_URL}/ai/consult/stream?${params.toString()}`,
          {
            headers: { Accept: "text/event-stream" },
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let citations: Citation[] = [];
        let confidence = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const chunk = JSON.parse(raw);
              if (chunk.type === "content") {
                fullContent += chunk.data as string;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: fullContent, isStreaming: true }
                      : m
                  )
                );
              } else if (chunk.type === "citations") {
                citations = chunk.data as Citation[];
              } else if (chunk.type === "confidence") {
                confidence = chunk.data as number;
              } else if (chunk.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? {
                          ...m,
                          content: fullContent,
                          citations,
                          confidence,
                          isStreaming: false,
                          disclaimer: true,
                        }
                      : m
                  )
                );
                setIsStreaming(false);
                return;
              } else if (chunk.type === "error") {
                throw new Error(chunk.data as string);
              }
            } catch {
              // ignore parse errors mid-stream
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, isStreaming: false } : m
          )
        );
        setIsStreaming(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content:
                    fullContent ||
                    "I encountered an error. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
        setIsStreaming(false);
      }
    },
    [isStreaming, jurisdiction, practiceArea]
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  return {
    messages,
    isStreaming,
    jurisdiction,
    setJurisdiction,
    practiceArea,
    setPracticeArea,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}
