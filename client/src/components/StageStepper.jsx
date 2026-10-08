export function StageStepper({ stages }) {
  return (
    <ol className="space-y-0">
      {stages.map((stage, index) => (
        <li key={stage.id} className="grid grid-cols-[16px_1fr] gap-3">
          <div className="flex flex-col items-center">
            <span className={`mt-1 h-2.5 w-2.5 rounded-full border ${stage.status === 'active' ? 'pulse-dot border-accent bg-accent' : stage.status === 'done' ? 'border-success bg-success' : stage.status === 'failed' ? 'border-critical bg-critical' : stage.status === 'adapting' ? 'pulse-dot border-warning bg-warning' : 'border-border bg-surface'}`} />
            {index < stages.length - 1 ? <span className={`w-px flex-1 ${stage.status === 'done' ? 'bg-success' : 'bg-border'}`} /> : null}
          </div>
          <div className="pb-4">
            <div className="text-sm font-medium">{stage.label}</div>
            <div className="text-xs capitalize text-muted">{stage.status}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
