import { redirect } from 'next/navigation';
import { emailVerification } from '@/lib/email-verification';
import { EmailVerificationForm } from '@/components/email-verification-form';

export const metadata = { title: 'Verify your secure link', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = emailVerification.safeParse(await searchParams);
  if (!input.success) redirect('/forgot-password?expired=1');
  return <EmailVerificationForm tokenHash={input.data.token_hash} type={input.data.type} next={input.data.next} />;
}
