import { NextResponse } from 'next/server';
import { authInput } from '@/lib/auth-validation';
import { configured, supabase } from '@/lib/server';
import { guard, failure } from '@/lib/http';
export async function POST(req: Request) {
  try {
    guard(req);
    if (!configured()) throw new Error('Connect Supabase to enable customer accounts. Local workspace mode is available for administration.');
    const input = authInput.parse(await req.json());
    const db = await supabase();
    if (input.action === 'logout') {
      const { error } = await db.auth.signOut();
      if (error) throw new Error('Unable to sign out. Please try again.');
      return NextResponse.json({ ok: true });
    }
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
    if (input.action === 'recover') {
      const { error } = await db.auth.resetPasswordForEmail(input.email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
      if (error) throw new Error('Unable to send a recovery email right now. Please try again later.');
      return NextResponse.json({ ok: true, message: 'If an account uses that email, a recovery link is on its way. Check your inbox and spam folder.' });
    }
    if (input.action === 'update-password') {
      const { data: { user } } = await db.auth.getUser();
      if (!user || user.is_anonymous) throw new Error('Authentication required');
      const { error } = await db.auth.updateUser({ password: input.password });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    const result = input.action === 'register'
      ? await db.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: `${origin}/auth/confirm` } })
      : await db.auth.signInWithPassword({ email: input.email, password: input.password });
    if (result.error) throw new Error(input.action === 'login' ? 'Unable to sign in. Check your email and password, or confirm your email first.' : result.error.message);
    return NextResponse.json({ ok: true, confirmation: !result.data.session });
  } catch (error) { return failure(error); }
}
