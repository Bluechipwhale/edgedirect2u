import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { configured, supabase } from '@/lib/server';

export const metadata = { title: 'Email confirmed', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = configured() ? (await (await supabase()).auth.getUser()).data.user : null;
  if (!user || user.is_anonymous || !user.email_confirmed_at) redirect('/login');
  const checkout = (await searchParams).next === '/checkout';
  return <div className="container narrow-page auth-page"><span className="auth-icon"><CheckCircle2 /></span><span className="eyebrow muted">YOU’RE ALL SET</span><h1>Email confirmed.</h1><div className="form-panel"><p role="status">Your email is verified and you’re signed in. You can now continue {checkout ? 'to checkout' : 'to your account'}.</p><p className="recovery-identity">{user.email}</p><Link href={checkout ? '/checkout' : '/account'} className="button">{checkout ? 'Continue to checkout' : 'Open my account'}<ArrowRight size={17}/></Link></div></div>;
}
