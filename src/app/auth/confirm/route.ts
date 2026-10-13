import { NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  const next = url.searchParams.get('next') === '/reset-password' ? '/reset-password' : '/account';
  if (configured()) {
    const db = await supabase();
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    } else if (tokenHash && (type === 'email' || type === 'signup' || type === 'recovery')) {
      const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : '/account', origin));
    }
  }
  return NextResponse.redirect(new URL('/forgot-password?expired=1', origin));
}
