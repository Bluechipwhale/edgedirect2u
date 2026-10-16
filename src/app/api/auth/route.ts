import { NextResponse } from 'next/server';
import { authInput } from '@/lib/auth-validation';
import { configured, supabase } from '@/lib/server';
import { guard, failure } from '@/lib/http';
export async function POST(req: Request) {
  try {
    guard(req);
    if (!configured()) throw new Error('Connect Supabase to enable customer accounts. Local workspace mode is available for administration.');
    const body = await req.text();
    if (body.length > 15000) throw new Error('Request too large');
    const input = authInput.parse(JSON.parse(body));
    const db = await supabase();
    if (input.action === 'logout') {
      const { error } = await db.auth.signOut();
      if (error) throw new Error('Unable to sign out. Please try again.');
      return NextResponse.json({ ok: true });
    }
    // guard() verified this origin. Keep PKCE cookies and the callback on the
    // same deployment, even while a custom domain is still being connected.
    const origin = new URL(req.headers.get('origin')!).origin;
    if (input.action === 'recovery-session') {
      const { data: { user }, error: identityError } = await db.auth.getUser(input.access_token);
      if (identityError || !user || user.is_anonymous) throw new Error('Recovery link is invalid or expired');
      const { data, error } = await db.auth.setSession({ access_token: input.access_token, refresh_token: input.refresh_token });
      if (error || data.user?.id !== user.id) throw new Error('Recovery link is invalid or expired');
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (input.action === 'recover') {
      const { error } = await db.auth.resetPasswordForEmail(input.email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
      if (error) throw new Error('Unable to send a recovery email right now. Please try again later.');
      return NextResponse.json({ ok: true, message: 'If an account uses that email, a recovery link is on its way. Check your inbox and spam folder.' });
    }
    if (input.action === 'update-password') {
      const { data: { user } } = await db.auth.getUser();
      if (!user || user.is_anonymous) throw new Error('Authentication required');
      const { error } = await db.auth.updateUser({ password: input.password });
      if (error?.code === 'same_password') return NextResponse.json({ ok: true, unchanged: true, message: 'This password is already set for your account. You can sign in with it now, or request another reset to choose a different password.' }, { headers: { 'Cache-Control': 'private, no-store' } });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    const result = input.action === 'register'
      ? await db.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: `${origin}/auth/confirm${input.next === '/checkout' ? '?next=/checkout' : ''}` } })
      : await db.auth.signInWithPassword({ email: input.email, password: input.password });
    if (result.error) throw new Error(input.action === 'login' ? 'Unable to sign in. Check your email and password, or confirm your email first.' : result.error.message);
    if(result.data.session){
      const {error:accessError}=await db.rpc('business_claim_access');
      if(accessError)throw new Error('Signed in, but staff access could not be activated. Please try signing in again.');
      // An old customer record is linked only after this account has verified
      // ownership of the same unique email. No legacy password is used.
      // Imported history is optional account metadata: an outage here must not
      // prevent an otherwise valid customer from signing in or checking out.
      await db.rpc('claim_legacy_customer');
    }
    let redirect='/account';
    if(result.data.session&&result.data.user){const {data:profile}=await db.from('profiles').select('role').eq('id',result.data.user.id).single();redirect=profile?.role==='admin'||profile?.role==='operations'?'/admin':profile?.role==='driver'?'/driver':profile?.role==='merchant'?'/merchant':'/account';}
    if(result.data.session){const {data:business}=await db.rpc('business_context');if(business&&redirect==='/account')redirect='/staff';}
    if(redirect==='/account'&&result.data.session){const {data:workspaces}=await db.rpc('my_company_workspaces');if(workspaces?.length)redirect='/workspaces';}
    return NextResponse.json({ ok: true, confirmation: !result.data.session, redirect });
  } catch (error) { return failure(error); }
}
