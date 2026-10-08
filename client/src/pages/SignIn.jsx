import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';

const SETUP = {
  google: 'Google authentication is not configured yet. Set GOOGLE_CLIENT_ID on the server, then restart it.',
  slack: 'Slack authentication is not configured yet. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI on the server.',
};

export function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const googleSlot = useRef(null);
  const [config, setConfig] = useState(null);
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (params.get('error')) setNotice('Slack did not complete sign-in. Nothing was signed in.');
    api.authConfig().then(setConfig).catch((error) => setNotice(error.message));
    api.me().then((body) => setUser(body.user)).catch(() => {});
  }, [params]);

  useEffect(() => {
    if (!config?.google) return undefined;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const slot = googleSlot.current;
      if (!window.google?.accounts?.id || !slot) return;
      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (response) => {
          try {
            const body = await api.googleSignIn(response.credential);
            setUser(body.user);
            navigate('/app');
          } catch (error) {
            setNotice(error.message);
          }
        },
      });
      slot.innerHTML = '';
      window.google.accounts.id.renderButton(slot, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
      });
    };
    script.onerror = () => setNotice('Google sign-in could not be loaded.');
    document.head.appendChild(script);
    return () => script.remove();
  }, [config, navigate]);

  async function slack() {
    setNotice('');
    try {
      const body = await api.slackStart();
      window.location.assign(body.url);
    } catch (error) {
      setNotice(error.code === 'not_configured' && import.meta.env.DEV ? SETUP.slack : error.message);
    }
  }

  function googleFallback() {
    setNotice(import.meta.env.DEV ? SETUP.google : 'Google sign-in is not available.');
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-text">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="text-sm font-semibold tracking-[0.18em]">AURA</Link>
        <section className="mt-10 rounded-lg border border-border bg-surface p-6 shadow-[0_16px_40px_rgba(27,58,75,0.06)]">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to AURA</h1>
          <p className="mt-2 text-sm text-muted">Sign in to access your incident workspace.</p>
          {user ? <p className="mt-4 text-sm">Signed in as {user.name}.</p> : null}
          <div className="mt-6 space-y-3">
            {config?.google ? <div ref={googleSlot} className="min-h-10" /> : (
              <button type="button" className="auth-choice" onClick={googleFallback}>Continue with Google</button>
            )}
            <div className="text-center text-xs uppercase tracking-wide text-muted">or</div>
            <button type="button" className="auth-choice" onClick={slack}>Continue with Slack</button>
          </div>
          {notice ? <p className="mt-4 text-sm text-critical" role="status">{notice}</p> : null}
          <Link to="/app?intake=1" className="mt-6 block text-center text-sm text-muted hover:text-text">Continue in demo mode without an account</Link>
        </section>
      </div>
    </main>
  );
}
