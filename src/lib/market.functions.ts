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

// ===== Market News =====
export type MarketNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
  category: "국내" | "해외" | "시장";
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseRss(xml: string): { title: string; link: string; pubDate: string }[] {
  const items: { title: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const matches = xml.match(itemRegex) ?? [];
  for (const block of matches) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    if (title && link) {
      items.push({
        title: decodeEntities(title),
        link: decodeEntities(link),
        pubDate: decodeEntities(pubDate),
      });
    }
  }
  return items;
}

async function fetchRss(
  url: string,
  source: string,
  category: MarketNewsItem["category"]
): Promise<MarketNewsItem[]> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRss(xml).map((it) => ({
      title: it.title,
      link: it.link,
      source,
      publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      category,
    }));
  } catch {
    return [];
  }
}

export const getMarketNews = createServerFn({ method: "GET" }).handler(async () => {
  const feeds = await Promise.all([
    // Global / US markets via Yahoo Finance RSS
    fetchRss(
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC,^IXIC,^DJI&region=US&lang=en-US",
      "Yahoo Finance",
      "해외"
    ),
    // Korea markets via Yahoo Finance RSS (KOSPI/KOSDAQ)
    fetchRss(
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^KS11,^KQ11&region=US&lang=en-US",
      "Yahoo Finance",
      "국내"
    ),
    // Google News - 증시 (Korean)
    fetchRss(
      "https://news.google.com/rss/search?q=%EC%A6%9D%EC%8B%9C+OR+%EC%BD%94%EC%8A%A4%ED%94%BC+OR+%EC%BD%94%EC%8A%A4%EB%8B%A5&hl=ko&gl=KR&ceid=KR:ko",
      "Google News",
      "국내"
    ),
    // Google News - stock market (English)
    fetchRss(
      "https://news.google.com/rss/search?q=stock+market+OR+S%26P+500+OR+nasdaq&hl=en-US&gl=US&ceid=US:en",
      "Google News",
      "해외"
    ),
  ]);

  const all = feeds.flat();
  // Dedupe by title
  const seen = new Set<string>();
  const unique = all.filter((n) => {
    const key = n.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return { items: unique.slice(0, 18), fetchedAt: new Date().toISOString() };
});

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
  // Sort full list by score desc; frontend filters by market.
  const krSorted = scored.filter((s) => s.market === "KR").sort((a, b) => b.score - a.score);
  const usSorted = scored.filter((s) => s.market === "US").sort((a, b) => b.score - a.score);
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 8);

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

  return { top, krSorted, usSorted, aiComment, fetchedAt: new Date().toISOString() };
});

// Chart history server function
export type ChartPoint = { t: number; c: number };
export type ChartRange = "1d" | "1w" | "1mo" | "1y";

const RANGE_PARAMS: Record<ChartRange, { range: string; interval: string }> = {
  "1d": { range: "1d", interval: "5m" },
  "1w": { range: "5d", interval: "30m" },
  "1mo": { range: "1mo", interval: "1d" },
  "1y": { range: "1y", interval: "1d" },
};

export const getChartHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string; range: ChartRange }) => data)
  .handler(async ({ data }) => {
    const { symbol, range } = data;
    const { range: r, interval } = RANGE_PARAMS[range];
    const url = `${YF_CHART}/${encodeURIComponent(symbol)}?interval=${interval}&range=${r}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return { points: [] as ChartPoint[], error: `HTTP ${res.status}` };
    }
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { points: [] as ChartPoint[], error: "no data" };
    const ts: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const points: ChartPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c != null) points.push({ t: ts[i] * 1000, c });
    }
    return { points, error: null as string | null };
  });

// =========== Stock analyzer (search by symbol) ===========

export type NewsItem = { title: string; publisher?: string; link?: string; publishedAt?: number };

export type StockAnalysis = {
  symbol: string;
  name: string;
  price: number | null;
  currency?: string;
  changePercent: number | null;
  metric: StockMetric | null;
  news: NewsItem[];
  recommendation: {
    action: "매수" | "보유" | "매도" | "관망";
    confidence: "낮음" | "중간" | "높음";
    entryPrice: number | null;
    targetPrice: number | null;
    stopLoss: number | null;
    expectedReturn: number | null; // % from entry to target (always positive when valid)
    stopLossPercent: number | null; // % loss from entry to stop (negative)
    riskReward: number | null; // |target-entry| / |entry-stop|
    horizon: string;
    rationale: string;
    risks: string;
    keyPoints: string[]; // beginner-friendly bullet checklist
    glossary: { term: string; meaning: string }[]; // explain jargon used
    autoAdjusted?: boolean; // true if we corrected target/stop math
  } | null;
  rawAi?: string;
  error?: string;
};

async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        symbol
      )}&newsCount=8&quotesCount=1`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
          Accept: "application/json",
        },
      }
    );
    if (!r.ok) return [];
    const json: any = await r.json();
    const news: any[] = json?.news ?? [];
    return news.slice(0, 8).map((n) => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: n.providerPublishTime ? n.providerPublishTime * 1000 : undefined,
    }));
  } catch {
    return [];
  }
}

