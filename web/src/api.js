// Thin client for the gateway. In-memory memo avoids refetching within a session.
const memo = new Map();
export async function api(path) {
  if (memo.has(path)) return memo.get(path);
  const p = fetch(`/api/${path}`).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || r.statusText);
    return body;
  });
  memo.set(path, p);
  p.catch(() => memo.delete(path));
  return p;
}

// History arrives in 3-month (stock) / 12-month (index) chunks; stitch them.
export async function stockHistory(symbol, months = 12) {
  let end = 'today', rows = [];
  for (let left = months; left > 0; left -= 3) {
    const r = await api(`history/${encodeURIComponent(symbol)}?months=${Math.min(3, left)}&end=${end}`);
    rows = [...(r.data || []), ...rows];
    if (!r.next_end_date) break;
    end = r.next_end_date;
  }
  return dedupe(rows);
}
export async function indexHistory(name, months = 12) {
  const r = await api(`index-history?name=${encodeURIComponent(name)}&months=${Math.min(12, months)}`);
  return dedupe(r.data || []);
}
function dedupe(rows) {
  const m = new Map();
  rows.forEach((r) => m.set(r.date, r));
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}
