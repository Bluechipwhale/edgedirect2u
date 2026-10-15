import { NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const destination = url.searchParams.get('next');
  const next = destination === '/reset-password' || destination === '/checkout' ? destination : '/account';
  if (configured()) {
    const db = await supabase();
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    if (code) {
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      const recovery = data && 'redirectType' in data && data.redirectType === 'recovery';
      if (!error) return NextResponse.redirect(new URL(recovery ? '/reset-password' : next, origin));
    } else if (tokenHash && (type === 'email' || type === 'signup' || type === 'recovery')) {
      const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : '/account', origin));
    }
  }
  return NextResponse.redirect(new URL('/forgot-password?expired=1', origin));
}
