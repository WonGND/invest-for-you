import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Info, LogIn } from "lucide-react";
import { Search, Sparkles, ExternalLink, Target, ShieldAlert, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  analyzeStock,
  searchStockDirectory,
  type StockAnalysis,
  type DirectoryEntry,
} from "@/lib/market.functions";

const ACTION_COLORS: Record<string, string> = {
  매수: "var(--bull)",
  보유: "var(--primary)",
  관망: "var(--muted-foreground)",
  매도: "var(--bear)",
};

export function StockAnalyzer() {
  const [input, setInput] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const wrapRef = useRef<HTMLFormElement>(null);

  const suggestions: DirectoryEntry[] = useMemo(
    () => (input.trim() ? searchStockDirectory(input, 8) : []),
    [input]
  );

  // Close suggestions on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const mut = useMutation({
    mutationFn: (symbol: string) => analyzeStock({ data: { symbol } }),
    onSuccess: () => setCollapsed(false),
  });

  const submit = (override?: string) => {
    const s = (override ?? input).trim();
    if (!s) return;
    setShowSuggest(false);
    mut.mutate(s);
  };

  const pickSuggestion = (d: DirectoryEntry) => {
    setInput(d.name);
    setShowSuggest(false);
    mut.mutate(d.symbol);
  };

  const data: StockAnalysis | undefined = mut.data;

  return (
    <div className="rounded-xl bg-[color:var(--surface)] border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[color:var(--primary)]" />
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          종목 분석 & AI 매매 의견
        </h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2 relative"
        ref={wrapRef}
      >
        <div className="flex-1 relative">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            placeholder="종목명 또는 코드 (예: 삼성전자, SK하이닉스, AAPL, 005930)"
            className="bg-[color:var(--surface-2)] border-border"
            autoComplete="off"
          />
          {showSuggest && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-20 max-h-72 overflow-auto rounded-md bg-[color:var(--surface-2)] border border-border shadow-lg">
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[color:var(--surface)] transition-colors"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        s.market === "KR"
                          ? "bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                          : "bg-foreground/10 text-foreground/70"
                      }`}
                    >
                      {s.market}
                    </span>
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular ml-auto">
                      {s.symbol}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
        >
          {mut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          분석
        </button>
      </form>


      {mut.isPending && (
        <div className="text-sm text-muted-foreground py-6 text-center">
          뉴스와 지표를 수집하고 AI가 분석 중입니다...
        </div>
      )}

      {data?.error && (
        <div className="text-sm text-[color:var(--bear)] bg-[color:var(--bear)]/10 border border-[color:var(--bear)]/30 rounded-md p-3">
          {data.error}
        </div>
      )}

      {data && !data.error && (
        <div className="space-y-4">
          {/* Header with price */}
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="text-base font-semibold">{data.name}</div>
              <div className="text-[11px] text-muted-foreground tabular">
                {data.symbol} {data.currency ? `· ${data.currency}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular">
                {data.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              {data.changePercent != null && (
                <div
                  className="text-sm tabular font-medium"
                  style={{
                    color:
                      data.changePercent >= 0 ? "var(--bull)" : "var(--bear)",
                  }}
                >
                  {data.changePercent >= 0 ? "+" : ""}
                  {data.changePercent.toFixed(2)}% (1일)
                </div>
              )}
            </div>
          </div>

          {!collapsed && (<>

          {/* Metric strip */}
          {data.metric && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Metric label="5일" value={`${data.metric.changePercent5d.toFixed(2)}%`} bull={data.metric.changePercent5d >= 0} />
              <Metric label="20일" value={`${data.metric.changePercent20d.toFixed(2)}%`} bull={data.metric.changePercent20d >= 0} />
              <Metric label="RSI14" value={data.metric.rsi14.toFixed(0)} />
              <Metric label="거래량비" value={`${data.metric.volumeRatio.toFixed(2)}x`} />
            </div>
          )}

          {/* AI Recommendation */}
          {data.recommendation && (
            <div className="rounded-lg border border-[color:var(--primary)]/30 bg-gradient-to-br from-[color:var(--primary)]/10 to-transparent p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1 rounded-md text-sm font-bold"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${ACTION_COLORS[data.recommendation.action] ?? "var(--primary)"} 20%, transparent)`,
                      color: ACTION_COLORS[data.recommendation.action] ?? "var(--primary)",
                    }}
                  >
                    {data.recommendation.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    확신도 {data.recommendation.confidence} · {data.recommendation.horizon}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-[color:var(--surface-2)] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                    <LogIn className="w-3 h-3" /> 추천 진입가
                    {data.recommendation.entryPrice != null && data.price != null && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        현재가 대비 {(((data.recommendation.entryPrice - data.price) / data.price) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold tabular">
                    {data.recommendation.entryPrice != null
                      ? data.recommendation.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
                <div className="rounded-md bg-[color:var(--surface-2)] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                    <Target className="w-3 h-3" /> 목표가 (수익 실현)
                    {data.recommendation.expectedReturn != null && (
                      <span className="ml-auto text-[10px] font-semibold" style={{ color: "var(--bull)" }}>
                        +{data.recommendation.expectedReturn.toFixed(1)}% 이익
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold tabular" style={{ color: "var(--bull)" }}>
                    {data.recommendation.targetPrice != null
                      ? data.recommendation.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
                <div className="rounded-md bg-[color:var(--surface-2)] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                    <ShieldAlert className="w-3 h-3" /> 손절가 (손실 제한)
                    {data.recommendation.stopLossPercent != null && (
                      <span className="ml-auto text-[10px] font-semibold" style={{ color: "var(--bear)" }}>
                        {data.recommendation.stopLossPercent.toFixed(1)}% 손실
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-semibold tabular" style={{ color: "var(--bear)" }}>
                    {data.recommendation.stopLoss != null
                      ? data.recommendation.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
              </div>

              {data.recommendation.riskReward != null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  손익비 (Risk/Reward) {data.recommendation.riskReward.toFixed(2)} : 1
                  {data.recommendation.riskReward >= 2 ? " — 양호" : data.recommendation.riskReward >= 1 ? " — 보통" : " — 불리"}
                  {data.recommendation.autoAdjusted && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-[color:var(--surface-2)]">
                      가격 자동보정됨
                    </span>
                  )}
                </div>
              )}

              <div className="text-sm leading-6">
                <div className="font-medium mb-1">분석 근거</div>
                <p className="text-foreground/90">{data.recommendation.rationale}</p>
              </div>
              <div className="text-sm leading-6">
                <div className="font-medium mb-1">⚠️ 리스크</div>
                <p className="text-muted-foreground">{data.recommendation.risks}</p>
              </div>

              {data.recommendation.keyPoints && data.recommendation.keyPoints.length > 0 && (
                <div className="rounded-md bg-[color:var(--surface-2)]/60 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                    <CheckCircle2 className="w-4 h-4 text-[color:var(--bull)]" />
                    초보자를 위한 체크리스트
                  </div>
                  <ul className="space-y-1.5">
                    {data.recommendation.keyPoints.map((p, i) => (
                      <li key={i} className="text-sm leading-snug flex gap-2">
                        <span className="text-[color:var(--primary)] shrink-0">•</span>
                        <span className="text-foreground/90">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.recommendation.glossary && data.recommendation.glossary.length > 0 && (
                <div className="rounded-md bg-[color:var(--surface-2)]/60 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                    <BookOpen className="w-4 h-4 text-[color:var(--primary)]" />
                    용어 풀이
                  </div>
                  <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {data.recommendation.glossary.map((g, i) => (
                      <div key={i} className="leading-snug">
                        <dt className="inline font-semibold text-foreground">{g.term}</dt>
                        <dd className="inline text-muted-foreground"> — {g.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}

          {data.rawAi && !data.recommendation && (
            <pre className="whitespace-pre-wrap text-xs bg-[color:var(--surface-2)] p-3 rounded-md">
              {data.rawAi}
            </pre>
          )}

          {/* News */}
          {data.news.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                관련 뉴스
              </div>
              <ul className="space-y-2">
                {data.news.map((n, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 hover:text-[color:var(--primary)] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 opacity-60 group-hover:opacity-100" />
                      <span className="flex-1">
                        <span className="block leading-snug">{n.title}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {n.publisher}
                          {n.publishedAt
                            ? ` · ${new Date(n.publishedAt).toLocaleDateString("ko-KR")}`
                            : ""}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          </>)}

          <div className="flex items-center justify-center pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[color:var(--surface-2)] hover:bg-[color:var(--surface)] border border-border transition-colors"
            >
              {collapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> 분석 내용 펼치기
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> 분석 내용 접기
                </>
              )}
            </button>
          </div>

          {!collapsed && (
            <p className="text-[11px] text-muted-foreground">
              ⚠️ 본 분석은 정보 제공 목적이며 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, bull }: { label: string; value: string; bull?: boolean }) {
  return (
    <div className="rounded-md bg-[color:var(--surface-2)] px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div
        className="text-sm font-semibold tabular"
        style={
          bull === undefined
            ? undefined
            : { color: bull ? "var(--bull)" : "var(--bear)" }
        }
      >
        {value}
      </div>
    </div>
  );
}
