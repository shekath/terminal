export const fmt = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = (n) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '▲ +' : '▼ '}${Number(n).toFixed(2)}%`);
export const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : '');
export function sma(values, n) {
  const out = []; let s = 0;
  values.forEach((v, i) => { s += v; if (i >= n) s -= values[i - n]; out.push(i >= n - 1 ? s / n : null); });
  return out;
}
export function ema(values, n) {
  const k = 2 / (n + 1); let prev = null;
  return values.map((v, i) => {
    if (v == null) return null;
    prev = prev == null ? v : v * k + prev * (1 - k);
    return i >= n - 1 ? prev : null;
  });
}
export function rsi(values, n = 14) {
  let g = 0, l = 0; const out = [null];
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up / n; l += dn / n; out.push(i === n ? 100 - 100 / (1 + g / (l || 1e-9)) : null); }
    else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out.push(100 - 100 / (1 + g / (l || 1e-9))); }
  }
  return out;
}
export function macd(values, f = 12, s = 26, sig = 9) {
  const a = ema(values, f), b = ema(values, s);
  const line = values.map((_, i) => (a[i] != null && b[i] != null ? a[i] - b[i] : null));
  const firstIdx = line.findIndex((v) => v != null);
  const sigLine = Array(values.length).fill(null);
  if (firstIdx >= 0) ema(line.slice(firstIdx), sig).forEach((v, j) => { sigLine[firstIdx + j] = v; });
  return { line, signal: sigLine, hist: line.map((v, i) => (v != null && sigLine[i] != null ? v - sigLine[i] : null)) };
}
export function bollinger(values, n = 20, k = 2) {
  const mid = sma(values, n);
  const sd = values.map((_, i) => {
    if (i < n - 1) return null;
    const w = values.slice(i - n + 1, i + 1), m = mid[i];
    return Math.sqrt(w.reduce((a, v) => a + (v - m) ** 2, 0) / n);
  });
  return { mid, upper: mid.map((m, i) => (m == null ? null : m + k * sd[i])), lower: mid.map((m, i) => (m == null ? null : m - k * sd[i])) };
}
export const pts = (times, vals) => vals.map((v, i) => ({ time: times[i], value: v })).filter((p) => p.value != null && isFinite(p.value));
