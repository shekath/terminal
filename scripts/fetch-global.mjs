// Fetches daily global market series and writes data/global.json.
// Run by the scheduled GitHub workflow; the commit redeploys the site.
// Rows are compact arrays: [date, close] or [date, open, high, low, close, volume].
// Sources: FRED (Federal Reserve Bank of St. Louis) and Stooq. A series that fails is kept from the previous file.
import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../data/global.json', import.meta.url);
const SERIES = [
  // [id, source, name, group, region/unit]
  ['SP500', 'fred', 'S&P 500', 'indices', 'US'], ['DJIA', 'fred', 'Dow Jones', 'indices', 'US'], ['NASDAQCOM', 'fred', 'Nasdaq Comp', 'indices', 'US'],
  ['^UKX', 'stooq', 'FTSE 100', 'indices', 'UK'], ['^DAX', 'stooq', 'DAX', 'indices', 'DE'], ['^CAC', 'stooq', 'CAC 40', 'indices', 'FR'],
  ['NIKKEI225', 'fred', 'Nikkei 225', 'indices', 'JP'], ['^HSI', 'stooq', 'Hang Seng', 'indices', 'HK'], ['^SHC', 'stooq', 'Shanghai Comp', 'indices', 'CN'],
  ['^KOSPI', 'stooq', 'KOSPI', 'indices', 'KR'], ['VIXCLS', 'fred', 'VIX (US vol)', 'indices', 'US'], ['DTWEXBGS', 'fred', 'US Dollar Index (broad)', 'indices', 'US'],
  ['DCOILWTICO', 'fred', 'WTI Crude', 'commodities', 'USD/bbl'], ['DCOILBRENTEU', 'fred', 'Brent Crude', 'commodities', 'USD/bbl'],
  ['DHHNGSP', 'fred', 'Henry Hub Gas', 'commodities', 'USD/MMBtu'], ['XAUUSD', 'stooq', 'Gold', 'commodities', 'USD/oz'],
  ['XAGUSD', 'stooq', 'Silver', 'commodities', 'USD/oz'], ['HG.F', 'stooq', 'Copper', 'commodities', 'USD/lb'],
  ['DGS2', 'fred', 'US 2Y Treasury', 'rates', '%'], ['DGS10', 'fred', 'US 10Y Treasury', 'rates', '%'],
  ['DGS30', 'fred', 'US 30Y Treasury', 'rates', '%'], ['T10Y2Y', 'fred', '10Y–2Y spread', 'rates', 'pp'],
];
const START = new Date(Date.now() - 2 * 365 * 86400e3).toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'terminal-data-job/1.0' }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}
async function fred(id) {
  const csv = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${START}`);
  return csv.trim().split('\n').slice(1).map((l) => { const [date, v] = l.split(','); const c = Number(v); return { date, open: c, high: c, low: c, close: c, volume: 0 }; })
    .filter((r) => isFinite(r.close) && r.close !== 0);
}
async function stooq(id) {
  const csv = await get(`https://stooq.com/q/d/l/?s=${encodeURIComponent(id.toLowerCase())}&d1=${START.replaceAll('-', '')}&i=d`);
  if (!/^Date,/i.test(csv)) throw new Error('no data');
  return csv.trim().split('\n').slice(1).map((l) => { const [date, o, h, lo, c, v] = l.split(','); return { date, open: +o, high: +h, low: +lo, close: +c, volume: +v || 0 }; })
    .filter((r) => r.close);
}

let prev = { series: {} };
try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }

const series = {}; const report = [];
for (const [id, src, name, group, region] of SERIES) {
  try {
    const rows = await (src === 'fred' ? fred(id) : stooq(id));
    if (rows.length < 5) throw new Error('too few rows');
    const compact = rows.map((r) => (src === 'fred' ? [r.date, r.close] : [r.date, r.open, r.high, r.low, r.close, r.volume]));
    series[id] = { name, group, region, source: src === 'fred' ? 'FRED' : 'Stooq', rows: compact };
    report.push(`ok   ${id} ${rows.length} rows, last ${rows.at(-1).date}`);
  } catch (e) {
    if (prev.series[id]) { series[id] = prev.series[id]; report.push(`keep ${id} (${e.message})`); }
    else report.push(`skip ${id} (${e.message})`);
  }
}
console.log(report.join('\n'));
if (!Object.keys(series).length) { console.error('No series fetched; leaving file unchanged.'); process.exit(1); }
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), series }) + '\n');
