import { requireRole,localMode } from '@/lib/server';
import { AdminShell } from '@/components/admin-shell';
import Link from 'next/link';
export const metadata={title:'Commerce workspace',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){try{await requireRole(['admin','operations']);}catch{return <div className="narrow-page container"><h1>Your workspace awaits.</h1><p>Sign in with an authorized administrator or operations account to continue.</p><Link className="button" href="/login">Sign in</Link><p className="help-text">Without Supabase credentials, administrative access is available only on the localhost development server.</p></div>;}return <AdminShell local={await localMode()}>{children}</AdminShell>;}
