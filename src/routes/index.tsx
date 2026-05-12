import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import {
  getMarketSnapshot,
  getStockRecommendations,
} from "@/lib/market.functions";
import { IndicatorCard } from "@/components/IndicatorCard";
import { StockRow } from "@/components/StockRow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Market Pulse — 실시간 경제지표 & AI 종목 추천" },
      {
        name: "description",
        content:
          "실시간 미국·한국 시장 지수, 금리, 환율, 원자재를 한눈에. 모멘텀·RSI·거래량 기반 점수와 AI 분석으로 상승 가능성 높은 종목을 추천합니다.",
      },
      { property: "og:title", content: "Market Pulse — 실시간 경제지표 & AI 종목 추천" },
      {
        property: "og:description",
        content: "지표 기반 점수 + AI 코멘트로 상승 가능성 종목을 발굴합니다.",
      },
    ],
  }),
  component: Dashboard,
});

const CATEGORY_ORDER = ["지수", "금리", "환율", "원자재"];

function Dashboard() {
  const market = useQuery({
    queryKey: ["market"],
    queryFn: () => getMarketSnapshot(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const recs = useQuery({
    queryKey: ["recs"],
    queryFn: () => getStockRecommendations(),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });

  const grouped = (market.data?.quotes ?? []).reduce<
    Record<string, typeof market.data.quotes>
  >((acc, q) => {
    (acc[q.category] ||= []).push(q);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-10 bg-background/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[color:var(--primary)]" />
            <h1 className="text-lg font-semibold tracking-tight">Market Pulse</h1>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              실시간 경제지표 & AI 종목 추천
            </span>
          </div>
          <button
            onClick={() => {
              market.refetch();
              recs.refetch();
            }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[color:var(--surface)] border border-border hover:border-[color:var(--primary)]/60 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${market.isFetching ? "animate-spin" : ""}`}
            />
            새로고침
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {/* Indicators */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              실시간 경제지표
            </h2>
            {market.data?.fetchedAt && (
              <span className="text-[11px] text-muted-foreground tabular">
                {new Date(market.data.fetchedAt).toLocaleTimeString("ko-KR")} 기준
              </span>
            )}
          </div>

          {market.isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg bg-[color:var(--surface)] border border-border animate-pulse"
                />
              ))}
            </div>
          )}

          {market.error && (
            <div className="text-sm text-[color:var(--bear)]">
              데이터를 불러오지 못했습니다.
            </div>
          )}

          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">
                    {cat}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map((q) => (
                      <IndicatorCard key={q.symbol} q={q} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recommendations */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              상승 가능성 상위 종목
            </h2>
            <span className="text-[11px] text-muted-foreground ml-auto">
              모멘텀(20d) · 단기(5d) · 거래량 · RSI 결합 점수
            </span>
          </div>

          <div className="rounded-xl bg-[color:var(--surface)] border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
              <div className="col-span-1">#</div>
              <div className="col-span-4">종목</div>
              <div className="col-span-2 text-right">현재가</div>
              <div className="col-span-2 text-right">1일</div>
              <div className="col-span-1 text-right">RSI</div>
              <div className="col-span-2 text-right">스코어</div>
            </div>

            {recs.isLoading && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                지표 분석 중...
              </div>
            )}
            {recs.data?.top.map((s, i) => (
              <StockRow key={s.symbol} s={s} rank={i + 1} />
            ))}
          </div>

          {recs.data?.aiComment && (
            <div className="mt-4 rounded-xl bg-gradient-to-br from-[color:var(--primary)]/10 to-transparent border border-[color:var(--primary)]/30 p-5">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-[color:var(--primary)]" />
                AI 분석 코멘트
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground/90 font-sans">
                {recs.data.aiComment}
              </pre>
            </div>
          )}
        </section>

        <footer className="text-center text-[11px] text-muted-foreground pt-6 pb-4 border-t border-border/60">
          데이터: Yahoo Finance · 본 사이트는 정보 제공 목적이며 투자 권유가 아닙니다.
        </footer>
      </main>
    </div>
  );
}
