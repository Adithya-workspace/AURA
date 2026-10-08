import { COMPARE_KEY } from '../lib/constants.js';
import { useState } from 'react';
import { Button } from './ui.jsx';

const STEPS = ['Incident', 'Understand', 'Plan', 'Investigate', 'Discover', 'Correlate', 'Reason', 'Act', 'Verify', 'Adapt', 'Resolve'];

export function ChatbotVsAura() {
  const [hidden, setHidden] = useState(() => localStorage.getItem(COMPARE_KEY) === '1');
  if (hidden) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Why AURA?</h2>
          <p className="mt-1 text-sm text-muted">A chatbot answers a question. AURA takes an incident and works it until the system is healthy or a human has to take over.</p>
        </div>
        <Button variant="ghost" onClick={() => { localStorage.setItem(COMPARE_KEY, '1'); setHidden(true); }}>Dismiss</Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted">Chatbot</div>
          <p className="mt-2 text-sm">Question → Answer</p>
        </div>
        <div>
          <div className="text-xs uppercase text-muted">AURA</div>
          <p className="mt-2 text-sm">{STEPS.join(' → ')}</p>
        </div>
      </div>
    </section>
  );
}
