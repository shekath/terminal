import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { sma, ema, rsi, macd, bollinger, pts } from '../util.js';

const BASE = {
  layout: { background: { color: 'transparent' }, textColor: '#8A94A0', fontFamily: 'IBM Plex Mono', fontSize: 11 },
  grid: { vertLines: { color: '#161B21' }, horzLines: { color: '#161B21' } },
  rightPriceScale: { borderColor: '#232A33', minimumWidth: 70 },
  timeScale: { borderColor: '#232A33' },
  crosshair: { mode: CrosshairMode.Normal },
};
export const STUDIES = ['SMA20', 'SMA50', 'SMA200', 'EMA21', 'BB', 'VOL', 'RSI', 'MACD'];

// rows: [{ time, open, high, low, close, volume }]  live: latest bar to upsert (realtime feeds)
export default function AdvancedChart({ rows, live, height = 420, intraday = false, defaults = ['SMA20', 'SMA50', 'VOL'] }) {
  const [on, setOn] = useState(new Set(defaults));
  const [type, setType] = useState('candle');
  const [legend, setLegend] = useState(null);
  const main = useRef(null), rsiEl = useRef(null), macdEl = useRef(null);
  const refs = useRef({});

  useEffect(() => {
    if (!rows?.length) return;
    const t = rows.map((r) => r.time), c = rows.map((r) => r.close);
    const opts = { ...BASE, timeScale: { ...BASE.timeScale, timeVisible: intraday, secondsVisible: false }, autoSize: true };
    const chart = createChart(main.current, { ...opts, height });
    const charts = [chart];
    const price = type === 'candle'
      ? chart.addCandlestickSeries({ upColor: '#3DD68C', downColor: '#FF6B6B', borderVisible: false, wickUpColor: '#3DD68C', wickDownColor: '#FF6B6B' })
      : chart.addAreaSeries({ lineColor: '#F5A524', topColor: 'rgba(245,165,36,.25)', bottomColor: 'rgba(245,165,36,0)', lineWidth: 2 });
    price.setData(type === 'candle' ? rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })) : rows.map((r) => ({ time: r.time, value: r.close })));
    const line = (vals, color, w = 1) => chart.addLineSeries({ color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(pts(t, vals));
    if (on.has('SMA20')) line(sma(c, 20), '#5B8DEF');
    if (on.has('SMA50')) line(sma(c, 50), '#C084FC');
    if (on.has('SMA200')) line(sma(c, 200), '#FF8A65');
    if (on.has('EMA21')) line(ema(c, 21), '#4FC3F7');
    if (on.has('BB')) { const b = bollinger(c); line(b.upper, '#8A94A0'); line(b.mid, '#5C6670'); line(b.lower, '#8A94A0'); }
    let vol = null;
    if (on.has('VOL')) {
      vol = chart.addHistogramSeries({ priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(rows.map((r) => ({ time: r.time, value: r.volume || 0, color: r.close >= r.open ? 'rgba(61,214,140,.35)' : 'rgba(255,107,107,.35)' })));
    }
    if (on.has('RSI')) {
      const rc = createChart(rsiEl.current, { ...opts, height: 110 }); charts.push(rc);
      const s = rc.addLineSeries({ color: '#F5A524', lineWidth: 1, priceLineVisible: false });
      s.setData(pts(t, rsi(c)));
      s.createPriceLine({ price: 70, color: '#FF6B6B', lineStyle: 2, axisLabelVisible: false });
      s.createPriceLine({ price: 30, color: '#3DD68C', lineStyle: 2, axisLabelVisible: false });
    }
    if (on.has('MACD')) {
      const mc = createChart(macdEl.current, { ...opts, height: 110 }); charts.push(mc);
      const m = macd(c);
      mc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }).setData(pts(t, m.hist).map((p) => ({ ...p, color: p.value >= 0 ? 'rgba(61,214,140,.6)' : 'rgba(255,107,107,.6)' })));
      mc.addLineSeries({ color: '#5B8DEF', lineWidth: 1, priceLineVisible: false }).setData(pts(t, m.line));
      mc.addLineSeries({ color: '#F5A524', lineWidth: 1, priceLineVisible: false }).setData(pts(t, m.signal));
    }
    // Keep sub-panes' time axes in step with the main chart.
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => r && charts.slice(1).forEach((x) => x.timeScale().setVisibleLogicalRange(r)));
    chart.subscribeCrosshairMove((p) => {
      const d = p?.seriesData?.get(price);
      setLegend(d ? { o: d.open ?? d.value, h: d.high, l: d.low, c: d.close ?? d.value } : null);
    });
    chart.timeScale().fitContent();
    refs.current = { price, vol, type };
    return () => charts.forEach((x) => x.remove());
  }, [rows, on, type, height, intraday]);

  // Realtime upsert of the forming bar.
  useEffect(() => {
    const { price, vol, type: ty } = refs.current;
    if (!live || !price) return;
    try {
      price.update(ty === 'candle' ? { time: live.time, open: live.open, high: live.high, low: live.low, close: live.close } : { time: live.time, value: live.close });
      vol?.update({ time: live.time, value: live.volume || 0, color: live.close >= live.open ? 'rgba(61,214,140,.35)' : 'rgba(255,107,107,.35)' });
    } catch { /* bar older than series end */ }
  }, [live]);

  const toggle = (s) => setOn((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const f = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: v < 10 ? 4 : 2 }));
  return (
    <div className="adv">
      <div className="toolbar">
        <button className={type === 'candle' ? 'on' : ''} onClick={() => setType('candle')}>Candles</button>
        <button className={type === 'area' ? 'on' : ''} onClick={() => setType('area')}>Line</button>
        <span className="sep" />
        {STUDIES.map((s) => <button key={s} className={on.has(s) ? 'on' : ''} onClick={() => toggle(s)} aria-pressed={on.has(s)}>{s}</button>)}
        {legend && <span className="legend">O {f(legend.o)} H {f(legend.h)} L {f(legend.l)} C {f(legend.c)}</span>}
      </div>
      <div ref={main} style={{ height }} />
      {on.has('RSI') && <><div className="pane-l">RSI 14</div><div ref={rsiEl} style={{ height: 110 }} /></>}
      {on.has('MACD') && <><div className="pane-l">MACD 12/26/9</div><div ref={macdEl} style={{ height: 110 }} /></>}
    </div>
  );
}
