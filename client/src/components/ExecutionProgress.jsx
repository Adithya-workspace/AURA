export function ExecutionProgress({ steps }) {
  if (!steps?.length) return null;
  return (
    <ol className="space-y-2 rounded-lg border border-border bg-surface p-3">
      {steps.map((step, index) => (
        <li key={`${step.step}-${index}`} className="feed-row flex items-center gap-2 text-sm">
          <span className="check grid h-4 w-4 place-items-center rounded-full bg-[#eef8f0] text-[10px] text-success">✓</span>
          {step.step}
        </li>
      ))}
    </ol>
  );
}
