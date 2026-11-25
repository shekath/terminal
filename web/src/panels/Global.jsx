import { useMemo, useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import AdvancedChart from './AdvancedChart.jsx';
import { api } from '../api.js';
import { fmt, pct, tone } from '../util.js';

function Spark({ data }) {
  if (!data?.length) return <svg width="70" height="18" aria-hidden="true" />;
  const lo = Math.min(...data), hi = Math.max(...data);
  const p = data.map((v, i) => `${(i / (data.length - 1)) * 70},${16 - ((v - lo) / (hi - lo || 1)) * 14}`).join(' ');
  return <svg width="70" height="18" aria-hidden="true"><polyline points={p} fill="none" stroke={data.at(-1) >= data[0] ? '#3DD68C' : '#FF6B6B'} strokeWidth="1.2" /></svg>;
}

function Table({ rows, pick, sel }) {
  return (
    <table className="grid-t"><thead><tr><th>Name</th><th>30D</th><th>Last</th><th>1D</th></tr></thead><tbody>
      {rows.map((r) => (
        <tr key={r.symbol} className={`click ${sel === r.symbol ? 'selrow' : ''}`} onClick={() => !r.error && pick(r)}>
          <td className="w">{r.name}{r.region ? <span className="muted"> {r.region}</span> : null}</td>
          <td><Spark data={r.spark} /></td>
          <td>{r.error ? <span className="muted">n/a</span> : fmt(r.close)}</td>
          <td className={`heat ${tone(r.change_pct)}`} style={{ '--a': Math.min(Math.abs(r.change_pct || 0) / 3, 1) }}>{pct(r.change_pct)}</td>
        </tr>))}
    </tbody></table>
  );
}

export default function Global() {
  const g = useAsync(() => api('global'), []);
  const fx = useAsync(() => api('fx?base=USD'), []);
  const [sel, setSel] = useState({ symbol: '^SPX', name: 'S&P 500' });
  const h = useAsync(() => api(`global-history/${encodeURIComponent(sel.symbol)}`), [sel.symbol]);
  const bars = useMemo(() => (h.data || []).map((r) => ({ time: r.date, ...r })), [h.data]);
  const majors = ['EUR', 'GBP', 'JPY', 'INR', 'CNY', 'CHF', 'AUD', 'CAD', 'SGD', 'HKD', 'KRW', 'BRL'];
  return (
    <>
      <Panel title="WORLD INDICES" right={<span className="muted">daily close · Stooq</span>}><Status s={g} />{g.data && <Table rows={g.data.indices} pick={setSel} sel={sel.symbol} />}</Panel>
      <Panel span={2} title={`GLOBAL CHART · ${sel.name}`}>
        <Status s={h} />
        {bars.length > 0 && <AdvancedChart key={sel.symbol} rows={bars} height={360} defaults={['SMA50', 'SMA200', 'BB']} />}
      </Panel>
      <Panel title="COMMODITIES"><Status s={g} />{g.data && <Table rows={g.data.commodities} pick={setSel} sel={sel.symbol} />}</Panel>
      <Panel span={4} title="FX · USD CROSSES" right={<span className="muted">ECB reference rates · {fx.data?.date}</span>}>
        <Status s={fx} />
        <div className="heatgrid">
          {(fx.data?.rates || []).filter((r) => majors.includes(r.ccy)).map((r) => (
            <div key={r.ccy} className={`cell ${tone(-r.change_pct)}`} style={{ '--a': Math.min(Math.abs(r.change_pct || 0) / 1, 1) }}>
              <span>USD{r.ccy}</span><b>{fmt(r.rate, r.rate < 10 ? 4 : 2)}</b><em>{pct(r.change_pct)}</em>
            </div>))}
        </div>
        <p className="muted small">Green = USD weaker vs the currency on the day.</p>
      </Panel>
    </>
  );
}
