import Panel from './Panel.jsx';
import { FUNCTIONS, ROADMAP } from '../functions.js';

export default function Help({ go }) {
  return (
    <>
      <Panel span={3} title="HELP · FUNCTION DIRECTORY">
        <table className="grid-t"><thead><tr><th>Code</th><th>Function</th><th>Example</th></tr></thead><tbody>
          {FUNCTIONS.map((f) => {
            const ex = f.needsSymbol ? (f.code === 'CMP' ? 'CMP TCS INFY' : `RELIANCE ${f.code}`) : f.code;
            return <tr key={f.code} className="click" onClick={() => go(ex)}><td className="w">{f.code}</td><td>{f.name}</td><td className="muted">{ex}</td></tr>;
          })}
        </tbody></table>
      </Panel>
      <Panel title="KEYBOARD">
        <table className="kv"><tbody>
          {[['/', 'Focus command line'], ['Enter', 'Run command (GO)'], ['Tab', 'Accept suggestion'], ['Esc', 'Back to Launchpad'], ['F1', 'Help'], ['F2', 'Movers'], ['F3', 'Heatmap'], ['F4', 'Ask']].map(([k, v]) => <tr key={k}><td className="w">{k}</td><td>{v}</td></tr>)}
        </tbody></table>
        <h3 className="sub">COMING NEXT</h3>
        <ul className="muted small">{ROADMAP.map((r) => <li key={r}>{r}</li>)}</ul>
      </Panel>
    </>
  );
}
