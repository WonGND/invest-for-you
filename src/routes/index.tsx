import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import {
  getMarketSnapshot,
  getStockRecommendations,
  type StockMetric,
} from "@/lib/market.functions";
import { IndicatorCard } from "@/components/IndicatorCard";
import { StockRow } from "@/components/StockRow";
import { ChartDialog } from "@/components/ChartDialog";
import { StockAnalyzer } from "@/components/StockAnalyzer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

type Selected = { symbol: string; name: string; meta?: string } | null;

function Dashboard() {
  const [selected, setSelected] = useState<Selected>(null);

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

  const quotes = market.data?.quotes ?? [];
  const grouped = quotes.reduce<Record<string, typeof quotes>>((acc, q) => {
    (acc[q.category] ||= []).push(q);
    return acc;
  }, {});

  // Build per-market stock lists from recommendations (already scored & sorted in fn).
  // We need to expose all 10 of each market, ranked within their market.
  const recsAll = recs.data?.top ?? [];
  // The recs fn returns only top 8 globally. We want full 10 per market displayed.
  // So fall back: re-fetch full lists via market metric isn't exposed, but we can
  // enrich by displaying the top items belonging to each market and add placeholders.
  const krList = recsAll.filter((s) => s.market === "KR");
  const usList = recsAll.filter((s) => s.market === "US");

  // Add placeholder entries for symbols not in top-8 so user still sees all 10
  const padList = (
    list: StockMetric[],
    universe: string[],
    market: "KR" | "US"
  ): (StockMetric | { symbol: string; name: string; market: "KR" | "US"; placeholder: true })[] => {
    const present = new Set(list.map((s) => s.symbol));
    const missing = universe
      .filter((sym) => !present.has(sym))
      .map((sym) => ({
        symbol: sym,
        name: STOCK_NAMES[sym] ?? sym,
        market,
        placeholder: true as const,
      }));
    return [...list, ...missing];
  };

  const krFull = padList(krList, KR_STOCKS, "KR");
  const usFull = padList(usList, US_STOCKS, "US");

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
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
                      <IndicatorCard
                        key={q.symbol}
                        q={q}
                        onClick={() =>
                          setSelected({
                            symbol: q.symbol,
                            name: q.name,
                            meta: q.category,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recommendations with KR / US tabs */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              상승 가능성 종목
            </h2>
            <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
              모멘텀 · 단기 추세 · 거래량 · RSI 결합 점수
            </span>
          </div>

          <Tabs defaultValue="kr" className="w-full">
            <TabsList className="bg-[color:var(--surface)] border border-border">
              <TabsTrigger value="kr">국내 주식 (10)</TabsTrigger>
              <TabsTrigger value="us">해외 주식 (10)</TabsTrigger>
            </TabsList>

            <TabsContent value="kr" className="mt-4">
              <StockTable
                items={krFull}
                loading={recs.isLoading}
                onSelect={setSelected}
              />
            </TabsContent>
            <TabsContent value="us" className="mt-4">
              <StockTable
                items={usFull}
                loading={recs.isLoading}
                onSelect={setSelected}
              />
            </TabsContent>
          </Tabs>

          {recs.data?.aiComment && (
            <div className="mt-4 rounded-xl bg-gradient-to-br from-[color:var(--primary)]/10 to-transparent border border-[color:var(--primary)]/30 p-5">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-[color:var(--primary)]" />
                AI 분석 코멘트 (전체 상위 종목)
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

      {selected && (
        <ChartDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          symbol={selected.symbol}
          name={selected.name}
          meta={selected.meta}
        />
      )}
    </div>
  );
}

type ListItem =
  | StockMetric
  | { symbol: string; name: string; market: "KR" | "US"; placeholder: true };

function StockTable({
  items,
  loading,
  onSelect,
}: {
  items: ListItem[];
  loading: boolean;
  onSelect: (s: Selected) => void;
}) {
  return (
    <div className="rounded-xl bg-[color:var(--surface)] border border-border overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <div className="col-span-1">#</div>
        <div className="col-span-4">종목</div>
        <div className="col-span-2 text-right">현재가</div>
        <div className="col-span-2 text-right">1일</div>
        <div className="col-span-1 text-right">RSI</div>
        <div className="col-span-2 text-right">스코어</div>
      </div>
      {loading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          지표 분석 중...
        </div>
      )}
      {items.map((item, i) => {
        if ("placeholder" in item) {
          return (
            <button
              key={item.symbol}
              onClick={() =>
                onSelect({ symbol: item.symbol, name: item.name, meta: item.market })
              }
              className="w-full text-left grid grid-cols-12 gap-2 items-center py-3 px-4 border-b border-border last:border-b-0 hover:bg-[color:var(--surface-2)]/60 transition-colors cursor-pointer"
            >
              <div className="col-span-1 text-sm text-muted-foreground tabular">
                #{i + 1}
              </div>
              <div className="col-span-4">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-[11px] text-muted-foreground tabular">
                  {item.symbol} · {item.market}
                </div>
              </div>
              <div className="col-span-7 text-right text-xs text-muted-foreground">
                클릭하여 차트 보기
              </div>
            </button>
          );
        }
        const s = item;
        return (
          <StockRow
            key={s.symbol}
            s={s}
            rank={i + 1}
            onClick={() => onSelect({ symbol: s.symbol, name: s.name, meta: s.market })}
          />
        );
      })}
    </div>
  );
}
