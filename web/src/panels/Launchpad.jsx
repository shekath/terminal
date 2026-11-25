import { useMemo } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import Chart from './Chart.jsx';
import { api, indexHistory, stockHistory } from '../api.js';
import { fmt, pct, tone, sma } from '../util.js';

const INDICES = ['Nifty 50', 'Nifty Bank', 'Nifty IT', 'Nifty Financial Services', 'Nifty Midcap 100', 'India VIX'];
export const WATCH = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'BHARTIARTL', 'SBIN', 'ITC', 'LT', 'HINDUNILVR', 'AXISBANK', 'KOTAKBANK'];

function MiniIndex({ name }) {
  const s = useAsync(() => indexHistory(name, 6), [name]);
  const rows = s.data || [];
  const series = useMemo(() => {
    if (!rows.length) return [];
    const c = rows.map((r) => r.close);
    return [
      { type: 'area', data: rows.map((r) => ({ time: r.date, value: r.close })), options: { lineColor: '#7FB2FF', topColor: 'rgba(91,141,239,.35)', bottomColor: 'rgba(91,141,239,.02)', lineWidth: 1 } },
      { type: 'line', data: rows.map((r, i) => ({ time: r.date, value: sma(c, 20)[i] })).filter((p) => p.value != null), options: { color: '#F5A524', lineWidth: 1 } },
      { type: 'histogram', scale: 'vol', data: rows.map((r) => ({ time: r.date, value: r.volume || 0, color: '#2A3340' })) },
    ];
  }, [rows]);
  const last = rows.at(-1);
  return (
    <div className="mini">
      <div className="mini-h"><b>{name}</b><span>{fmt(last?.close)}</span><span className={tone(last?.pctChange)}>{pct(last?.pctChange)}</span><em>MA20</em></div>
      {s.error ? <div className="err small">{s.error}</div> : <Chart series={series} height={130} compact />}
    </div>
  );
}

function Spark({ symbol }) {
  const s = useAsync(() => stockHistory(symbol, 1), [symbol]);
  const c = (s.data || []).map((r) => r.close);
  if (c.length < 2) return <svg width="80" height="20" aria-hidden="true" />;
  const lo = Math.min(...c), hi = Math.max(...c);
  const pts = c.map((v, i) => `${(i / (c.length - 1)) * 80},${18 - ((v - lo) / (hi - lo || 1)) * 16}`).join(' ');
  return <svg width="80" height="20" aria-hidden="true"><polyline points={pts} fill="none" stroke={c.at(-1) >= c[0] ? '#3DD68C' : '#FF6B6B'} strokeWidth="1.2" /></svg>;
}

export function Watchlist({ go }) {
  const s = useAsync(() => api(`quotes?symbols=${WATCH.join(',')}`), []);
  return (
    <Panel title="W · WATCHLIST" right={<span className="muted">1M</span>}>
      <Status s={s} />
      <table className="grid-t"><thead><tr><th>Ticker</th><th>Trend</th><th>Last</th><th>Chg%</th></tr></thead><tbody>
        {(s.data?.quotes || []).map((q) => (
          <tr key={q.symbol} className="click" onClick={() => go(`${q.symbol} GP`)}>
            <td className="w">{q.symbol}</td><td><Spark symbol={q.symbol} /></td><td>{fmt(q.close)}</td><td className={`heat ${tone(q.pct_change)}`} style={{ '--a': Math.min(Math.abs(q.pct_change) / 4, 1) }}>{pct(q.pct_change)}</td>
          </tr>))}
      </tbody></table>
    </Panel>
  );
}

export function MoversHeat({ go }) {
  const g = useAsync(() => api('index-movers?n=12&period=1D'), []);
  const all = [...(g.data?.gainers || []), ...(g.data?.losers || []).reverse()];
  return (
    <Panel title="SECTOR MOVERS · 1D">
      <Status s={g} />
      <div className="heatgrid">
        {all.map((m) => (
          <button key={m.index} className={`cell ${tone(m.return_pct)}`} style={{ '--a': Math.min(Math.abs(m.return_pct) / 4, 1) }} onClick={() => go('HEAT')}>
            <span>{m.index.replace(/^NIFTY |^Nifty /i, '')}</span><b>{pct(m.return_pct)}</b>
          </button>))}
      </div>
    </Panel>
  );
}

export default function Launchpad({ go }) {
  const mood = useAsync(() => api('mood'), []);
  const m = mood.data;
  return (
    <>
      <Panel span={2} title="INDEX MONITOR · 6M · AREA + MA20">
        <div className="minigrid">{INDICES.map((n) => <MiniIndex key={n} name={n} />)}</div>
      </Panel>
      <Watchlist go={go} />
      <MoversHeat go={go} />
      <Panel title="BREADTH & VOLATILITY">
        <Status s={mood} />
        {m && <>
          <Bar label="Stocks up" up={m.stock_breadth.up} down={m.stock_breadth.down} />
          <Bar label="Indices up" up={m.index_breadth.up} down={m.index_breadth.down} />
          <table className="kv"><tbody>
            {Object.entries(m.benchmarks).map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v.close)}</td><td className={tone(v.change_pct)}>{pct(v.change_pct)}</td></tr>)}
            <tr><td>India VIX</td><td>{fmt(m.india_vix?.level)}</td><td className={tone(-m.india_vix?.change_1d_pct)}>{pct(m.india_vix?.change_1d_pct)}</td></tr>
          </tbody></table>
          <p className="muted small">As of {m.date}</p>
        </>}
      </Panel>
    </>
  );
}

export function Bar({ label, up, down }) {
  const p = (up / (up + down || 1)) * 100;
  return (
    <div className="bar"><div className="bar-l"><span>{label}</span><span><b className="up">{up}</b> / <b className="dn">{down}</b></span></div>
      <div className="bar-t"><div style={{ width: `${p}%` }} /></div></div>
  );
}
