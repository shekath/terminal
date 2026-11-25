import { useEffect, useMemo, useRef, useState } from 'react';
import Panel from './Panel.jsx';
import AdvancedChart from './AdvancedChart.jsx';
import { fmt, pct, tone } from '../util.js';

// Realtime crypto straight from Binance's public market-data streams (no key needed).
// The browser connects directly, so prices tick in real time regardless of the gateway.
const REST = 'https://data-api.binance.vision/api/v3';
const WS = 'wss://data-stream.binance.vision';
export const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'TRXUSDT', 'LTCUSDT'];
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function useTickers(pairs = PAIRS) {
  const [tick, setTick] = useState({});
  useEffect(() => {
    const streams = pairs.map((p) => `${p.toLowerCase()}@miniTicker`).join('/');
    let ws, closed = false;
    const open = () => {
      ws = new WebSocket(`${WS}/stream?streams=${streams}`);
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data).data;
        setTick((t) => ({ ...t, [d.s]: { last: +d.c, open: +d.o, high: +d.h, low: +d.l, vol: +d.q, prev: t[d.s]?.last } }));
      };
      ws.onclose = () => { if (!closed) setTimeout(open, 3000); };
    };
    open();
    return () => { closed = true; ws?.close(); };
  }, [pairs.join()]);
  return tick;
}

function useKlines(pair, interval) {
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let ws, closed = false;
    setRows([]); setErr('');
    fetch(`${REST}/klines?symbol=${pair}&interval=${interval}&limit=500`).then((r) => r.json()).then((k) => {
      setRows(k.map((x) => ({ time: Math.floor(x[0] / 1000), open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5] })));
      ws = new WebSocket(`${WS}/ws/${pair.toLowerCase()}@kline_${interval}`);
      ws.onmessage = (e) => { const k2 = JSON.parse(e.data).k; setLive({ time: Math.floor(k2.t / 1000), open: +k2.o, high: +k2.h, low: +k2.l, close: +k2.c, volume: +k2.v }); };
    }).catch((e) => !closed && setErr(e.message));
    return () => { closed = true; ws?.close(); };
  }, [pair, interval]);
  return { rows, live, err };
}

function useDepth(pair) {
  const [book, setBook] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    const ws = new WebSocket(`${WS}/stream?streams=${pair.toLowerCase()}@depth20@100ms/${pair.toLowerCase()}@aggTrade`);
    ws.onmessage = (e) => {
      const { stream, data } = JSON.parse(e.data);
      if (stream.includes('depth')) setBook({ bids: data.bids.slice(0, 14), asks: data.asks.slice(0, 14) });
      else setTrades((t) => [{ p: +data.p, q: +data.q, sell: data.m, t: data.T }, ...t].slice(0, 30));
    };
    return () => ws.close();
  }, [pair]);
  return { book, trades };
}

function Book({ book }) {
  const max = Math.max(...[...book.bids, ...book.asks].map((x) => +x[1]), 1e-9);
  const row = (side) => ([p, q]) => (
    <tr key={side + p}><td className={side === 'a' ? 'dn' : 'up'}>{fmt(+p, +p < 10 ? 4 : 2)}</td><td>{fmt(+q, 4)}</td>
      <td className="depth"><i className={side} style={{ width: `${(q / max) * 100}%` }} /></td></tr>
  );
  const spread = book.asks[0] && book.bids[0] ? +book.asks[0][0] - +book.bids[0][0] : null;
  return (
    <table className="grid-t book"><thead><tr><th>Price</th><th>Size</th><th /></tr></thead><tbody>
      {[...book.asks].reverse().map(row('a'))}
      <tr className="spread"><td colSpan="3">Spread {spread == null ? '—' : fmt(spread, spread < 1 ? 4 : 2)}</td></tr>
      {book.bids.map(row('b'))}
    </tbody></table>
  );
}

export default function Crypto({ symbols }) {
  const initial = symbols?.[0] && PAIRS.includes(`${symbols[0]}USDT`) ? `${symbols[0]}USDT` : 'BTCUSDT';
  const [pair, setPair] = useState(initial);
  const [interval, setIntervalV] = useState('15m');
  const tick = useTickers();
  const { rows, live, err } = useKlines(pair, interval);
  const { book, trades } = useDepth(pair);
  const t = tick[pair];
  const chg = t ? (t.last / t.open - 1) * 100 : null;
  const flash = useRef({});

  return (
    <>
      <Panel title="CRYPTO · LIVE MARKETS" right={<span className="up">● streaming</span>}>
        <table className="grid-t"><thead><tr><th>Pair</th><th>Last</th><th>24h</th><th>Vol (USDT)</th></tr></thead><tbody>
          {PAIRS.map((p) => {
            const x = tick[p]; const c = x ? (x.last / x.open - 1) * 100 : null;
            const dir = x?.prev == null ? '' : x.last > x.prev ? 'flash-up' : x.last < x.prev ? 'flash-dn' : flash.current[p] || '';
            flash.current[p] = dir;
            return (
              <tr key={p + (x?.last ?? '')} className={`click ${p === pair ? 'selrow' : ''}`} onClick={() => setPair(p)}>
                <td className="w">{p.replace('USDT', '')}</td><td className={dir}>{x ? fmt(x.last, x.last < 10 ? 4 : 2) : '…'}</td>
                <td className={`heat ${tone(c)}`} style={{ '--a': Math.min(Math.abs(c || 0) / 6, 1) }}>{pct(c)}</td><td>{x ? fmt(x.vol / 1e6, 1) + 'M' : ''}</td>
              </tr>);
          })}
        </tbody></table>
      </Panel>
      <Panel span={2} title={`CRYPTO · ${pair.replace('USDT', '/USDT')} · ${interval}`} right={<div className="toolbar inline">{INTERVALS.map((i) => <button key={i} className={i === interval ? 'on' : ''} onClick={() => setIntervalV(i)}>{i}</button>)}</div>}>
        <div className="quote-line">
          <span className="big">{t ? fmt(t.last, t.last < 10 ? 4 : 2) : '…'}</span><span className={tone(chg)}>{pct(chg)} 24h</span>
          <span className="muted">H {fmt(t?.high)} L {fmt(t?.low)} · Vol {t ? fmt(t.vol / 1e6, 1) : '—'}M USDT</span>
        </div>
        {err && <div className="err">Crypto feed unavailable: {err}</div>}
        {rows.length > 0 && <AdvancedChart rows={rows} live={live} intraday={interval !== '1d'} height={360} defaults={['EMA21', 'BB', 'VOL', 'MACD']} />}
      </Panel>
      <Panel title="ORDER BOOK · TRADES" right={<span className="muted">100ms</span>}>
        <Book book={book} />
        <h3 className="sub">TIME &amp; SALES</h3>
        <table className="grid-t"><tbody>
          {trades.slice(0, 14).map((x) => <tr key={x.t + '' + x.p + x.q}><td className={x.sell ? 'dn' : 'up'}>{fmt(x.p, x.p < 10 ? 4 : 2)}</td><td>{fmt(x.q, 4)}</td><td className="muted">{new Date(x.t).toLocaleTimeString('en-GB')}</td></tr>)}
        </tbody></table>
      </Panel>
    </>
  );
}
