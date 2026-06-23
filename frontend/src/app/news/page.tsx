"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Newspaper, Search, ExternalLink, RefreshCw } from "lucide-react";
import { backendApi } from "@/lib/api";

interface Article {
  id: string;
  title: string;
  source: string;
  category: string;
  published_at: string;
  url: string;
  summary: string;
  tags: string[];
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "general", label: "General" },
  { key: "constitutional", label: "Constitutional" },
  { key: "corporate", label: "Corporate" },
  { key: "criminal", label: "Criminal" },
  { key: "consumer", label: "Consumer" },
  { key: "technology", label: "Technology" },
  { key: "legislation", label: "Legislation" },
];

const SOURCE_COLORS: Record<string, string> = {
  "Bar & Bench": "#60a5fa",
  "LiveLaw":     "#4ade80",
  "SCC Online":  "var(--vk-gold)",
};

function ArticleCard({ article }: { article: Article }) {
  const sourceColor = SOURCE_COLORS[article.source] ?? "var(--vk-gold)";
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="vk-card vk-card-hover p-4 space-y-2 block"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sourceColor }}>
          {article.source}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {article.category && (
            <span className="vk-badge vk-badge-muted text-[10px]">{article.category}</span>
          )}
          <ExternalLink className="w-3 h-3 text-dim" />
        </div>
      </div>
      <p className="text-sm font-semibold leading-snug" style={{ color: "var(--vk-text)" }}>
        {article.title}
      </p>
      {article.summary && (
        <p className="text-xs leading-relaxed text-dim line-clamp-2">{article.summary}</p>
      )}
      {article.published_at && (
        <p className="text-[10px] text-dim">{article.published_at}</p>
      )}
    </a>
  );
}

export default function LegalNewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.get("/news/", {
        params: { category: activeCategory, q: searchQuery || undefined, limit: 30 },
      });
      setArticles(data.articles ?? []);
      setCachedAt(data.cached);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <AppLayout title="Legal News" subtitle="Latest updates from Bar & Bench, LiveLaw, and SCC Online">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Search + filter */}
        <div className="vk-card p-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
              <input
                className="vk-input w-full pl-8"
                placeholder="Search legal news..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchNews()}
              />
            </div>
            <button
              className="btn-secondary px-4 flex items-center gap-2 text-sm"
              onClick={fetchNews}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className={`text-xs py-1.5 px-3 rounded-md font-semibold transition-colors ${activeCategory === cat.key ? "text-navy" : "text-dim"}`}
                style={activeCategory === cat.key ? { background: "var(--vk-gold)" } : { background: "rgba(255,255,255,0.05)" }}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {cachedAt && (
            <p className="text-[10px] text-dim">Last updated: {new Date(cachedAt).toLocaleTimeString()}</p>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="vk-skeleton h-32 rounded-xl" />)}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="vk-card p-8 text-center space-y-2">
            <Newspaper className="w-8 h-8 mx-auto text-dim" />
            <p className="text-sm font-semibold" style={{ color: "var(--vk-text)" }}>No articles found</p>
            <p className="text-xs text-dim">Try a different category or refresh</p>
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
