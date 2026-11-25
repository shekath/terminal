import { useMemo, useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import Chart from './Chart.jsx';
import { api, stockHistory } from '../api.js';
import { fmt, pct, tone, sma } from '../util.js';

const RANGES = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24 };

export default function PriceChart({ symbol }) {
  const [range, setRange] = useState('1Y');
  const [style, setStyle] = useState('candle');
  const hist = useAsync(() => stockHistory(symbol, RANGES[range]), [symbol, range]);
  const w52 = useAsync(() => api(`52w/${symbol}`), [symbol]);
  const rows = hist.data || [];
  const last = rows.at(-1), prev = rows.at(-2);

  const series = useMemo(() => {
    if (!rows.length) return [];
    const t = rows.map((r) => r.date), c = rows.map((r) => r.close);
    const line = (vals, color) => ({ type: 'line', data: vals.map((v, i) => ({ time: t[i], value: v })).filter((p) => p.value != null), options: { color, lineWidth: 1 } });
    return [
      style === 'candle'
        ? { type: 'candle', data: rows.map((r) => ({ time: r.date, open: r.open, high: r.high, low: r.low, close: r.close })), options: { upColor: '#3DD68C', downColor: '#FF6B6B', borderVisible: false, wickUpColor: '#3DD68C', wickDownColor: '#FF6B6B' } }
        : { type: 'area', data: rows.map((r) => ({ time: r.date, value: r.close })), options: { lineColor: '#F5A524', topColor: 'rgba(245,165,36,.25)', bottomColor: 'rgba(245,165,36,0)', lineWidth: 2 } },
      line(sma(c, 20), '#5B8DEF'),
      line(sma(c, 50), '#C084FC'),
      { type: 'histogram', scale: 'vol', data: rows.map((r) => ({ time: r.date, value: r.volume, color: r.close >= r.open ? 'rgba(61,214,140,.35)' : 'rgba(255,107,107,.35)' })) },
    ];
  }, [rows, style]);

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
        <span className="sep" />
        <button className={style === 'candle' ? 'on' : ''} onClick={() => setStyle('candle')}>Candles</button>
        <button className={style === 'area' ? 'on' : ''} onClick={() => setStyle('area')}>Line</button>
        <span className="legend"><i style={{ background: '#5B8DEF' }} />SMA 20 <i style={{ background: '#C084FC' }} />SMA 50</span>
      </div>
      <Status s={hist} />
      {series.length > 0 && <Chart series={series} height={420} />}
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
