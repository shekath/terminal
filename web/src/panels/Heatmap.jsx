import { useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import { api } from '../api.js';
import { fmt, pct, tone } from '../util.js';

export default function Heatmap({ go }) {
  const [period, setPeriod] = useState('1D');
  const s = useAsync(() => api(`index-movers?n=50&period=${period}`), [period]);
  const list = [...(s.data?.gainers || []), ...(s.data?.losers || [])]
    .filter((v, i, a) => a.findIndex((x) => x.index === v.index) === i)
    .sort((a, b) => b.return_pct - a.return_pct);
  return (
    <Panel span={4} title="HEAT · NSE INDEX HEATMAP" right={<div className="toolbar inline">{['1D', '1W', '1M', '3M', '6M', '1Y'].map((p) => <button key={p} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>)}</div>}>
      <Status s={s} />
      <div className="heatgrid big">
        {list.map((m) => (
          <button key={m.index} className={`cell ${tone(m.return_pct)}`} style={{ '--a': Math.min(Math.abs(m.return_pct) / (period === '1D' ? 3 : 12), 1) }} title={`${m.index}: ${fmt(m.close)}`}>
            <span>{m.index}</span><b>{pct(m.return_pct)}</b><em>{fmt(m.close)}</em>
          </button>))}
      </div>
      <p className="muted small pad">{s.data?.indices_ranked} equity indices ranked · as of {s.data?.date}</p>
    </Panel>
  );
}
