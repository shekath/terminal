import { useMemo, useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import AdvancedChart from './AdvancedChart.jsx';
import { api, stockHistory } from '../api.js';
import { fmt, pct, tone } from '../util.js';

const RANGES = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24 };

export default function PriceChart({ symbol }) {
  const [range, setRange] = useState('1Y');
  const hist = useAsync(() => stockHistory(symbol, RANGES[range]), [symbol, range]);
  const w52 = useAsync(() => api(`52w/${symbol}`), [symbol]);
  const rows = hist.data || [];
  const last = rows.at(-1), prev = rows.at(-2);

  const bars = useMemo(() => rows.map((r) => ({ time: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume })), [rows]);

  const chg = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;
  const w = w52.data || {};
  return (
    <Panel span={4} title={`GP · ${symbol} · PRICE CHART`} right={<span className="muted">NSE bhavcopy · daily · unadjusted</span>}>
      <div className="quote-line">
        <span className="big">{fmt(last?.close)}</span>
        <span className={tone(chg)}>{pct(chg)}</span>
        <span className="muted">O {fmt(last?.open)} H {fmt(last?.high)} L {fmt(last?.low)} · Vol {fmt(last?.volume, 0)} · {last?.date}</span>
      </div>
      <div className="toolbar">
        {Object.keys(RANGES).map((r) => <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}
      </div>
      <Status s={hist} />
      {bars.length > 0 && <AdvancedChart rows={bars} height={400} defaults={['SMA20', 'SMA50', 'VOL', 'RSI']} />}
      <div className="stats">
        <div><span>52W HIGH</span><b>{fmt(w['52w_high'])}</b><em>{w['52w_high_date']}</em></div>
        <div><span>52W LOW</span><b>{fmt(w['52w_low'])}</b><em>{w['52w_low_date']}</em></div>
        <div><span>IN RANGE</span><b>{fmt(w.position_in_range_pct, 1)}%</b></div>
        <div><span>FROM HIGH</span><b className={tone(w.from_52w_high_pct)}>{pct(w.from_52w_high_pct)}</b></div>
        <div><span>FROM LOW</span><b className={tone(w.from_52w_low_pct)}>{pct(w.from_52w_low_pct)}</b></div>
      </div>
    </Panel>
  );
}
