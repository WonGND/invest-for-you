import { ExternalLink, Newspaper } from "lucide-react";
import type { MarketNewsItem } from "@/lib/market.functions";

function timeAgo(iso: string): string {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export function NewsList({
  items,
  loading,
  fetchedAt,
}: {
  items: MarketNewsItem[];
  loading: boolean;
  fetchedAt?: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[color:var(--primary)]" />
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            증시 주요 뉴스
          </h2>
        </div>
        {fetchedAt && (
          <span className="text-[11px] text-muted-foreground tabular">
            {new Date(fetchedAt).toLocaleTimeString("ko-KR")} 기준
          </span>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-[color:var(--surface)] border border-border animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 rounded-lg bg-[color:var(--surface)] border border-border">
          뉴스를 불러올 수 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((n, i) => (
            <a
              key={`${n.link}-${i}`}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg bg-[color:var(--surface)] border border-border p-4 flex flex-col gap-2 hover:border-[color:var(--primary)]/60 hover:bg-[color:var(--surface-2)] transition-all"
            >
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    n.category === "국내"
                      ? "bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                      : "bg-foreground/10 text-foreground/70"
                  }`}
                >
                  {n.category}
                </span>
                <span>{n.source}</span>
                <span className="ml-auto tabular normal-case">
                  {timeAgo(n.publishedAt)}
                </span>
              </div>
              <div className="text-sm font-medium leading-snug line-clamp-3 group-hover:text-[color:var(--primary)] transition-colors">
                {n.title}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-auto">
                <ExternalLink className="w-3 h-3" />
                <span>기사 보기</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
