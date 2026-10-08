import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/format.js';
import { Badge } from './ui.jsx';

export function ActivityFeed({ items }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!paused && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [items, paused]);
  return (
    <div
      ref={ref}
      className="max-h-80 space-y-2 overflow-auto pr-1"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.length === 0 ? <p className="text-sm text-muted">Activity will stream here.</p> : null}
      {items.map((item) => (
        <div key={item.id} className="feed-row flex items-start gap-2 text-xs">
          <time className="mt-0.5 shrink-0 font-mono text-muted">{formatTime(item.ts)}</time>
          {item.role ? <Badge>{item.role}</Badge> : null}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
