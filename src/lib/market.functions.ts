import { createServerFn } from "@tanstack/react-start";

// Yahoo Finance quote endpoint (no auth required)
const YF_QUOTE = "https://query1.finance.yahoo.com/v7/finance/quote";
const YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency?: string;
  category: string;
};

const SYMBOL_MAP: Record<string, { name: string; category: string }> = {
  // Indices
  "^GSPC": { name: "S&P 500", category: "지수" },
  "^IXIC": { name: "NASDAQ", category: "지수" },
  "^DJI": { name: "Dow Jones", category: "지수" },
  "^KS11": { name: "KOSPI", category: "지수" },
  "^KQ11": { name: "KOSDAQ", category: "지수" },
  // Rates / bonds
  "^TNX": { name: "미국 10년물 국채", category: "금리" },
  "^FVX": { name: "미국 5년물 국채", category: "금리" },
  "^TYX": { name: "미국 30년물 국채", category: "금리" },
  // FX
  "KRW=X": { name: "USD/KRW", category: "환율" },
  "EURUSD=X": { name: "EUR/USD", category: "환율" },
  "JPY=X": { name: "USD/JPY", category: "환율" },
  "DX-Y.NYB": { name: "달러인덱스 (DXY)", category: "환율" },
  // Commodities
  "CL=F": { name: "WTI 원유", category: "원자재" },
  "GC=F": { name: "금", category: "원자재" },
  "SI=F": { name: "은", category: "원자재" },
  "HG=F": { name: "구리", category: "원자재" },
};

const ALL_SYMBOLS = Object.keys(SYMBOL_MAP);

async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  // Yahoo's batch quote endpoint sometimes blocks; fall back to chart per symbol
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const r = await fetch(
          `${YF_CHART}/${encodeURIComponent(sym)}?interval=1d&range=5d`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; MarketPulse/1.0)",
              Accept: "application/json",
            },
          }
        );
        if (!r.ok) return null;
        const json: any = await r.json();
        const result = json?.chart?.result?.[0];
        if (!result) return null;
        const meta = result.meta;
        const price = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose ?? meta.previousClose;
        if (price == null || prev == null) return null;
        const change = price - prev;
        const changePercent = (change / prev) * 100;
        const info = SYMBOL_MAP[sym] ?? { name: sym, category: "기타" };
        return {
          symbol: sym,
          name: info.name,
          category: info.category,
          price,
          change,
          changePercent,
          currency: meta.currency,
        } as Quote;
      } catch {
        return null;
      }
    })
  );
  return results.filter((q): q is Quote => q !== null);
}

export const getMarketSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    const quotes = await fetchQuotes(ALL_SYMBOLS);
    return { quotes, fetchedAt: new Date().toISOString() };
  }
);

// Stock universe for recommendations (10 each)
export const US_STOCKS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
  "META", "TSLA", "AVGO", "AMD", "NFLX",
];
export const KR_STOCKS = [
  "005930.KS", "000660.KS", "035420.KS", "035720.KS", "005380.KS",
  "051910.KS", "006400.KS", "207940.KS", "068270.KS", "247540.KQ",
];

export const STOCK_NAMES: Record<string, string> = {
  "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
  "NVDA": "NVIDIA", "META": "Meta", "TSLA": "Tesla", "AVGO": "Broadcom",
  "AMD": "AMD", "NFLX": "Netflix",
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "035420.KS": "NAVER",
  "035720.KS": "카카오", "005380.KS": "현대차", "051910.KS": "LG화학",
  "006400.KS": "삼성SDI", "207940.KS": "삼성바이오로직스",
  "068270.KS": "셀트리온", "247540.KQ": "에코프로비엠",
};

export type StockMetric = {
  symbol: string;
  name: string;
  market: "US" | "KR";
  price: number;
  changePercent: number; // 1-day
  changePercent5d: number;
  changePercent20d: number;
  volumeRatio: number; // recent vs avg
  rsi14: number;
  score: number;
};

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