function normalizeSymbol(input: string): string {
  const s = input.trim().toUpperCase();
  if (!s) return s;
  // Korean 6-digit code -> append .KS by default
  if (/^\d{6}$/.test(s)) return `${s}.KS`;
  return s;
}

export const analyzeStock = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => data)
  .handler(async ({ data }): Promise<StockAnalysis> => {
    const symbol = normalizeSymbol(data.symbol);
    if (!symbol) {
      return {
        symbol: data.symbol,
        name: data.symbol,
        price: null,
        changePercent: null,
        metric: null,
        news: [],
        recommendation: null,
        error: "종목 코드를 입력하세요.",
      };
    }

    // Pull metric (which also gets price/RSI/momentum)
    const usOrKr: "US" | "KR" = symbol.endsWith(".KS") || symbol.endsWith(".KQ") ? "KR" : "US";
    const [metric, news, quoteRes] = await Promise.all([
      fetchStockMetric(symbol, usOrKr),
      fetchYahooNews(symbol),
      fetch(`${YF_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)",
          Accept: "application/json",
        },
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    const meta = quoteRes?.chart?.result?.[0]?.meta;
    const price = metric?.price ?? meta?.regularMarketPrice ?? null;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    const changePercent =
      metric?.changePercent ??
      (price != null && prev ? ((price - prev) / prev) * 100 : null);
    const name =
      STOCK_NAMES[symbol] ?? meta?.longName ?? meta?.shortName ?? symbol;
    const currency = meta?.currency;

    if (price == null) {
      return {
        symbol,
        name,
        price: null,
        changePercent: null,
        metric: null,
        news,
        recommendation: null,
        error: "해당 종목 데이터를 찾을 수 없습니다. 심볼을 확인해주세요. (예: AAPL, 005930.KS)",
      };
    }

    // AI recommendation
    let recommendation: StockAnalysis["recommendation"] = null;
    let rawAi = "";
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const newsText = news.length
          ? news
              .map(
                (n, i) =>
                  `${i + 1}. [${n.publisher ?? "출처미상"}] ${n.title}`
              )
              .join("\n")
          : "(최근 뉴스 없음)";
        const metricText = metric
          ? `현재가 ${metric.price.toFixed(2)} ${currency ?? ""} | 1일 ${metric.changePercent.toFixed(2)}% | 5일 ${metric.changePercent5d.toFixed(2)}% | 20일 ${metric.changePercent20d.toFixed(2)}% | RSI14 ${metric.rsi14.toFixed(0)} | 거래량비 ${metric.volumeRatio.toFixed(2)}x`
          : `현재가 ${price.toFixed(2)} ${currency ?? ""}`;

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
                    "당신은 한국어로 답변하는 시장 분석가입니다. 모멘텀/뉴스 흐름을 종합해 정보 제공 목적의 의견을 제시합니다. 반드시 JSON만 반환하세요. 가격 산출 규칙(절대 위반 금지): action 종류와 무관하게 항상 stopLoss < entryPrice < targetPrice 이어야 합니다 (목표가는 매도하여 수익을 실현할 가격으로 진입가보다 높고, 손절가는 손실을 제한하기 위해 매도할 가격으로 진입가보다 낮습니다). action이 '매도'/'관망'이면 현재 진입을 권하지 않는다는 의미일 뿐 가격 관계는 동일합니다. 모든 가격은 현재가와 같은 통화/스케일이며 현재가 대비 ±30% 범위 이내여야 합니다.",
                },
                {
                  role: "user",
                  content: `종목: ${name} (${symbol})\n현재가: ${price.toFixed(2)} ${currency ?? ""}\n[지표]\n${metricText}\n\n[최근 뉴스]\n${newsText}\n\n다음 JSON 스키마로만 답하세요 (코드블록/주석 없이 순수 JSON):\n{\n  "action": "매수" | "보유" | "매도" | "관망",\n  "confidence": "낮음" | "중간" | "높음",\n  "entryPrice": number,         // 권장 진입가 (현재가 ±5% 이내)\n  "targetPrice": number,        // 목표가 — 반드시 entryPrice 보다 높게 (수익 실현가)\n  "stopLoss": number,           // 손절가 — 반드시 entryPrice 보다 낮게 (손실 제한가)\n  "horizon": string,            // 예: "1~3개월"\n  "rationale": string,          // 핵심 근거 2~4문장 (지표+뉴스)\n  "risks": string,              // 주의해야 할 리스크 1~2문장\n  "keyPoints": string[],        // 초보자용 체크리스트 4~6개. 분할매수, 분산투자, 손절 준수 같은 실행 팁 포함\n  "glossary": [{"term": string, "meaning": string}]  // 본문에서 사용한 전문 용어 3~5개를 한 문장으로 풀이 (RSI, 모멘텀, 손절, 목표가, PER 등)\n}`,
                },
              ],
              response_format: { type: "json_object" },
            }),
          }
        );
        if (aiRes.ok) {
          const json: any = await aiRes.json();
          rawAi = json?.choices?.[0]?.message?.content ?? "";
          try {
            const parsed = JSON.parse(rawAi);
            const action = parsed.action;
            let entry = typeof parsed.entryPrice === "number" ? parsed.entryPrice : price;
            let target = typeof parsed.targetPrice === "number" ? parsed.targetPrice : null;
            let stop = typeof parsed.stopLoss === "number" ? parsed.stopLoss : null;
            let autoAdjusted = false;

            // Sanity: clip entry within ±10% of current
            if (Math.abs(entry - price) / price > 0.1) {
              entry = price;
              autoAdjusted = true;
            }

            // Enforce: stopLoss < entry < targetPrice ALWAYS (regardless of action)
            const valid =
              target != null && stop != null && stop < entry && entry < target;

            if (!valid) {
              autoAdjusted = true;
              // Default fallbacks based on action conviction
              const upPct = action === "매수" ? 0.10 : action === "보유" ? 0.07 : 0.05;
              const downPct = action === "매도" ? 0.05 : 0.07;
              target = +(entry * (1 + upPct)).toFixed(2);
              stop = +(entry * (1 - downPct)).toFixed(2);
            }

            const expectedReturn =
              target != null ? ((target - entry) / entry) * 100 : null;
            const stopLossPercent =
              stop != null ? ((stop - entry) / entry) * 100 : null;
            const riskReward =
              target != null && stop != null && entry !== stop
                ? Math.abs(target - entry) / Math.abs(entry - stop)
                : null;

            recommendation = {
              action,
              confidence: parsed.confidence,
              entryPrice: entry,
              targetPrice: target,
              stopLoss: stop,
              expectedReturn,
              stopLossPercent,
              riskReward,
              horizon: parsed.horizon ?? "",
              rationale: parsed.rationale ?? "",
              risks: parsed.risks ?? "",
              keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 8) : [],
              glossary: Array.isArray(parsed.glossary)
                ? parsed.glossary
                    .filter((g: any) => g && typeof g.term === "string" && typeof g.meaning === "string")
                    .slice(0, 6)
                : [],
              autoAdjusted,
            };
          } catch {
            // leave rawAi for display
          }
        } else {
          console.error("AI gateway error", aiRes.status, await aiRes.text());
        }
      } catch (e) {
        console.error("analyzeStock AI failed", e);
      }
    }

    return {
      symbol,
      name,
      price,
      currency,
      changePercent,
      metric,
      news,
      recommendation,
      rawAi,
    };
  });
