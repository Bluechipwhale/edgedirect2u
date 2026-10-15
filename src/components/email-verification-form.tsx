'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function EmailVerificationForm({ tokenHash, type, next }: { tokenHash: string; type: 'email' | 'signup' | 'recovery'; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { window.history.replaceState(null, '', '/auth/verify'); }, []);
  const recovery = type === 'recovery';
  return <div className="container narrow-page auth-page">
    <span className="auth-icon"><ShieldCheck /></span><span className="eyebrow muted">ONE SECURE STEP</span>
    <h1>{recovery ? 'Let’s reset your password.' : 'Confirm your email.'}</h1>
    <p>{recovery ? 'Continue below to verify your recovery link and choose a new password.' : 'Confirm that this is your email address to finish setting up your account.'}</p>
    <form action="/auth/confirm" method="post" className="form-panel" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('');
      try {
        // Fetch preserves the same-origin Origin header while no-referrer keeps
        // the private email link out of referrer headers.
        const response = await fetch('/auth/confirm', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token_hash: tokenHash, type, next }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.redirect !== '/reset-password?verified=1' && data.redirect !== '/auth/verified' && data.redirect !== '/auth/verified?next=/checkout') throw new Error('Unable to finish verification. Request a fresh link and try again.');
        window.location.assign(data.redirect);
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to verify your link. Please try again.'); setBusy(false); }
    }}>
      <input type="hidden" name="token_hash" value={tokenHash} /><input type="hidden" name="type" value={type} /><input type="hidden" name="next" value={next} />
      <p>Your link is used only when you press the button below.</p>
      {error && <div><p role="alert" className="error-message">{error}</p><Link href="/forgot-password" className="text-button">Request a new link →</Link></div>}
      <button className="button" disabled={busy}>{busy ? 'Verifying your link…' : recovery ? 'Continue securely' : 'Verify my email'}<ArrowRight size={17} /></button>
    </form>
    <Link className="text-button" href="/login">Already finished? Sign in →</Link>
  </div>;
}
