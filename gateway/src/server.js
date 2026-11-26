// REST + SSE gateway the terminal UI talks to. All NSE data comes from the MCP servers.
import express from 'express';
import { callTool } from './mcp.js';
import { GLOBAL, globalSnapshot, fredHistory, fx, news, aisSnapshot, startAis } from './sources.js';

const app = express();
const cache = new Map();

// Small TTL cache: live NSE data refreshes every 1–5 min, bhavcopy once a day.
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const route = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};

const sym = (s) => String(s).toUpperCase().replace(/[^A-Z0-9&-]/g, '');

// Live (cm-market)
app.get('/api/indices', route((q) => cached(`idx:${q.query.group}:${q.query.name}`, 60e3, () =>
  callTool('live', 'cm_get_live_indices', { group: q.query.group || '', nameFilter: q.query.name || '' }))));

app.get('/api/indices/:name', route((q) => cached(`idxq:${q.params.name}`, 60e3, () =>
  callTool('live', 'cm_get_index_quote', { indexName: q.params.name }))));

app.get('/api/quote/:symbol', route((q) => cached(`q:${sym(q.params.symbol)}`, 60e3, () =>
  callTool('live', 'cm_get_stock_quote', { symbol: sym(q.params.symbol) }))));

app.get('/api/movers', route((q) => cached(`mov:${q.query.index}:${q.query.limit}`, 5 * 60e3, () =>
  callTool('live', 'nse_get_market_movers', { indexName: q.query.index || '', limit: Number(q.query.limit) || 10 }))));

// History (nse-bhavcopy)
app.get('/api/quotes', route((q) => {
  const symbols = String(q.query.symbols || '').split(',').map(sym).filter(Boolean).slice(0, 50);
  return cached(`bq:${symbols.join(',')}`, 60e3, () => callTool('history', 'get_bulk_quote', { symbols }));
}));

app.get('/api/history/:symbol', route((q) => cached(`h:${sym(q.params.symbol)}:${q.query.months}:${q.query.end}`, 60 * 60e3, () =>
  callTool('history', 'get_stock_history', {
    symbol: sym(q.params.symbol), months: Math.min(Number(q.query.months) || 3, 3), endDate: q.query.end || 'today',
  }))));

app.get('/api/breadth', route((q) => cached(`br:${q.query.date}`, 60 * 60e3, () =>
  callTool('history', 'get_market_breadth', { date: q.query.date || new Date().toISOString().slice(0, 10) }))));

app.get('/api/corporate-actions/:symbol', route((q) => cached(`ca:${sym(q.params.symbol)}`, 24 * 3600e3, () =>
  callTool('history', 'get_corporate_actions', { symbol: sym(q.params.symbol) }))));

app.get('/api/search', route((q) => callTool('history', 'search_symbols', { query: String(q.query.q || '') })));

const H = 60 * 60e3;
const opt = (v) => (v ? String(v) : 'today');

app.get('/api/index-history', route((q) => cached(`ih:${q.query.name}:${q.query.months}:${q.query.end}`, H, () =>
  callTool('history', 'get_index_history', { indexName: String(q.query.name || 'Nifty 50'), months: Math.min(Number(q.query.months) || 3, 12), endDate: opt(q.query.end) }))));

app.get('/api/index-snapshot', route((q) => cached(`is:${q.query.filter}:${q.query.date}`, H, () =>
  callTool('history', 'get_index_snapshot', { date: opt(q.query.date), filter: String(q.query.filter || '') }))));

app.get('/api/index-movers', route((q) => cached(`im:${q.query.period}:${q.query.n}`, H, () =>
  callTool('history', 'get_index_movers', { date: 'today', period: String(q.query.period || '1D'), n: Number(q.query.n) || 10, scope: 'equity' }))));

app.get('/api/top-movers', route((q) => cached(`tm:${q.query.direction}:${q.query.n}:${q.query.date}`, H, () =>
  callTool('history', 'get_top_movers', { date: q.query.date || new Date().toISOString().slice(0, 10), n: Number(q.query.n) || 20, direction: q.query.direction === 'loss' ? 'loss' : 'gain' }))));

app.get('/api/mood', route(() => cached('mood', H, () => callTool('history', 'get_market_mood', { date: 'today' }))));

app.get('/api/compare', route((q) => {
  const symbols = String(q.query.symbols || '').split(',').map(sym).filter(Boolean).slice(0, 10);
  return cached(`cmp:${symbols}:${q.query.months}`, H, () => callTool('history', 'compare_stocks', { symbols, months: Number(q.query.months) || 6 }));
}));

app.get('/api/vs-index/:symbol', route((q) => cached(`vs:${sym(q.params.symbol)}:${q.query.index}`, H, () =>
  callTool('history', 'get_stock_vs_index', { symbol: sym(q.params.symbol), indexName: String(q.query.index || 'Nifty 50'), months: Number(q.query.months) || 12, date: 'today' }))));

app.get('/api/52w/:symbol', route((q) => cached(`52:${sym(q.params.symbol)}`, H, () =>
  callTool('history', 'get_52_week_high_low', { symbol: sym(q.params.symbol) }))));

// Global markets, FX, news, AIS
app.get('/api/global', route(async () => {
  const data = await cached('global', 15 * 60e3, async () => {
    const [indices, commodities, rates] = await Promise.all([globalSnapshot(GLOBAL.indices), globalSnapshot(GLOBAL.commodities), globalSnapshot(GLOBAL.rates)]);
    return { indices, commodities, rates };
  });
  // Don't keep a snapshot where every series failed; retry on the next request.
  if (Object.values(data).flat().every((r) => r.error)) cache.delete('global');
  return data;
}));
app.get('/api/global-history/:symbol', route((q) => cached(`gh:${q.params.symbol}`, 30 * 60e3, () =>
  fredHistory(String(q.params.symbol).replace(/[^A-Za-z0-9]/g, '')))));
app.get('/api/fx', route((q) => cached(`fx:${q.query.base}`, 30 * 60e3, () => fx(/^[A-Z]{3}$/.test(q.query.base) ? q.query.base : 'USD'))));
app.get('/api/news', route((q) => cached(`news:${q.query.topic}`, 5 * 60e3, () => news(String(q.query.topic || 'markets')))));
app.get('/api/ais', (_, res) => res.json(aisSnapshot()));
startAis();

// Serve the built web app if present.
app.use(express.static(new URL('../../web/dist', import.meta.url).pathname));

// SSE stream: pushes watchlist quotes every 60 s (matches the live feed's refresh).
app.get('/api/stream/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map(sym).filter(Boolean).slice(0, 25);
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const push = async () => {
    const quotes = await Promise.all(symbols.map((s) =>
      cached(`q:${s}`, 60e3, () => callTool('live', 'cm_get_stock_quote', { symbol: s })).catch((e) => ({ symbol: s, error: e.message }))));
    res.write(`data: ${JSON.stringify(quotes)}\n\n`);
  };
  await push();
  const timer = setInterval(push, 60e3);
  req.on('close', () => clearInterval(timer));
});

app.get('/healthz', (_, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`gateway on http://localhost:${port}`));
