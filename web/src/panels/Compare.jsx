import { useMemo, useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import Chart from './Chart.jsx';
import { api, stockHistory } from '../api.js';
import { fmt, pct, tone } from '../util.js';

const COLORS = ['#F5A524', '#5B8DEF', '#3DD68C', '#C084FC', '#FF8A65', '#4FC3F7'];

export default function Compare({ symbols }) {
  const list = (symbols.length ? symbols : ['TCS', 'INFY', 'HCLTECH', 'WIPRO']).slice(0, 6);
  const [months, setMonths] = useState(6);
  const hist = useAsync(() => Promise.all(list.map((s) => stockHistory(s, months))), [list.join(), months]);
  const stats = useAsync(() => api(`compare?symbols=${list.join(',')}&months=${months}`), [list.join(), months]);
  const series = useMemo(() => (hist.data || []).map((rows, i) => ({
    type: 'line', options: { color: COLORS[i], lineWidth: 2, title: list[i] },
    data: rows.map((r) => ({ time: r.date, value: (r.close / rows[0].close - 1) * 100 })),
  })), [hist.data]);
  return (
    <>
      <Panel span={3} title={`CMP · RELATIVE PERFORMANCE · ${list.join(' / ')}`} right={<div className="toolbar inline">{[1, 3, 6, 12, 24].map((m) => <button key={m} className={m === months ? 'on' : ''} onClick={() => setMonths(m)}>{m}M</button>)}</div>}>
        <Status s={hist} />
        {series.length > 0 && <Chart series={series} height={420} />}
        <p className="muted small">Rebased to 0% at the start of the window.</p>
      </Panel>
      <Panel title="RETURN & DRAWDOWN">
        <Status s={stats} />
        <table className="grid-t"><thead><tr><th>Symbol</th><th>Return</th><th>Max DD</th></tr></thead><tbody>
          {(stats.data?.stocks || []).map((s) => <tr key={s.symbol}><td className="w" style={{ color: COLORS[list.indexOf(s.symbol)] }}>{s.symbol}</td><td className={tone(s.return_pct)}>{pct(s.return_pct)}</td><td className="dn">{fmt(s.max_drawdown, 1)}%</td></tr>)}
        </tbody></table>
      </Panel>
    </>
  );
}
