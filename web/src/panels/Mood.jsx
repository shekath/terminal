import Panel, { useAsync, Status } from './Panel.jsx';
import { api } from '../api.js';
import { fmt, pct, tone } from '../util.js';
import { Bar } from './Launchpad.jsx';

export default function Mood() {
  const s = useAsync(() => api('mood'), []);
  const b = useAsync(() => api(`breadth?date=${new Date().toISOString().slice(0, 10)}`), []);
  const m = s.data;
  return (
    <>
      <Panel span={2} title="MOOD · MARKET BREADTH">
        <Status s={s} />
        {m && <>
          <Bar label={`Stocks — ${m.stock_breadth.reading}`} up={m.stock_breadth.up} down={m.stock_breadth.down} />
          <Bar label={`Equity indices — ${m.index_breadth.reading}`} up={m.index_breadth.up} down={m.index_breadth.down} />
          {b.data && <Bar label={`All securities (A/D ${b.data.ad_ratio})`} up={b.data.advances} down={b.data.declines} />}
          <p className="muted small">As of {m.date}</p>
        </>}
      </Panel>
      <Panel span={2} title="BENCHMARKS & INDIA VIX">
        {m && <table className="grid-t"><thead><tr><th>Index</th><th>Close</th><th>1D</th></tr></thead><tbody>
          {Object.entries(m.benchmarks).map(([k, v]) => <tr key={k}><td className="w">{k}</td><td>{fmt(v.close)}</td><td className={tone(v.change_pct)}>{pct(v.change_pct)}</td></tr>)}
          <tr><td className="w">India VIX</td><td>{fmt(m.india_vix?.level)}</td><td>{pct(m.india_vix?.change_1d_pct)}</td></tr>
          {m.india_vix?.vs_1w_ago && <tr><td className="muted">VIX vs 1W ago</td><td>{fmt(m.india_vix.vs_1w_ago.base_level)}</td><td>{pct(m.india_vix.vs_1w_ago.change_pct)}</td></tr>}
        </tbody></table>}
      </Panel>
    </>
  );
}
