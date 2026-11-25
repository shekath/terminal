import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { feature, mesh } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import Panel from './Panel.jsx';
import { NewsList } from './News.jsx';
import { fmt } from '../util.js';

// Major container ports (approx. annual TEU, millions) and maritime chokepoints.
const PORTS = [
  ['Shanghai', 31.23, 121.47, 49], ['Singapore', 1.26, 103.84, 39], ['Ningbo-Zhoushan', 29.87, 121.55, 35], ['Shenzhen', 22.5, 113.9, 30],
  ['Qingdao', 36.07, 120.32, 28], ['Guangzhou', 23.1, 113.6, 25], ['Busan', 35.1, 129.04, 23], ['Tianjin', 38.98, 117.75, 22],
  ['Hong Kong', 22.3, 114.17, 14], ['Rotterdam', 51.95, 4.14, 13], ['Dubai (Jebel Ali)', 25.01, 55.06, 14], ['Port Klang', 3.0, 101.39, 14],
  ['Antwerp-Bruges', 51.26, 4.4, 13], ['Xiamen', 24.45, 118.07, 12], ['Los Angeles', 33.74, -118.26, 9], ['Long Beach', 33.75, -118.2, 9],
  ['Tanjung Pelepas', 1.36, 103.55, 11], ['Hamburg', 53.54, 9.97, 8], ['New York-New Jersey', 40.67, -74.04, 8], ['Laem Chabang', 13.08, 100.88, 9],
  ['Colombo', 6.95, 79.84, 7], ['Mundra', 22.74, 69.7, 7], ['JNPT (Nhava Sheva)', 18.95, 72.95, 7], ['Tanger Med', 35.89, -5.5, 8],
  ['Piraeus', 37.94, 23.62, 5], ['Santos', -23.98, -46.3, 5], ['Jeddah', 21.48, 39.17, 5], ['Salalah', 16.94, 54.0, 4],
];
const CHOKEPOINTS = [
  ['Strait of Malacca', 2.5, 101.3], ['Suez Canal', 30.6, 32.33], ['Bab-el-Mandeb', 12.6, 43.4], ['Strait of Hormuz', 26.57, 56.25],
  ['Panama Canal', 9.08, -79.68], ['Strait of Gibraltar', 35.95, -5.6], ['Dover Strait', 51.0, 1.45], ['Cape of Good Hope', -34.36, 18.47],
  ['Taiwan Strait', 24.5, 119.5], ['Bosphorus', 41.12, 29.07],
];
// Simplified main-line routes (illustrative great-circle-ish waypoints, not vessel tracks).
const LANES = [
  { name: 'Asia – Europe via Suez', color: '#F5A524', pts: [[31.2, 122], [22, 115], [10, 109], [1.3, 104], [5.5, 95], [6, 80], [12.5, 52], [12.6, 43.4], [20, 38.5], [27.5, 34], [30.6, 32.3], [33, 28], [36, 15], [36, -5.6], [43, -10], [49.5, -4], [51, 1.5], [51.9, 4.1]] },
  { name: 'Transpacific', color: '#5B8DEF', pts: [[31.2, 122], [33, 135], [38, 150], [42, 170], [44, -170], [42, -150], [37, -130], [33.7, -118.3]] },
  { name: 'Transatlantic', color: '#3DD68C', pts: [[51.9, 4.1], [50, -6], [47, -20], [43, -40], [41, -60], [40.6, -74]] },
  { name: 'Asia – US East Coast via Panama', color: '#C084FC', pts: [[31.2, 122], [25, 135], [20, 160], [15, -150], [12, -120], [8.5, -90], [9.1, -79.7], [15, -75], [25, -76], [35, -74], [40.6, -74]] },
  { name: 'Gulf – India – East Asia', color: '#FF8A65', pts: [[26.5, 56.3], [24, 60], [19, 70], [18.9, 72.9], [10, 76], [6, 80], [5.5, 95], [1.3, 104]] },
  { name: 'Europe – Asia via Cape', color: '#8A94A0', pts: [[51.9, 4.1], [43, -10], [30, -16], [10, -20], [-10, -5], [-34.4, 18.5], [-30, 40], [-10, 60], [0, 80], [5.5, 95], [1.3, 104]] },
];

// Keep longitudes continuous so routes crossing the date line don't wrap across the whole map.
const unwrap = (pts) => pts.reduce((out, [lat, lon]) => {
  const prev = out.at(-1)?.[1];
  while (prev != null && lon - prev > 180) lon -= 360;
  while (prev != null && prev - lon > 180) lon += 360;
  return [...out, [lat, lon]];
}, []);

