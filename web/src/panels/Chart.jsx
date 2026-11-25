import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

const BASE = {
  layout: { background: { color: 'transparent' }, textColor: '#8A94A0', fontFamily: 'IBM Plex Mono', fontSize: 11 },
  grid: { vertLines: { color: '#161B21' }, horzLines: { color: '#161B21' } },
  rightPriceScale: { borderColor: '#232A33' },
  timeScale: { borderColor: '#232A33' },
  crosshair: { mode: CrosshairMode.Normal },
};

// series: [{ type: 'candle'|'line'|'area'|'histogram'|'baseline', data, options, markers, scale }]
export default function Chart({ series, height = 300, compact = false }) {
  const el = useRef(null);
  useEffect(() => {
    const chart = createChart(el.current, {
      ...BASE, height, autoSize: true,
      ...(compact ? { timeScale: { visible: false }, rightPriceScale: { visible: true, borderColor: '#232A33' }, handleScroll: false, handleScale: false } : {}),
    });
    for (const s of series) {
      const add = { candle: 'addCandlestickSeries', line: 'addLineSeries', area: 'addAreaSeries', histogram: 'addHistogramSeries', baseline: 'addBaselineSeries' }[s.type];
      const ser = chart[add]({ priceLineVisible: false, lastValueVisible: !compact, ...s.options, ...(s.scale ? { priceScaleId: s.scale } : {}) });
      if (s.scale === 'vol') chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      ser.setData(s.data);
      if (s.markers) ser.setMarkers(s.markers);
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series, height, compact]);
  return <div ref={el} style={{ width: '100%', height }} />;
}
