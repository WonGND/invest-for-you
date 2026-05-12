import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getChartHistory, type ChartRange } from "@/lib/market.functions";

const RANGES: { key: ChartRange; label: string }[] = [
  { key: "1d", label: "1일" },
  { key: "1w", label: "1주" },
  { key: "1mo", label: "1달" },
  { key: "1y", label: "1년" },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  symbol: string;
  name: string;
  meta?: string;
};

export function ChartDialog({ open, onOpenChange, symbol, name, meta }: Props) {
  const [range, setRange] = useState<ChartRange>("1mo");

  const { data, isLoading } = useQuery({
    queryKey: ["chart", symbol, range],
    queryFn: () => getChartHistory({ data: { symbol, range } }),
    enabled: open,
    staleTime: 60_000,
  });

  const points = data?.points ?? [];
  const first = points[0]?.c;
  const last = points[points.length - 1]?.c;
  const change = first && last ? ((last - first) / first) * 100 : 0;
  const up = change >= 0;
  const lineColor = up ? "var(--bull)" : "var(--bear)";

  const fmtX = (t: number) => {
    const d = new Date(t);
    if (range === "1d") {
      return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    }
    if (range === "1w") {
      return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
    }
    if (range === "1mo") {
      return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
    }
    return d.toLocaleDateString("ko-KR", { year: "2-digit", month: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[color:var(--surface)] border-border">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-base">{name}</span>
            <span className="text-[11px] font-normal text-muted-foreground tabular">
              {symbol} {meta ? `· ${meta}` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col">
            <div className="text-3xl font-semibold tabular">
              {last != null
                ? last.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : "—"}
            </div>
            <div
              className="text-sm tabular font-medium"
              style={{ color: lineColor }}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}% · {RANGES.find((r) => r.key === range)?.label}
            </div>
          </div>
          <div className="flex gap-1 bg-[color:var(--surface-2)] p-1 rounded-md">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  range === r.key
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 mt-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              차트 불러오는 중...
            </div>
          ) : points.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={fmtX}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  minTickGap={40}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    typeof v === "number"
                      ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : v
                  }
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(t) => fmtX(t as number)}
                  formatter={(v) => [
                    typeof v === "number"
                      ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : v,
                    "가격",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="c"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
