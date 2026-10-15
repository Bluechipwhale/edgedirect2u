import Link from 'next/link';
import { supabase, configured } from '@/lib/server';
import { PasswordForm } from '@/components/password-form';
export const metadata = { title: 'Update your password', robots: { index: false, follow: false } };
export default async function Page() {
  const user = configured() ? (await (await supabase()).auth.getUser()).data.user : null;
  if (!user || user.is_anonymous) return <div className="container narrow-page auth-page"><h1>Request a secure link.</h1><p>Open the recovery link in your email to choose a new password.</p><Link href="/forgot-password" className="button">Recover your account</Link></div>;
  return <PasswordForm reset email={user.email} />;
}
