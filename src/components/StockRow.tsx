import type { StockMetric } from "@/lib/market.functions";

export function StockRow({ s, rank }: { s: StockMetric; rank: number }) {
  const up = s.changePercent >= 0;
  return (
    <div className="grid grid-cols-12 gap-2 items-center py-3 px-4 border-b border-border last:border-b-0 hover:bg-[color:var(--surface-2)]/50 transition-colors">
      <div className="col-span-1 text-sm font-bold text-[color:var(--primary)] tabular">
        #{rank}
      </div>
      <div className="col-span-4">
        <div className="font-medium text-sm">{s.name}</div>
        <div className="text-[11px] text-muted-foreground tabular">
          {s.symbol} · {s.market}
        </div>
      </div>
      <div className="col-span-2 text-right tabular text-sm">
        {s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div
        className="col-span-2 text-right tabular text-sm font-medium"
        style={{ color: up ? "var(--bull)" : "var(--bear)" }}
      >
        {s.changePercent >= 0 ? "+" : ""}
        {s.changePercent.toFixed(2)}%
      </div>
      <div className="col-span-1 text-right tabular text-xs text-muted-foreground">
        RSI {s.rsi14.toFixed(0)}
      </div>
      <div className="col-span-2 text-right">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[color:var(--primary)]/15 text-[color:var(--primary)] tabular">
          {s.score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
