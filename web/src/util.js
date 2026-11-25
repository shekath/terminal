export const fmt = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = (n) => (n == null || isNaN(n) ? '—' : `${n >= 0 ? '▲ +' : '▼ '}${Number(n).toFixed(2)}%`);
export const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : '');
export function sma(values, n) {
  const out = []; let s = 0;
  values.forEach((v, i) => { s += v; if (i >= n) s -= values[i - n]; out.push(i >= n - 1 ? s / n : null); });
  return out;
}
