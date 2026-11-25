// Non-NSE data adapters: global markets (Stooq daily CSV), FX (ECB via Frankfurter),
// news (public RSS headlines + links only), and live AIS vessel positions (aisstream.io, optional key).

const UA = { 'User-Agent': 'terminal-gateway/0.2' };

async function text(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.text();
}

// ---------- Global markets ----------
export const GLOBAL = {
  indices: [
    ['^SPX', 'S&P 500', 'US'], ['^DJI', 'Dow Jones', 'US'], ['^NDQ', 'Nasdaq Comp', 'US'],
    ['^UKX', 'FTSE 100', 'UK'], ['^DAX', 'DAX', 'DE'], ['^CAC', 'CAC 40', 'FR'],
    ['^NKX', 'Nikkei 225', 'JP'], ['^HSI', 'Hang Seng', 'HK'], ['^SHC', 'Shanghai Comp', 'CN'], ['^KOSPI', 'KOSPI', 'KR'],
  ],
  commodities: [
    ['GC.F', 'Gold'], ['SI.F', 'Silver'], ['CL.F', 'WTI Crude'], ['CB.F', 'Brent'], ['NG.F', 'Natural Gas'], ['HG.F', 'Copper'],
  ],
};

export async function stooqHistory(symbol) {
  const csv = await text(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&i=d`);
  const lines = csv.trim().split('\n');
  if (!/^Date,/i.test(lines[0])) throw new Error(`no data for ${symbol}`);
  return lines.slice(1).map((l) => {
    const [date, open, high, low, close, volume] = l.split(',');
    return { date, open: +open, high: +high, low: +low, close: +close, volume: +volume || 0 };
  }).filter((r) => r.close).slice(-500);
}

export async function globalSnapshot(list) {
  return Promise.all(list.map(async ([symbol, name, region]) => {
    try {
      const rows = await stooqHistory(symbol);
      const last = rows.at(-1), prev = rows.at(-2);
      return { symbol, name, region, date: last.date, close: last.close, change_pct: prev ? (last.close / prev.close - 1) * 100 : null, spark: rows.slice(-30).map((r) => r.close) };
    } catch (e) { return { symbol, name, region, error: e.message }; }
  }));
}

// ---------- FX (ECB reference rates) ----------
export async function fx(base = 'USD') {
  const today = JSON.parse(await text(`https://api.frankfurter.app/latest?from=${base}`));
  const d = new Date(Date.now() - 10 * 86400e3).toISOString().slice(0, 10);
  const hist = JSON.parse(await text(`https://api.frankfurter.app/${d}..?from=${base}`));
  const dates = Object.keys(hist.rates).sort();
  const prev = hist.rates[dates.at(-2)] || {};
  return {
    base, date: today.date,
    rates: Object.entries(today.rates).map(([ccy, rate]) => ({ ccy, rate, change_pct: prev[ccy] ? (rate / prev[ccy] - 1) * 100 : null })),
  };
}

// ---------- News (RSS headlines; we store title, link, time, source only) ----------
export const FEEDS = {
  markets: [['CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'], ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories']],
  india: [['Economic Times', 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'], ['Livemint', 'https://www.livemint.com/rss/markets']],
  crypto: [['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'], ['Cointelegraph', 'https://cointelegraph.com/rss']],
  economy: [['CNBC Economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'], ['ET Economy', 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms']],
  shipping: [['gCaptain', 'https://gcaptain.com/feed/'], ['Splash247', 'https://splash247.com/feed/']],
};

const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')) || [])[1] || '';
const clean = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export async function news(topic) {
  const feeds = topic === 'all' ? Object.values(FEEDS).flat() : FEEDS[topic] || FEEDS.markets;
  const results = await Promise.allSettled(feeds.map(async ([source, url]) => {
    const xml = await text(url);
    return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 25).map((it) => ({
      source, title: clean(tag(it, 'title')), link: clean(tag(it, 'link')),
      time: new Date(clean(tag(it, 'pubDate')) || Date.now()).toISOString(),
    }));
  }));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((i) => i.title && /^https?:\/\//.test(i.link))
    .sort((a, b) => b.time.localeCompare(a.time));
  const failed = results.map((r, i) => (r.status === 'rejected' ? feeds[i][0] : null)).filter(Boolean);
  return { topic, count: items.length, failed, items: items.slice(0, 80) };
}

// ---------- AIS live vessels (aisstream.io) ----------
// Keeps the latest position per vessel in memory; clients poll /api/ais.
const vessels = new Map();
let aisStatus = process.env.AISSTREAM_API_KEY ? 'connecting' : 'no AISSTREAM_API_KEY set';

export function startAis() {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key || typeof WebSocket === 'undefined') return;
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  ws.onopen = () => {
    aisStatus = 'live';
    // Chokepoints and busy approaches: Malacca, Suez/Red Sea, Hormuz, English Channel, Panama, Singapore, Mumbai/JNPT.
    ws.send(JSON.stringify({
      APIKey: key, FilterMessageTypes: ['PositionReport'],
      BoundingBoxes: [[[0, 95], [8, 105]], [[12, 32], [31, 44]], [[24, 54], [28, 58]], [[48.5, -6], [51.5, 2]], [[7, -81], [10, -78]], [[18, 72], [19.5, 73.2]]],
    }));
  };
  ws.onmessage = async (ev) => {
    try {
      const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
      const m = JSON.parse(raw);
      const p = m.Message?.PositionReport, meta = m.MetaData;
      if (!p || !meta) return;
      vessels.set(meta.MMSI, { mmsi: meta.MMSI, name: (meta.ShipName || '').trim(), lat: p.Latitude, lon: p.Longitude, sog: p.Sog, cog: p.Cog, t: Date.now() });
      if (vessels.size > 5000) vessels.delete(vessels.keys().next().value);
    } catch { /* ignore malformed frames */ }
  };
  ws.onclose = () => { aisStatus = 'reconnecting'; setTimeout(startAis, 10000); };
  ws.onerror = () => ws.close();
}

export function aisSnapshot() {
  const cutoff = Date.now() - 30 * 60e3;
  const list = [...vessels.values()].filter((v) => v.t > cutoff);
  return { status: aisStatus, count: list.length, vessels: list };
}