export default function ShipMap() {
  const el = useRef(null), map = useRef(null), vesselLayer = useRef(null);
  const [ais, setAis] = useState({ status: 'loading', count: 0 });
  const [base, setBase] = useState('loading');
  const [layers, setLayers] = useState({ lanes: true, ports: true, choke: true, ships: true });
  const groups = useRef({});

  useEffect(() => {
    const m = L.map(el.current, { worldCopyJump: true, zoomControl: true, attributionControl: true });
    m.fitBounds([[-50, -125], [65, 150]]);
    // Base layer bundled with the app (Natural Earth, public domain), so the map renders even when tile servers are blocked.
    m.createPane('land'); m.getPane('land').style.zIndex = 250;
    L.geoJSON(feature(countries110, countries110.objects.land), { pane: 'land', interactive: false, style: { color: '#2A3542', weight: 0.6, fillColor: '#141B23', fillOpacity: 1 } }).addTo(m);
    L.geoJSON(mesh(countries110, countries110.objects.countries, (a, b) => a !== b), { pane: 'land', interactive: false, style: { color: '#263140', weight: 0.5 } }).addTo(m);
    // Detailed tiles on top when reachable; fall back to a second provider, then to the bundled base only.
    const providers = [
      ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }],
      ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }],
    ];
    let pi = 0, errors = 0, tiles;
    const useTiles = () => {
      tiles?.remove(); errors = 0;
      if (pi >= providers.length) { setBase('bundled outline (tile servers unreachable)'); return; }
      const [url, o] = providers[pi];
      tiles = L.tileLayer(url, { ...o, maxZoom: 12 }).addTo(m);
      tiles.on('tileload', () => setBase(pi === 0 ? 'CARTO dark' : 'Esri dark gray'));
      tiles.on('tileerror', () => { if (++errors >= 4) { pi += 1; useTiles(); } });
    };
    useTiles();
    // Leaflet measures its container once; re-measure after layout and on resize.
    setTimeout(() => m.invalidateSize(), 50);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    const lanes = L.layerGroup(LANES.map((l) => L.polyline(unwrap(l.pts), { color: l.color, weight: 2, opacity: 0.8, dashArray: '6 4' }).bindTooltip(l.name)));
    const ports = L.layerGroup(PORTS.map(([n, lat, lon, teu]) => L.circleMarker([lat, lon], { radius: 3 + Math.sqrt(teu) * 1.3, color: '#4FC3F7', weight: 1, fillOpacity: 0.35 }).bindPopup(`<b>${n}</b><br>~${teu}M TEU / year`)));
    const choke = L.layerGroup(CHOKEPOINTS.map(([n, lat, lon]) => L.marker([lat, lon], { icon: L.divIcon({ className: 'choke', html: '◆', iconSize: [14, 14] }) }).bindTooltip(n)));
    vesselLayer.current = L.layerGroup();
    groups.current = { lanes, ports, choke, ships: vesselLayer.current };
    Object.values(groups.current).forEach((g) => g.addTo(m));
    map.current = m;
    return () => { ro.disconnect(); m.remove(); };
  }, []);

  useEffect(() => {
    Object.entries(layers).forEach(([k, v]) => { const g = groups.current[k]; if (!g || !map.current) return; v ? g.addTo(map.current) : g.remove(); });
  }, [layers]);

  // Poll live AIS positions from the gateway.
  useEffect(() => {
    let live = true;
    const load = () => fetch('/api/ais').then((r) => r.json()).then((d) => {
      if (!live) return;
      setAis(d);
      const g = vesselLayer.current; g.clearLayers();
      d.vessels.forEach((v) => L.circleMarker([v.lat, v.lon], { radius: 2, color: v.sog > 1 ? '#3DD68C' : '#8A94A0', weight: 0, fillOpacity: 0.9 })
        .bindTooltip(`${v.name || 'MMSI ' + v.mmsi} · ${fmt(v.sog, 1)} kn`).addTo(g));
    }).catch(() => live && setAis({ status: 'unavailable', count: 0 }));
    load();
    const id = setInterval(load, 15000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const toggle = (k) => setLayers((s) => ({ ...s, [k]: !s[k] }));
  return (
    <>
      <Panel span={3} title="MAP · GLOBAL SHIPPING" right={<span className={ais.status === 'live' ? 'up' : 'muted'}>AIS: {ais.status} · {ais.count} vessels</span>}>
        <div className="toolbar">
          {[['lanes', 'Trade lanes'], ['ports', 'Top ports'], ['choke', 'Chokepoints'], ['ships', 'Live vessels']].map(([k, l]) => <button key={k} className={layers[k] ? 'on' : ''} onClick={() => toggle(k)} aria-pressed={layers[k]}>{l}</button>)}
          <span className="legend">{LANES.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name.split(' ')[0]}</span>)}</span>
        </div>
        <div ref={el} className="map" />
        {ais.status !== 'live' && ais.diag && (
          <p className="err small">AIS diagnostics: {ais.diag.lastError || 'no error reported'}{ais.diag.lastClose ? ` · closed ${ais.diag.lastClose.code} ${ais.diag.lastClose.reason}` : ''} · attempts {ais.diag.attempts}</p>
        )}
        <p className="muted small">Base map: {base}. Lanes are simplified main-line routes. Live vessels come from AIS receivers at major chokepoints when the server has an aisstream.io key.</p>
      </Panel>
      <Panel title="SHIPPING &amp; TRADE NEWS"><NewsList topic="shipping" limit={25} /></Panel>
    </>
  );
}
