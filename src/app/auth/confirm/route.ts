import { NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/server';
import { publicOrigin } from '@/lib/public-origin';
import { emailVerification } from '@/lib/email-verification';
import { guard } from '@/lib/http';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const destination = url.searchParams.get('next');
  const next = destination === '/reset-password' || destination === '/checkout' ? destination : '/account';
  if (configured()) {
    const code = url.searchParams.get('code');
    if (code && code.length <= 2000) {
      const db = await supabase();
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      const recovery = data && 'redirectType' in data && data.redirectType === 'recovery';
      if (!error) return NextResponse.redirect(new URL(recovery ? '/reset-password?verified=1' : `/auth/verified${next === '/checkout' ? '?next=/checkout' : ''}`, origin));
    } else {
      const input = emailVerification.safeParse(Object.fromEntries(url.searchParams));
      // Email scanners may follow GET links. Only an explicit form submission
      // consumes the single-use token and establishes the recipient's session.
      if (input.success) return NextResponse.redirect(new URL(`/auth/verify?${new URLSearchParams(input.data)}`, origin));
    }
  }
  return NextResponse.redirect(new URL('/forgot-password?expired=1', origin));
}

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  try {
    guard(request);
    if (!configured() || !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Error('Invalid verification request');
    const body = await request.text();
    if (body.length > 6000) throw new Error('Verification request is too large');
    const input = emailVerification.parse(Object.fromEntries(new URLSearchParams(body)));
    const { error } = await (await supabase()).auth.verifyOtp({ token_hash: input.token_hash, type: input.type });
    if (error) throw error;
    const destination = input.type === 'recovery' ? '/reset-password?verified=1' : `/auth/verified${input.next === '/checkout' ? '?next=/checkout' : ''}`;
    return NextResponse.redirect(new URL(destination, origin), 303);
  } catch {
    return NextResponse.redirect(new URL('/forgot-password?expired=1', origin), 303);
  }
}
