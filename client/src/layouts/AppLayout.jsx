import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { NAV } from '../lib/constants.js';
import { api } from '../services/api.js';
import { RouteLoader } from '../components/RouteLoader.jsx';

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [booting, setBooting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    setBooting(true);
    const timer = setTimeout(() => setBooting(false), 980);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    let timer;
    async function load() {
      try {
        setHealth(await api.health());
      } catch {
        setHealth(null);
      }
    }
    load();
    timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const ai = health?.ai;

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex min-h-screen">
        <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 z-30 flex w-60 flex-col border-r border-border bg-[#EFE4D6] transition-transform duration-200 md:static md:translate-x-0`}>
          <button className="px-4 py-5 text-left" onClick={() => navigate('/app')}>
            <span className="block text-sm font-semibold tracking-[0.22em] text-text">AURA</span>
            <span className="mt-1 block h-0.5 w-10 rounded-full bg-accent" />
          </button>
          <nav className="flex flex-1 flex-col gap-1 px-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-surface text-text shadow-sm' : 'text-muted hover:bg-surface/70 hover:text-text'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-2 border-t border-border px-4 py-3 text-xs">
            <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${health?.ok ? 'bg-success' : 'bg-critical'}`} /> System {health?.ok ? 'Operational' : 'Unreachable'}</div>
            <div className="text-muted">AI {ai?.provider || '—'} · {ai?.model || '—'}</div>
            <div className="text-muted">{ai?.mode || 'checking'}</div>
          </div>
        </aside>
        {open ? <button className="fixed inset-0 z-20 bg-black/10 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border bg-surface/80 px-4 py-3 md:hidden">
            <button className="rounded-md border border-border bg-surface px-2 py-1 text-sm" onClick={() => setOpen(true)} aria-label="Open navigation">Menu</button>
            <span className="text-sm font-semibold tracking-[0.18em]">AURA</span>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
          {booting ? <RouteLoader /> : null}
        </div>
      </div>
    </div>
  );
}
