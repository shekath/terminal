// Non-NSE data adapters: global markets (Stooq daily CSV), FX (ECB via Frankfurter),
// news (public RSS headlines + links only), and live AIS vessel positions (aisstream.io, optional key).

const UA = { 'User-Agent': 'terminal-gateway/0.2' };

async function text(url, { timeout = 15000, retries = 0 } = {}) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
      if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
      return await r.text();
    } catch (e) { if (i >= retries) throw e; }
  }
}

// ---------- Global markets (FRED, Federal Reserve Bank of St. Louis; daily, keyless) ----------
export const GLOBAL = {
  indices: [
    ['SP500', 'S&P 500', 'US'], ['DJIA', 'Dow Jones', 'US'], ['NASDAQCOM', 'Nasdaq Comp', 'US'],
    ['NIKKEI225', 'Nikkei 225', 'JP'], ['VIXCLS', 'VIX (US vol)', 'US'], ['DTWEXBGS', 'US Dollar Index (broad)', 'US'],
  ],
  commodities: [
    ['DCOILWTICO', 'WTI Crude', 'USD/bbl'], ['DCOILBRENTEU', 'Brent Crude', 'USD/bbl'], ['DHHNGSP', 'Henry Hub Gas', 'USD/MMBtu'],
  ],
  rates: [
    ['DGS2', 'US 2Y Treasury', '%'], ['DGS10', 'US 10Y Treasury', '%'], ['DGS30', 'US 30Y Treasury', '%'], ['T10Y2Y', '10Y–2Y spread', 'pp'],
  ],
};

export async function fredHistory(id) {
  // cosd limits the download to recent data; FRED can be slow from some hosts, so allow more time and one retry.
  const csv = await text(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}&cosd=2023-01-01`, { timeout: 45000, retries: 1 });
  return csv.trim().split('\n').slice(1).map((l) => {
    const [date, v] = l.split(',');
    const close = Number(v);
    return { date, open: close, high: close, low: close, close, volume: 0 };
  }).filter((r) => isFinite(r.close) && r.close !== 0 && r.date >= '2021-01-01').slice(-750);
}

// Daily file written by the scheduled GitHub workflow (scripts/fetch-global.mjs).
import { readFile, stat } from 'node:fs/promises';
const FILE = new URL('../../data/global.json', import.meta.url);
let fileCache = { mtime: 0, data: null };
export async function globalFile() {
  try {
    const { mtimeMs } = await stat(FILE);
    if (mtimeMs !== fileCache.mtime) fileCache = { mtime: mtimeMs, data: JSON.parse(await readFile(FILE, 'utf8')) };
    return fileCache.data;
  } catch { return null; }
}
export const expand = (rows) => rows.map((r) => (r.length === 2
  ? { date: r[0], open: r[1], high: r[1], low: r[1], close: r[1], volume: 0 }
  : { date: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
export function snapshotFromFile(file) {
  const out = { indices: [], commodities: [], rates: [], generatedAt: file.generatedAt };
  for (const [symbol, s] of Object.entries(file.series)) {
    const rows = s.rows, last = rows.at(-1), prev = rows.at(-2);
    const close = last[last.length === 2 ? 1 : 4], pclose = prev ? prev[prev.length === 2 ? 1 : 4] : null;
    out[s.group]?.push({ symbol, name: s.name, region: s.region, source: s.source, date: last[0], close,
      change_pct: pclose ? (close / pclose - 1) * 100 : null, spark: rows.slice(-30).map((r) => r[r.length === 2 ? 1 : 4]) });
  }
  return out;
}

export async function globalSnapshot(list) {
  return Promise.all(list.map(async ([symbol, name, region]) => {
    try {
      const rows = await fredHistory(symbol);
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
  markets: [['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'], ['MarketWatch Pulse', 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse']],
  india: [['Economic Times', 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'], ['Livemint', 'https://www.livemint.com/rss/markets']],
  crypto: [['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'], ['Cointelegraph', 'https://cointelegraph.com/rss']],
  economy: [['ET Economy', 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms'], ['Livemint Economy', 'https://www.livemint.com/rss/economy']],
  shipping: [['gCaptain', 'https://gcaptain.com/feed/'], ['Splash247', 'https://splash247.com/feed/']],
};

const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')) || [])[1] || '';
const clean = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).trim();

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
import WebSocket from 'ws';

const vessels = new Map();
const ais = {
  status: process.env.AISSTREAM_API_KEY ? 'connecting' : 'no AISSTREAM_API_KEY set',
  attempts: 0, messages: 0, lastMessageAt: null, connectedAt: null, lastError: null, lastClose: null,
};

export function startAis() {
  const key = (process.env.AISSTREAM_API_KEY || '').trim();
  if (!key) return;
  ais.attempts += 1;
  ais.status = ais.attempts > 1 ? 'reconnecting' : 'connecting';
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream', { handshakeTimeout: 15000 });
  ws.on('open', () => {
    ais.status = 'subscribed (waiting for data)';
    ais.connectedAt = new Date().toISOString();
    // Chokepoints and busy approaches: Malacca/Singapore, Red Sea/Suez, Hormuz, English Channel, Panama, Mumbai.
    ws.send(JSON.stringify({
      APIKey: key, FilterMessageTypes: ['PositionReport'],
      BoundingBoxes: [[[0, 95], [8, 105]], [[12, 32], [31, 44]], [[24, 54], [28, 58]], [[48.5, -6], [51.5, 2]], [[7, -81], [10, -78]], [[18, 72], [19.5, 73.2]]],
    }));
  });
  ws.on('message', (buf) => {
    try {
      const m = JSON.parse(buf.toString());
      if (m.error) { ais.lastError = String(m.error); return; }
      const p = m.Message?.PositionReport, meta = m.MetaData;
      if (!p || !meta) return;
      ais.status = 'live'; ais.messages += 1; ais.lastMessageAt = new Date().toISOString();
      vessels.set(meta.MMSI, { mmsi: meta.MMSI, name: (meta.ShipName || '').trim(), lat: p.Latitude, lon: p.Longitude, sog: p.Sog, cog: p.Cog, t: Date.now() });
      if (vessels.size > 5000) vessels.delete(vessels.keys().next().value);
    } catch { /* ignore malformed frames */ }
  });
  ws.on('error', (e) => { ais.lastError = e.message; });
  ws.on('close', (code, reason) => {
    ais.lastClose = { code, reason: reason.toString(), at: new Date().toISOString() };
    ais.status = 'disconnected — retrying';
    // Back off up to 2 minutes so a bad key does not hammer the service.
    setTimeout(startAis, Math.min(120000, 5000 * ais.attempts));
  });
}

export function aisSnapshot() {
  const cutoff = Date.now() - 30 * 60e3;
  const list = [...vessels.values()].filter((v) => v.t > cutoff);
  const { status, ...diag } = ais;
  return { status, diag, count: list.length, vessels: list };
}
