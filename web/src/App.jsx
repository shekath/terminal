import { useEffect, useRef, useState } from 'react';
import { FUNCTIONS, parseCommand } from './functions.js';
import { api } from './api.js';
import Launchpad from './panels/Launchpad.jsx';
import PriceChart from './panels/PriceChart.jsx';
import Backtest from './panels/Backtest.jsx';
import Heatmap from './panels/Heatmap.jsx';
import Movers from './panels/Movers.jsx';
import Compare from './panels/Compare.jsx';
import Mood from './panels/Mood.jsx';
import Ask from './panels/Ask.jsx';
import Help from './panels/Help.jsx';

const TABS = ['LP', 'GP', 'BT', 'HEAT', 'MOV', 'CMP', 'MOOD', 'ASK', 'HELP'];

export default function App() {
  const [view, setView] = useState({ code: 'LP', symbols: [], nums: [] });
  const [input, setInput] = useState('');
  const [suggest, setSuggest] = useState([]);
  const [sel, setSel] = useState(0);
  const [history, setHistory] = useState([]);
  const [clock, setClock] = useState(new Date());
  const box = useRef(null);
  const symbol = view.symbols[0] || 'RELIANCE';

  const go = (cmd) => {
    const p = parseCommand(cmd);
    if (!p) return;
    setView(p); setInput(''); setSuggest([]);
    setHistory((h) => [cmd.toUpperCase(), ...h.filter((x) => x !== cmd.toUpperCase())].slice(0, 8));
  };

  // Autocomplete: functions by prefix, symbols via NSE search after 2 chars.
  useEffect(() => {
    const last = input.trim().split(/\s+/).at(-1)?.toUpperCase() || '';
    if (!last) return setSuggest([]);
    const fns = FUNCTIONS.filter((f) => f.code.startsWith(last)).map((f) => ({ label: f.code, hint: f.name, value: f.code }));
    setSuggest(fns); setSel(0);
    if (last.length < 2) return;
    const t = setTimeout(() => api(`search?q=${encodeURIComponent(last)}`).then((r) => {
      const arr = (Array.isArray(r) ? r : r.results || r.matches || r.symbols || []).slice(0, 6);
      const syms = arr.map((x) => (typeof x === 'string' ? { symbol: x } : x)).map((x) => ({ label: x.symbol, hint: x.name || x.companyName || x.company_name || 'NSE equity', value: x.symbol }));
      setSuggest([...fns, ...syms]);
    }).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    const key = (e) => {
      const typing = document.activeElement?.tagName === 'INPUT';
      if (e.key === '/' && !typing) { e.preventDefault(); box.current?.focus(); }
      if (e.key === 'Escape') { setView({ code: 'LP', symbols: [], nums: [] }); box.current?.blur(); }
      const f = { F1: 'HELP', F2: 'MOV', F3: 'HEAT', F4: 'ASK' }[e.key];
      if (f) { e.preventDefault(); go(f); }
    };
    window.addEventListener('keydown', key);
    return () => { clearInterval(id); window.removeEventListener('keydown', key); };
  }, []);

  const accept = (v) => { const parts = input.trim().split(/\s+/); parts[parts.length - 1] = v; setInput(parts.join(' ') + ' '); setSuggest([]); box.current?.focus(); };
  const onKey = (e) => {
    if (suggest.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : -1) + suggest.length) % suggest.length); }
    if (e.key === 'Tab' && suggest.length) { e.preventDefault(); accept(suggest[sel].value); }
  };

  const ist = clock.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
  const istH = Number(clock.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  const istM = Number(clock.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', minute: 'numeric' }));
  const day = clock.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const mins = istH * 60 + istM;
  const open = !['Sat', 'Sun'].includes(day) && mins >= 555 && mins <= 930;

  const P = { go, symbol, symbols: view.symbols, nums: view.nums };
  const body = { LP: <Launchpad {...P} />, GP: <PriceChart key={symbol} {...P} />, BT: <Backtest key={symbol + view.nums} {...P} />, HEAT: <Heatmap {...P} />, MOV: <Movers {...P} />, CMP: <Compare {...P} />, MOOD: <Mood />, ASK: <Ask {...P} />, HELP: <Help {...P} /> }[view.code];

  return (
    <div className="app">
      <header className="top">
        <div className="brand">TERMINAL</div>
        <form className="cmd" onSubmit={(e) => { e.preventDefault(); go(input); }}>
          <label htmlFor="cmd" className="prompt">&gt;</label>
          <input id="cmd" ref={box} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder="Type a ticker and function, e.g. RELIANCE GP — press / to focus" autoComplete="off" spellCheck="false" aria-label="Command line" />
          <button type="submit" className="gobtn">GO</button>
          {suggest.length > 0 && (
            <ul className="suggest" role="listbox">
              {suggest.map((s, i) => <li key={s.label + i} role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseDown={() => accept(s.value)}><b>{s.label}</b><span>{s.hint}</span></li>)}
            </ul>
          )}
        </form>
        <div className={`clock ${open ? 'up' : 'muted'}`}>NSE {open ? 'OPEN' : 'CLOSED'} · {ist} IST</div>
      </header>
      <nav className="tabs" aria-label="Functions">
        {TABS.map((t) => <button key={t} className={view.code === t ? 'on' : ''} onClick={() => go(['GP', 'BT'].includes(t) ? `${symbol} ${t}` : t)}>{t}</button>)}
        <span className="crumb">{view.code}{view.symbols.length ? ` · ${view.symbols.join(' ')}` : ''}</span>
        <span className="hist">{history.map((h) => <button key={h} onClick={() => go(h)}>{h}</button>)}</span>
      </nav>
      <main className="work">{body}</main>
      <footer className="foot">
        <span>F1 HELP</span><span>F2 MOV</span><span>F3 HEAT</span><span>F4 ASK</span><span>ESC LAUNCHPAD</span>
        <span className="right">Data: NSE (bhavcopy MCP) · educational/research use · not investment advice</span>
      </footer>
    </div>
  );
}
