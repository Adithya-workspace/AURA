const LETTERS = ['A', 'U', 'R', 'A'];

export function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-live="polite" aria-label="Loading page">
      <div className="flex items-end gap-3">
        {LETTERS.map((letter, index) => (
          <span key={`${letter}-${index}`} className="aura-letter" style={{ animationDelay: `${index * 110}ms` }}>
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
