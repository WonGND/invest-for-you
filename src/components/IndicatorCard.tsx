import { ArrowDown, ArrowUp } from "lucide-react";
import type { Quote } from "@/lib/market.functions";

export function IndicatorCard({ q }: { q: Quote }) {
  const up = q.changePercent >= 0;
  const isRate = q.category === "금리";
  // Yahoo returns 10Y as e.g. 42.5 meaning 4.25%
  const displayPrice = isRate
    ? (q.price / 1).toFixed(3) + "%"
    : q.price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <div className="rounded-lg bg-[color:var(--surface)] border border-border p-4 flex flex-col gap-1 hover:border-[color:var(--primary)]/50 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{q.name}</span>
        <span className="text-[10px] text-muted-foreground/70">{q.symbol}</span>
      </div>
      <div className="text-2xl font-semibold tabular tracking-tight mt-1">
        {displayPrice}
      </div>
      <div
        className="flex items-center gap-1 text-sm tabular font-medium"
        style={{ color: up ? "var(--bull)" : "var(--bear)" }}
      >
        {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        <span>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}</span>
        <span className="opacity-80">({q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%)</span>
      </div>
    </div>
  );
}
