import { requireRole,localMode } from '@/lib/server';
import { AdminShell } from '@/components/admin-shell';
import Link from 'next/link';
import { AdminGettingStarted } from '@/components/admin-getting-started';
export const metadata={title:'Commerce workspace',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){let admin=false;try{admin=(await requireRole(['admin','operations'])).role==='admin';}catch{return <div className="narrow-page container"><h1>Your workspace awaits.</h1><p>Sign in with an authorized administrator or operations account to continue.</p><Link className="button" href="/login">Sign in</Link><p className="help-text">Your account must have an administrator or operations role. Signing in does not grant those roles automatically.</p></div>;}return <AdminShell local={await localMode()}>{admin&&<AdminGettingStarted/>}{children}</AdminShell>;}
