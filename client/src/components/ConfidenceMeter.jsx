import { useEffect, useState } from 'react';

export function ConfidenceMeter({ value }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(Math.max(0, Math.min(100, Number(value) || 0))));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  if (value === null || value === undefined) return <p className="text-sm text-muted">Waiting for analysis.</p>;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted">Confidence</span>
        <span className="font-mono text-sm">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function useTween(value) {
  const [shown, setShown] = useState(value || 0);
  useEffect(() => {
    if (value === undefined || value === null) return undefined;
    const from = shown;
    const to = Number(value);
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 200);
      setShown(from + (to - from) * t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}
