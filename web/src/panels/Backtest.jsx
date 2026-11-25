import { useMemo, useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import Chart from './Chart.jsx';
import { stockHistory } from '../api.js';
import { fmt, pct, tone, sma } from '../util.js';

// Long-only MA crossover with next-bar-close fills and a per-side cost in bps.
function run(rows, fast, slow, costBps) {
  const c = rows.map((r) => r.close), f = sma(c, fast), s = sma(c, slow);
  let pos = 0, entry = 0, equity = 1, peak = 1, maxDD = 0;
  const trades = [], curve = [], markers = [], rets = [];
  for (let i = 1; i < rows.length; i++) {
    const r = pos ? c[i] / c[i - 1] - 1 : 0;
    equity *= 1 + r; rets.push(r);
    const cross = f[i - 1] != null && s[i - 1] != null && f[i] != null;
    if (cross && !pos && f[i - 1] <= s[i - 1] && f[i] > s[i]) {
      pos = 1; entry = c[i]; equity *= 1 - costBps / 1e4;
      markers.push({ time: rows[i].date, position: 'belowBar', color: '#3DD68C', shape: 'arrowUp', text: 'B' });
    } else if (cross && pos && f[i - 1] >= s[i - 1] && f[i] < s[i]) {
      pos = 0; equity *= 1 - costBps / 1e4;
      trades.push(c[i] / entry - 1);
      markers.push({ time: rows[i].date, position: 'aboveBar', color: '#FF6B6B', shape: 'arrowDown', text: 'S' });
    }
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, 1 - equity / peak);
    curve.push({ time: rows[i].date, value: (equity - 1) * 100 });
  }
  if (pos) trades.push(c.at(-1) / entry - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  const wins = trades.filter((t) => t > 0);
  return {
    f, s, curve, markers, trades,
    total: (equity - 1) * 100, buyHold: (c.at(-1) / c[0] - 1) * 100, maxDD: maxDD * 100,
    sharpe: sd ? (mean / sd) * Math.sqrt(252) : 0, winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length ? (wins.reduce((a, b) => a + b, 0) / wins.length) * 100 : 0,
    avgLoss: trades.length - wins.length ? (trades.filter((t) => t <= 0).reduce((a, b) => a + b, 0) / (trades.length - wins.length)) * 100 : 0,
  };
}

export default function Backtest({ symbol, nums = [] }) {
  const [fast, setFast] = useState(nums[0] || 20);
  const [slow, setSlow] = useState(nums[1] || 50);
  const [cost, setCost] = useState(10);
  const [months, setMonths] = useState(24);
  const hist = useAsync(() => stockHistory(symbol, months), [symbol, months]);
  const rows = hist.data || [];
  const res = useMemo(() => (rows.length > slow ? run(rows, fast, slow, cost) : null), [rows, fast, slow, cost]);

  // Grid-search optimizer over fast/slow windows, ranked by Sharpe.
  const grid = useMemo(() => {
    if (rows.length < 120) return [];
    const out = [];
    for (const f of [5, 10, 15, 20, 30]) for (const s of [30, 50, 75, 100, 150]) if (f < s && rows.length > s) {
      const r = run(rows, f, s, cost); out.push({ f, s, total: r.total, sharpe: r.sharpe, maxDD: r.maxDD, n: r.trades.length });
    }
    return out.sort((a, b) => b.sharpe - a.sharpe).slice(0, 8);
  }, [rows, cost]);

  const priceSeries = useMemo(() => !res ? [] : [
    { type: 'line', data: rows.map((r) => ({ time: r.date, value: r.close })), options: { color: '#E6EAEE', lineWidth: 1 }, markers: res.markers },
    { type: 'line', data: rows.map((r, i) => ({ time: r.date, value: res.f[i] })).filter((p) => p.value != null), options: { color: '#3DD68C', lineWidth: 1 } },
    { type: 'line', data: rows.map((r, i) => ({ time: r.date, value: res.s[i] })).filter((p) => p.value != null), options: { color: '#5B8DEF', lineWidth: 1 } },
  ], [res, rows]);
  const pnlSeries = useMemo(() => !res ? [] : [
    { type: 'baseline', data: res.curve, options: { baseValue: { type: 'price', price: 0 }, topLineColor: '#3DD68C', bottomLineColor: '#FF6B6B', topFillColor1: 'rgba(61,214,140,.2)', bottomFillColor1: 'rgba(255,107,107,.2)' } },
  ], [res]);

  const num = (v, set) => (e) => set(Math.max(1, Number(e.target.value) || v));
  return (
    <>
      <Panel span={3} title={`BT · ${symbol} · BACKTEST — SMA CROSSOVER (LONG ONLY)`} right={<span className="muted">fills at close · {cost} bps/side</span>}>
        <div className="toolbar form">
          <label>Fast <input type="number" value={fast} onChange={num(fast, setFast)} /></label>
          <label>Slow <input type="number" value={slow} onChange={num(slow, setSlow)} /></label>
          <label>Cost bps <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} /></label>
          <label>History <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[6, 12, 24, 36].map((m) => <option key={m} value={m}>{m}M</option>)}</select></label>
          <span className="legend"><i style={{ background: '#3DD68C' }} />SMA {fast} <i style={{ background: '#5B8DEF' }} />SMA {slow}</span>
        </div>
        <Status s={hist} />
        {res && <Chart series={priceSeries} height={300} />}
        {res && <><h3 className="sub">Profit / loss %</h3><Chart series={pnlSeries} height={140} /></>}
      </Panel>
      <Panel title="STRATEGY STATISTICS">
        {res && (
          <table className="kv"><tbody>
            {[['Total return', pct(res.total), tone(res.total)], ['Buy & hold', pct(res.buyHold), tone(res.buyHold)], ['Trades', res.trades.length], ['Win rate', `${fmt(res.winRate, 1)}%`],
              ['Avg win', pct(res.avgWin), 'up'], ['Avg loss', pct(res.avgLoss), 'dn'], ['Max drawdown', `${fmt(res.maxDD, 1)}%`, 'dn'], ['Sharpe (ann.)', fmt(res.sharpe)]]
              .map(([k, v, c]) => <tr key={k}><td>{k}</td><td className={c || ''}>{v}</td></tr>)}
          </tbody></table>
        )}
        <h3 className="sub">OPTIMIZER — TOP BY SHARPE</h3>
        <table className="grid-t"><thead><tr><th>F/S</th><th>Ret</th><th>Sharpe</th><th>DD</th><th>#</th></tr></thead><tbody>
          {grid.map((g) => (
            <tr key={`${g.f}-${g.s}`} className="click" onClick={() => { setFast(g.f); setSlow(g.s); }}>
              <td>{g.f}/{g.s}</td><td className={tone(g.total)}>{fmt(g.total, 1)}%</td><td>{fmt(g.sharpe)}</td><td>{fmt(g.maxDD, 1)}%</td><td>{g.n}</td>
            </tr>))}
        </tbody></table>
        <p className="muted small">In-sample results on unadjusted prices; not investment advice.</p>
      </Panel>
    </>
  );
}
