'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
export function PasswordForm({ reset = false, expired = false, email }: { reset?: boolean; expired?: boolean; email?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  return <div className="container narrow-page auth-page">
    <span className="auth-icon">{reset ? <KeyRound /> : <Mail />}</span><span className="eyebrow muted">YOUR ACCOUNT</span>
    <h1>{reset ? 'A fresh start.' : 'Let’s get you back in.'}</h1>
    <p>{reset ? 'Choose a new password with at least 10 characters.' : 'Enter your email and we’ll send you a secure recovery link.'}</p>
    {reset && email && <p className="recovery-identity">Updating the password for <strong>{email}</strong></p>}
    {expired && <p className="info-message">This email link has expired or already been used. Request a new one below.</p>}
    {message ? <div className="form-panel"><p role="status">{message}</p><Link href="/login" className="button">{reset ? 'Sign in to your account' : 'Back to sign in'}<ArrowRight size={17} /></Link></div> :
      <form className="form-panel" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        if (reset && form.get('password') !== form.get('confirmation')) { setError('Your passwords don’t match.'); setBusy(false); return; }
        try {
          const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reset ? { action: 'update-password', password: form.get('password') } : { action: 'recover', email: form.get('email') }) });
          const data = await response.json(); if (!response.ok) throw new Error(data.error);
          setMessage(reset ? data.unchanged ? data.message : 'Your password has been updated. You can sign in with it now.' : data.message);
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this request'); } finally { setBusy(false); }
      }}>
        {reset ? <><label>New password<input name="password" type="password" required minLength={10} maxLength={100} autoComplete="new-password" /></label><label>Confirm new password<input name="confirmation" type="password" required minLength={10} maxLength={100} autoComplete="new-password" /></label></> : <label>Email address<input name="email" type="email" required autoComplete="email" /></label>}
        {error && <p className="error-message" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? 'One moment…' : reset ? 'Update password' : 'Send recovery link'}<ArrowRight size={17} /></button>
      </form>}
    <Link className="text-button" href="/login">← Back to sign in</Link>
  </div>;
}
