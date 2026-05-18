import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { getTopTradedStocks, type TradedStock } from "@/lib/market.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function formatTradedValue(v: number, market: "US" | "KR"): string {
  if (market === "KR") {
    // KRW — show in 억/조
    if (v >= 1e12) return `${(v / 1e12).toFixed(2)}조원`;
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억원`;
    return `${Math.round(v).toLocaleString()}원`;
  }
  // USD — show in M/B
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

function Row({
  s,
  rank,
  onClick,
}: {
  s: TradedStock;
  rank: number;
  onClick: () => void;
}) {
  const up = s.changePercent >= 0;
  return (
    <button
      onClick={onClick}
      className="w-full grid grid-cols-12 gap-2 px-4 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-[color:var(--surface-2)] transition-colors text-left"
    >
      <div className="col-span-1 text-muted-foreground tabular">{rank}</div>
      <div className="col-span-5 truncate">
        <div className="font-medium truncate">{s.name}</div>
        <div className="text-[11px] text-muted-foreground tabular">{s.symbol}</div>
      </div>
      <div className="col-span-2 text-right tabular">
        {s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div
        className="col-span-2 text-right tabular font-medium"
        style={{ color: up ? "var(--bull)" : "var(--bear)" }}
      >
        {up ? "+" : ""}
        {s.changePercent.toFixed(2)}%
      </div>
      <div className="col-span-2 text-right tabular text-muted-foreground">
        {formatTradedValue(s.tradedValue, s.market)}
      </div>
    </button>
  );
}

function Table({
  items,
  loading,
  onSelect,
}: {
  items: TradedStock[];
  loading: boolean;
  onSelect: (s: TradedStock) => void;
}) {
  return (
    <div className="rounded-xl bg-[color:var(--surface)] border border-border overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
        <div className="col-span-1">#</div>
        <div className="col-span-5">종목</div>
        <div className="col-span-2 text-right">현재가</div>
        <div className="col-span-2 text-right">1일</div>
        <div className="col-span-2 text-right">거래대금</div>
      </div>
      {loading && items.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          거래대금 집계 중...
        </div>
      )}
      {items.map((s, i) => (
        <Row key={s.symbol} s={s} rank={i + 1} onClick={() => onSelect(s)} />
      ))}
    </div>
  );
}

export function TopTradedStocks({
  onSelect,
}: {
  onSelect: (s: { symbol: string; name: string; meta?: string }) => void;
}) {
  const q = useQuery({
    queryKey: ["top-traded"],
    queryFn: () => getTopTradedStocks(),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-[color:var(--primary)]" />
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          거래대금 상위 종목
        </h2>
        <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
          최근 5거래일 평균 거래대금 기준
        </span>
      </div>

      <Tabs defaultValue="kr" className="w-full">
        <TabsList className="bg-[color:var(--surface)] border border-border">
          <TabsTrigger value="kr">국내 (10)</TabsTrigger>
          <TabsTrigger value="us">해외 (10)</TabsTrigger>
        </TabsList>
        <TabsContent value="kr" className="mt-4">
          <Table
            items={q.data?.kr ?? []}
            loading={q.isLoading}
            onSelect={(s) => onSelect({ symbol: s.symbol, name: s.name, meta: "KR" })}
          />
        </TabsContent>
        <TabsContent value="us" className="mt-4">
          <Table
            items={q.data?.us ?? []}
            loading={q.isLoading}
            onSelect={(s) => onSelect({ symbol: s.symbol, name: s.name, meta: "US" })}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
