'use client';
import { useEffect, useRef } from 'react';
import { authLanding } from '@/lib/auth-landing';

export function AuthLanding({ liveOrigin }: { liveOrigin?: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    const landing = authLanding(window.location.href, liveOrigin);
    if (!landing) return;
    started.current = true;
    if (landing.kind === 'redirect') {
      window.location.replace(landing.href);
      return;
    }
    // Fragments are never sent to a server as a URL. Remove them from browser
    // history before verifying the recovery session through our same-origin API.
    window.history.replaceState(null, '', window.location.pathname);
    fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recovery-session', access_token: landing.access_token, refresh_token: landing.refresh_token }),
    }).then(response => {
      window.location.replace(response.ok ? `/reset-password${landing.invited?'?invited=1':''}` : '/forgot-password?expired=1');
    }).catch(() => window.location.replace('/forgot-password?expired=1'));
  }, [liveOrigin]);
  return null;
}
