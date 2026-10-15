type Landing = { kind: 'redirect'; href: string } | { kind: 'session'; access_token: string; refresh_token: string };
export function authLanding(href: string, liveOrigin?: string): Landing | null {
  const url = new URL(href);
  if (!['/', '/reset-password'].includes(url.pathname)) return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const recovery = hash.get('type') === 'recovery';
  const error = hash.get('error_code') === 'otp_expired' || url.searchParams.get('error_code') === 'otp_expired';
  if (error) return { kind: 'redirect', href: '/forgot-password?expired=1' };
  if (!code && !tokenHash && !recovery) return null;
  // Recover links issued before the dashboard Site URL is corrected. Only the
  // explicitly configured, trusted live deployment receives this handoff.
  if (liveOrigin && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    const live = new URL(liveOrigin);
    if (live.protocol === 'https:' && live.hostname === 'edgedirect2u.vercel.app') {
      return { kind: 'redirect', href: `${live.origin}/${url.search}${url.hash}` };
    }
  }
  if (code && code.length <= 2000) return { kind: 'redirect', href: `/auth/confirm?${new URLSearchParams({ code })}` };
  if (tokenHash && tokenHash.length <= 2000 && ['recovery', 'signup', 'email'].includes(type || '')) {
    return { kind: 'redirect', href: `/auth/confirm?${new URLSearchParams({ token_hash: tokenHash, type: type! })}` };
  }
  const access = hash.get('access_token'), refresh = hash.get('refresh_token');
  if (recovery && access && refresh && access.length <= 10000 && refresh.length <= 2000) {
    return { kind: 'session', access_token: access, refresh_token: refresh };
  }
  return { kind: 'redirect', href: '/forgot-password?expired=1' };
}