async function fetchStockMetric(
  sym: string,
  market: "US" | "KR"
): Promise<StockMetric | null> {
  try {
    const r = await fetch(
      `${YF_CHART}/${encodeURIComponent(sym)}?interval=1d&range=3mo`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
          Accept: "application/json",
        },
      }
    );
    if (!r.ok) return null;
    const json: any = await r.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const closes: number[] = (result.indicators.quote[0].close || []).filter(
      (v: number | null) => v != null
    ) as number[];
    const volumes: number[] = (result.indicators.quote[0].volume || []).filter(
      (v: number | null) => v != null
    ) as number[];
    if (closes.length < 25) return null;
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const ago5 = closes[closes.length - 6];
    const ago20 = closes[closes.length - 21];
    const change1 = ((last - prev) / prev) * 100;
    const change5 = ((last - ago5) / ago5) * 100;
    const change20 = ((last - ago20) / ago20) * 100;
    const recentVol =
      volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const avgVol =
      volumes.slice(-30, -5).reduce((a, b) => a + b, 0) /
      Math.max(1, volumes.slice(-30, -5).length);
    const volumeRatio = avgVol > 0 ? recentVol / avgVol : 1;
    const rsi = computeRSI(closes);

    return {
      symbol: sym,
      name: STOCK_NAMES[sym] ?? sym,
      market,
      price: last,
      changePercent: change1,
      changePercent5d: change5,
      changePercent20d: change20,
      volumeRatio,
      rsi14: rsi,
      score: 0,
    };
  } catch {
    return null;
  }
}

function scoreStock(s: StockMetric): number {
  // Simple rule-based score:
  // momentum (20d trend), short-term confirmation (5d), volume surge,
  // RSI sweet spot 50-65 (bullish but not overbought)
  const momentum = Math.max(-15, Math.min(20, s.changePercent20d));
  const shortTerm = Math.max(-8, Math.min(10, s.changePercent5d));
  const volBoost = Math.max(0, Math.min(2, s.volumeRatio - 1)) * 8;
  const rsiBand =
    s.rsi14 >= 50 && s.rsi14 <= 65
      ? 10
      : s.rsi14 > 65 && s.rsi14 <= 75
      ? 4
      : s.rsi14 > 75
      ? -8
      : s.rsi14 < 35
      ? 6 // potential rebound
      : 0;
  return momentum * 1.2 + shortTerm * 1.5 + volBoost + rsiBand;
}

export const getStockRecommendations = createServerFn({
  method: "GET",
}).handler(async () => {
  const [us, kr] = await Promise.all([
    Promise.all(US_STOCKS.map((s) => fetchStockMetric(s, "US"))),
    Promise.all(KR_STOCKS.map((s) => fetchStockMetric(s, "KR"))),
  ]);
  const all = [...us, ...kr].filter((s): s is StockMetric => s !== null);
  const scored = all.map((s) => ({ ...s, score: scoreStock(s) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 8);

  // AI commentary via Lovable AI Gateway
  let aiComment = "";
  const apiKey = process.env.LOVABLE_API_KEY;
  if (apiKey && top.length > 0) {
    try {
      const summary = top
        .map(
          (s, i) =>
            `${i + 1}. ${s.name}(${s.symbol}) ${s.market} | 1일 ${s.changePercent.toFixed(2)}% | 5일 ${s.changePercent5d.toFixed(2)}% | 20일 ${s.changePercent20d.toFixed(2)}% | RSI ${s.rsi14.toFixed(0)} | 거래량비 ${s.volumeRatio.toFixed(2)}x`
        )
        .join("\n");
      const aiRes = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "당신은 한국어로 답변하는 시장 분석가입니다. 간결하고 구조적으로, 투자 권유가 아닌 분석 코멘트를 제공하세요.",
              },
              {
                role: "user",
                content: `다음은 모멘텀/거래량/RSI 점수로 상위 추출된 종목입니다:\n${summary}\n\n각 종목별로 한 줄(최대 60자)씩, "왜 상승 가능성이 있는지" 핵심만 적어주세요. 마지막에 "⚠️ 본 내용은 정보 제공 목적이며 투자 권유가 아닙니다." 라고 덧붙이세요.`,
              },
            ],
          }),
        }
      );
      if (aiRes.ok) {
        const data: any = await aiRes.json();
        aiComment = data?.choices?.[0]?.message?.content ?? "";
      } else {
        console.error("AI gateway error", aiRes.status, await aiRes.text());
      }
    } catch (e) {
      console.error("AI call failed", e);
    }
  }

  return { top, aiComment, fetchedAt: new Date().toISOString() };
});
