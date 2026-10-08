export function Button({ variant = 'primary', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-accent text-white shadow-sm hover:bg-[#c9653a] hover:-translate-y-px',
    secondary: 'border border-border bg-surface text-text hover:border-accent/40 hover:bg-subtle',
    danger: 'border border-critical bg-surface text-critical hover:bg-[#fff4f1]',
    ghost: 'text-muted hover:bg-subtle hover:text-text',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children }) {
  const styles = {
    neutral: 'bg-subtle text-muted',
    info: 'bg-[#fde8df] text-[#b85a32]',
    success: 'bg-[#eef8f0] text-success',
    warning: 'bg-[#fff6eb] text-warning',
    critical: 'bg-[#fff1f1] text-critical',
    read: 'bg-[#eef8f0] text-success',
    write: 'bg-[#fff6eb] text-warning',
    destructive: 'bg-[#fff1f1] text-critical',
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[tone] || styles.neutral}`}>{children}</span>;
}

export function Panel({ className = '', children, ...props }) {
  return <section className={`rounded-lg border border-border bg-surface/95 shadow-[0_10px_30px_rgba(27,58,75,0.04)] ${className}`} {...props}>{children}</section>;
}

export function StatusPill({ status }) {
  const tone = {
    HEALTHY: 'success',
    operational: 'success',
    resolved: 'success',
    succeeded: 'success',
    DEGRADED: 'warning',
    investigating: 'info',
    problems_discovered: 'warning',
    root_cause_identified: 'info',
    awaiting_approval: 'warning',
    remediating: 'info',
    verifying: 'info',
    adapting: 'warning',
    partially_resolved: 'warning',
    open: 'neutral',
    escalated: 'critical',
    failed: 'critical',
    interrupted: 'critical',
    DOWN: 'critical',
  }[status] || 'neutral';
  return <Badge tone={tone}>{String(status || 'unknown').replaceAll('_', ' ')}</Badge>;
}

export function StatCard({ label, value, hint }) {
  return (
    <Panel className="px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </Panel>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-subtle ${className}`} />;
}

export function EmptyState({ title, body, action }) {
  return (
    <Panel className="px-6 py-10 text-center">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Panel>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Panel className="px-6 py-8">
      <h2 className="text-base font-medium text-critical">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">{message || 'The request failed.'}</p>
      {onRetry ? <Button className="mt-4" variant="secondary" onClick={onRetry}>Retry</Button> : null}
    </Panel>
  );
}

export function CollapsibleSection({ title, children, defaultOpen = false }) {
  return (
    <details open={defaultOpen} className="group border-t border-border">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className="mr-2 text-muted group-open:hidden">▸</span>
        <span className="mr-2 hidden text-muted group-open:inline">▾</span>
        {title}
      </summary>
      <div className="expand px-3 pb-3">{children}</div>
    </details>
  );
}
