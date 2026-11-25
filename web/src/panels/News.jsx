import { useState } from 'react';
import Panel, { useAsync, Status } from './Panel.jsx';
import { api } from '../api.js';

const TOPICS = ['markets', 'india', 'economy', 'crypto', 'shipping', 'all'];
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export function NewsList({ topic, limit = 80, filter = '' }) {
  const s = useAsync(() => api(`news?topic=${topic}`), [topic]);
  const items = (s.data?.items || []).filter((i) => !filter || i.title.toLowerCase().includes(filter.toLowerCase())).slice(0, limit);
  return (
    <>
      <Status s={s} />
      <ul className="news">
        {items.map((i) => (
          <li key={i.link}><a href={i.link} target="_blank" rel="noopener noreferrer">
            <span className="nmeta">{ago(i.time)} · {i.source}</span><span className="ntitle">{i.title}</span></a></li>))}
      </ul>
      {s.data?.failed?.length > 0 && <p className="muted small">Unavailable: {s.data.failed.join(', ')}</p>}
    </>
  );
}

export default function News() {
  const [topic, setTopic] = useState('markets');
  const [q, setQ] = useState('');
  return (
    <Panel span={4} title="N · NEWS WIRE" right={<div className="toolbar inline">{TOPICS.map((t) => <button key={t} className={t === topic ? 'on' : ''} onClick={() => setTopic(t)}>{t.toUpperCase()}</button>)}</div>}>
      <label className="search"><span className="muted">Filter headlines</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. RBI, oil, bitcoin" /></label>
      <NewsList topic={topic} filter={q} />
      <p className="muted small">Headlines link to the publisher. Sources: public RSS feeds.</p>
    </Panel>
  );
}
