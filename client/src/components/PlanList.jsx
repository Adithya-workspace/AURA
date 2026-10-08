export function PlanList({ plan }) {
  if (!plan?.length) return <p className="text-sm text-muted">The plan appears when the agent starts.</p>;
  return (
    <ol className="space-y-2">
      {plan.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-sm">
          <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border text-[10px] ${item.done ? 'border-success text-success' : 'border-border text-muted'}`}>{item.done ? '✓' : ''}</span>
          <span>{item.title}</span>
        </li>
      ))}
    </ol>
  );
}
