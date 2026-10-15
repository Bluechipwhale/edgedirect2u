'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function EmailVerificationForm({ tokenHash, type, next }: { tokenHash: string; type: 'email' | 'signup' | 'recovery'; next: string }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.history.replaceState(null, '', '/auth/verify'); }, []);
  const recovery = type === 'recovery';
  return <div className="container narrow-page auth-page">
    <span className="auth-icon"><ShieldCheck /></span><span className="eyebrow muted">ONE SECURE STEP</span>
    <h1>{recovery ? 'Let’s reset your password.' : 'Confirm your email.'}</h1>
    <p>{recovery ? 'Continue below to verify your recovery link and choose a new password.' : 'Confirm that this is your email address to finish setting up your account.'}</p>
    <form action="/auth/confirm" method="post" className="form-panel" onSubmit={() => setBusy(true)}>
      <input type="hidden" name="token_hash" value={tokenHash} /><input type="hidden" name="type" value={type} /><input type="hidden" name="next" value={next} />
      <p>Your link is used only when you press the button below.</p>
      <button className="button" disabled={busy}>{busy ? 'Verifying your link…' : recovery ? 'Continue securely' : 'Verify my email'}<ArrowRight size={17} /></button>
    </form>
    <Link className="text-button" href="/login">Already finished? Sign in →</Link>
  </div>;
}
