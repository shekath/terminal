import { useState } from 'react';
import Panel from './Panel.jsx';

const EXAMPLES = ['chart reliance', 'backtest infy 10 40', 'compare tcs infy wipro hcltech', 'top gainers', 'sector heatmap', 'market breadth'];

// Rule-based intent router (no LLM wired yet). Maps phrases to functions.
export function interpret(q) {
  const t = q.toLowerCase();
  const words = q.toUpperCase().match(/[A-Z&]{2,}|\d+/g) || [];
  const stop = new Set(['CHART', 'SHOW', 'ME', 'PRICE', 'OF', 'BACKTEST', 'COMPARE', 'VS', 'AND', 'WITH', 'TOP', 'GAINERS', 'LOSERS', 'SECTOR', 'HEATMAP', 'MARKET', 'BREADTH', 'MOOD', 'THE', 'FOR', 'STOCK', 'MA', 'SMA']);
  const syms = words.filter((w) => !stop.has(w) && !/^\d+$/.test(w));
  const nums = words.filter((w) => /^\d+$/.test(w));
  if (/backtest|strategy|crossover/.test(t)) return `BT ${syms[0] || 'RELIANCE'} ${nums.join(' ')}`;
  if (/compare|\bvs\b|versus|relative/.test(t)) return `CMP ${syms.join(' ')}`;
  if (/gainer|loser|mover/.test(t)) return 'MOV';
  if (/heat|sector/.test(t)) return 'HEAT';
  if (/breadth|mood|vix|advance/.test(t)) return 'MOOD';
  if (syms.length) return `${syms[0]} GP`;
  return null;
}

export default function Ask({ go }) {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const submit = (e) => { e.preventDefault(); const cmd = interpret(q); if (cmd) go(cmd); else setMsg('Not understood yet — try one of the examples.'); };
  return (
    <Panel span={4} title="ASK · NATURAL-LANGUAGE COMMANDS" className="ask">
      <form onSubmit={submit} className="ask-f">
        <label htmlFor="ask-q" className="muted">Ask the terminal</label>
        <input id="ask-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. backtest HDFCBANK 10 40" autoFocus />
        <button type="submit">Run</button>
      </form>
      {msg && <p className="err">{msg}</p>}
      <div className="toolbar">{EXAMPLES.map((x) => <button key={x} onClick={() => { const c = interpret(x); c && go(c); }}>{x}</button>)}</div>
      <p className="muted small">Phase 1 routes questions to functions with rules. An LLM research assistant with citations is planned for Phase 4.</p>
    </Panel>
  );
}
