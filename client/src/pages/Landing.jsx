import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal.jsx';

const NAV = [
  { href: '#product', label: 'Product' },
  { href: '#how', label: 'How It Works' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#safety', label: 'Safety' },
];

const CAPABILITIES = [
  ['01', 'Understand', 'AURA reads the incident description and determines what needs to be investigated.'],
  ['02', 'Investigate', 'It dynamically selects appropriate investigation tools and gathers evidence.'],
  ['03', 'Connect', 'It correlates signals across services, logs, databases, APIs, queues, and deployments.'],
  ['04', 'Diagnose', 'It compares hypotheses, names a likely primary cause, and separates secondary and unrelated signals.'],
  ['05', 'Remediate', 'It writes a remediation plan and waits for a person before any impactful change.'],
  ['06', 'Verify', 'After a change, it re-checks the system and keeps going if problems remain.'],
];

const LOOP = [
  ['Perceive', 'Understand the incident and the evidence already available.'],
  ['Plan', 'Decide what still needs to be investigated.'],
  ['Investigate', 'Select and run the relevant read-only tools.'],
  ['Reason', 'Compare evidence and competing hypotheses.'],
  ['Act', 'Apply only the remediation a person approved.'],
  ['Verify', 'Measure whether the system actually recovered.'],
  ['Adapt', 'Continue when recovery is only partial.'],
];

const CASES = ['Payment failures', 'Authentication failures', 'Order processing', 'Notification delays', 'Database degradation', 'API outages', 'Infrastructure anomalies', 'Custom incidents'];

export function Landing() {
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function closeMenu() {
    setMenu(false);
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className={`sticky top-0 z-40 transition-colors duration-200 ${solid ? 'border-b border-border bg-bg/90 backdrop-blur' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <a href="#top" className="text-sm font-semibold tracking-[0.18em]">AURA</a>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Page">
            {NAV.map((item) => <a key={item.href} href={item.href} className="hover:text-text">{item.label}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/signin" className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-text">Sign In</Link>
            <Link to="/app?intake=1" className="landing-primary">Try Demo</Link>
          </div>
          <button type="button" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm md:hidden" aria-expanded={menu} aria-label="Open menu" onClick={() => setMenu((value) => !value)}>Menu</button>
        </div>
        {menu ? (
          <nav className="space-y-1 border-t border-border bg-surface px-4 py-3 md:hidden" aria-label="Mobile">
            {NAV.map((item) => <a key={item.href} href={item.href} className="block rounded-md px-2 py-2 text-sm" onClick={closeMenu}>{item.label}</a>)}
            <Link to="/signin" className="block rounded-md px-2 py-2 text-sm" onClick={closeMenu}>Sign In</Link>
            <Link to="/app?intake=1" className="landing-primary mt-2 w-full" onClick={closeMenu}>Try Demo</Link>
          </nav>
        ) : null}
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-accent">AUTONOMOUS INCIDENT RESPONSE</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Your systems fail.<br />AURA responds.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">An autonomous AI first responder that investigates incidents, connects the evidence, identifies root causes, safely executes remediation, and verifies recovery.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/app?intake=1" className="landing-primary">Try Demo Mode <span className="cta-arrow">→</span></Link>
              <Link to="/signin" className="landing-secondary">Sign In</Link>
            </div>
            <p className="mt-4 text-xs text-muted">Built for investigation · remediation · verification</p>
          </div>
          <HeroFlow />
        </section>

        <section id="product" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">Incident response shouldn't start with 14 browser tabs.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">An alert usually starts a manual tour of dashboards, logs, APIs, databases, queues, and recent deploys. AURA takes the incident and does that investigation as one system.</p>
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Reveal>
                <FlowCard title="Traditional incident response" steps={['Alert', 'Dashboard', 'Logs', 'Database', 'Search', 'Hypothesis', 'Fix', 'Verify']} muted />
              </Reveal>
              <Reveal delay={80}>
                <FlowCard title="With AURA" steps={['Incident', 'Investigate', 'Correlate', 'Diagnose', 'Remediate', 'Verify']} />
              </Reveal>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">From incident description to verified recovery.</h2>
            </Reveal>
            <ol className="mt-10 divide-y divide-border border-y border-border">
              {CAPABILITIES.map(([number, title, body], index) => (
                <Reveal key={number} delay={index * 40}>
                  <li className="grid gap-2 py-5 md:grid-cols-[4rem_12rem_1fr] md:items-baseline">
                    <span className="font-mono text-xs text-accent">{number}</span>
                    <h3 className="text-base font-medium">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">It doesn't just answer.<br />It investigates.</h2>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map(([title, body], index) => (
                <Reveal key={title} delay={index * 40}>
                  <li className="h-full border-t-2 border-accent/70 pt-3">
                    <div className="text-xs text-muted">{String(index + 1).padStart(2, '0')}</div>
                    <h3 className="mt-1 text-sm font-semibold tracking-wide">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">One incident can hide multiple problems.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">Example, not a fixed template: “Customers are experiencing payment failures, checkout is slow, and some notifications are delayed.”</p>
            </Reveal>
            <ol className="mt-8 max-w-lg space-y-3">
              {[
                ['Primary root cause', 'Database connection exhaustion'],
                ['Secondary effect', 'Payment API degradation'],
                ['Downstream impact', 'Checkout queue backlog'],
                ['Downstream impact', 'Notification delays'],
              ].map(([kind, title]) => (
                <li key={title} className="rounded-md border border-border bg-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted">{kind}</div>
                  <div className="mt-1 text-sm">{title}</div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">An unrelated signal, such as a steady CPU reading, is kept separate and is not treated as the cause.</p>
          </div>
        </section>

        <section id="safety" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">Autonomous doesn't mean uncontrolled.</h2>
              <p className="mt-4 max-w-2xl text-sm text-muted">Read-only investigation runs on its own. Changes that affect the system wait for a person. Destructive actions are refused.</p>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <SafetyCard title="Read" state="Automatic" items={['Metrics', 'Logs', 'Health checks', 'Database inspection', 'Queue inspection']} />
              <SafetyCard title="Write" state="Requires approval" items={['Configuration changes', 'Scaling', 'Restarting services', 'Remediation actions']} />
              <SafetyCard title="Destructive" state="Blocked" items={['Delete records', 'Irreversible actions', 'Unsafe operations']} />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">Fixing the symptom isn't enough.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">After a change, AURA reads the system again: errors, latency, service health, the database, queues, and whatever symptoms are still open. Healthy becomes resolved. Remaining problems become adaptation. Thin evidence becomes an escalation.</p>
            </Reveal>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-4 text-sm">
                <div className="text-xs uppercase text-muted">Before</div>
                <p className="mt-2">Error rate high</p>
                <p>Latency high</p>
                <p>DB utilization high</p>
              </div>
              <div className="rounded-md border border-success/40 bg-surface p-4 text-sm">
                <div className="text-xs uppercase text-success">After</div>
                <p className="mt-2">Error rate normal</p>
                <p>Latency normal</p>
                <p>DB utilization normal</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">System recovery verified</p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">See the investigation unfold.</h2>
            </Reveal>
            <div className="mt-8 grid gap-3 rounded-lg border border-border bg-surface p-3 md:grid-cols-[0.8fr_1.2fr_0.9fr]">
              <PreviewColumn title="Incident" lines={['Payment failures', 'Discovered problems', 'Investigation plan']} />
              <PreviewColumn title="Activity" lines={['Tool execution', 'Approval', 'Remediation', 'Verification']} />
              <PreviewColumn title="Evidence" lines={['Root cause', 'Confidence', 'Signals', 'Problem graph']} />
            </div>
            <Link to="/app?intake=1" className="landing-primary mt-6 inline-flex">Explore AURA Demo <span className="cta-arrow">→</span></Link>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Example incidents</h2>
            <p className="mt-3 max-w-2xl text-sm text-muted">Start with a real incident. AURA investigates using the evidence and tools available to it. These examples are not a limit.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {CASES.map((item) => <li key={item} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-24 md:px-6">
            <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight">When something breaks, don't start searching. Start with AURA.</h2>
            <p className="mt-4 max-w-xl text-sm text-muted">Give AURA the incident. Let it investigate, reason, act safely, and verify the recovery.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/app?intake=1" className="landing-primary">Try Demo Mode <span className="cta-arrow">→</span></Link>
              <Link to="/signin" className="landing-secondary">Sign In</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function HeroFlow() {
  const nodes = ['Metrics', 'Logs', 'Database', 'API health', 'Queue', 'Changes'];
  return (
    <div className="rounded-lg border border-border bg-surface p-5" aria-hidden="true">
      <div className="grid grid-cols-3 gap-2">
        {nodes.map((node, index) => (
          <div key={node} className="hero-node rounded-md border border-border px-2 py-2 text-center text-xs" style={{ animationDelay: `${index * 180}ms` }}>{node}</div>
        ))}
      </div>
      <div className="my-4 h-px bg-border" />
      <ol className="space-y-2 text-sm">
        {['Incident received', 'Investigating', 'Root cause identified', 'Recovery verified'].map((step, index) => (
          <li key={step} className="hero-step flex items-center gap-2" style={{ animationDelay: `${900 + index * 280}ms` }}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] text-muted">Illustrative sequence. Not a live investigation.</p>
    </div>
  );
}

function FlowCard({ title, steps, muted = false }) {
  return (
    <div className={`h-full rounded-lg border p-5 ${muted ? 'border-border bg-surface/70' : 'border-accent/30 bg-surface'}`}>
      <h3 className="text-sm font-medium">{title}</h3>
      <ol className="mt-4 space-y-2 text-sm text-muted">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}

function SafetyCard({ title, state, items }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1 text-xs uppercase tracking-wide text-accent">{state}</p>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

function PreviewColumn({ title, lines }) {
  return (
    <div className="rounded-md bg-bg p-3">
      <h3 className="text-xs uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {lines.map((line) => <li key={line} className="border-b border-border pb-2 last:border-0">{line}</li>)}
      </ul>
    </div>
  );
}
