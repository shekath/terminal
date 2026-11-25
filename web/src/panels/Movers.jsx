import Panel, { useAsync, Status } from './Panel.jsx';
import { api } from '../api.js';
import { fmt, pct, tone } from '../util.js';

function Table({ title, dir, go }) {
  const s = useAsync(() => api(`top-movers?direction=${dir}&n=25`), [dir]);
  return (
    <Panel span={2} title={title} right={<span className="muted">{s.data?.date}</span>}>
      <Status s={s} />
      <table className="grid-t"><thead><tr><th>Symbol</th><th>Last</th><th>Prev</th><th>Chg%</th><th>Volume</th></tr></thead><tbody>
        {(s.data?.stocks || []).map((q) => (
          <tr key={q.symbol} className="click" onClick={() => go(`${q.symbol} GP`)}>
            <td className="w">{q.symbol}</td><td>{fmt(q.close)}</td><td>{fmt(q.prev_close)}</td><td className={`heat ${tone(q.pct_change)}`} style={{ '--a': Math.min(Math.abs(q.pct_change) / 10, 1) }}>{pct(q.pct_change)}</td><td>{fmt(q.volume, 0)}</td>
          </tr>))}
      </tbody></table>
    </Panel>
  );
}
export default function Movers({ go }) {
  return <><Table title="MOV · TOP GAINERS (ALL NSE)" dir="gain" go={go} /><Table title="MOV · TOP LOSERS (ALL NSE)" dir="loss" go={go} /></>;
}
