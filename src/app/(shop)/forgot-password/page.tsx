import { PasswordForm } from '@/components/password-form';
export const metadata = { title: 'Recover your account', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  return <PasswordForm expired={(await searchParams).expired === '1'} />;
}
