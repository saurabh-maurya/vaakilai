import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders AI-generated markdown text with VakilAI theming.
 * Used across chat, research memos, notices, filings and generated documents.
 * `remark-breaks` keeps single newlines (important for letter-style content).
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("vk-markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {children ?? ""}
      </ReactMarkdown>
    </div>
  );
}
