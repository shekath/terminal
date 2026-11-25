export default function Panel({ title, right, children, span = 1, className = '' }) {
  return (
    <section className={`panel ${className}`} style={{ gridColumn: `span ${span}` }}>
      <header className="panel-h"><h2>{title}</h2>{right}</header>
      <div className="panel-b">{children}</div>
    </section>
  );
}
export function useAsync(fn, deps) {
  const [s, set] = useStateSafe();
  useEffectSafe(() => {
    let live = true;
    set({ loading: true });
    fn().then((data) => live && set({ data }), (error) => live && set({ error: error.message }));
    return () => { live = false; };
  }, deps);
  return s;
}
import { useEffect as useEffectSafe, useState } from 'react';
function useStateSafe() { return useState({ loading: true }); }
export function Status({ s }) {
  if (s.loading) return <div className="muted pad">Loading…</div>;
  if (s.error) return <div className="err pad">Data unavailable: {s.error}</div>;
  return null;
}
