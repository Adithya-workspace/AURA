const TONE = {
  root_cause: 'border-critical text-critical',
  downstream: 'border-warning text-warning',
  secondary: 'border-accent text-accent',
  unrelated: 'border-border text-muted',
};

export function ProblemGraph({ problems = [] }) {
  const visible = problems.filter((problem) => problem.type !== 'unrelated');
  if (!visible.length) return <p className="text-sm text-muted">No causal chain yet.</p>;
  return (
    <div className="space-y-2">
      {visible.map((problem, index) => (
        <div key={problem.id || problem.title}>
          <div className={`rounded-md border bg-surface px-3 py-2 ${TONE[problem.type] || TONE.secondary} ${problem.status === 'resolved' ? 'opacity-70' : ''}`}>
            <div className="text-[11px] uppercase tracking-wide">{problem.type?.replaceAll('_', ' ')}</div>
            <div className="text-sm text-text">{problem.title}</div>
            <div className="text-xs text-muted">{problem.status === 'resolved' ? 'Resolved' : 'Unresolved'}</div>
          </div>
          {index < visible.length - 1 ? <div className="py-1 text-center text-xs text-muted">↓</div> : null}
        </div>
      ))}
    </div>
  );
}
