import Link from 'next/link';
import { companySnapshot } from '@/lib/platform-server';
import { CompanyWorkspace } from '@/components/company-workspace';
export const metadata={title:'Company operations',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const snapshot=await companySnapshot(slug).catch(()=>null);if(snapshot)return <CompanyWorkspace snapshot={snapshot}/>;return <main className="platform-root platform-locked"><span className="eyebrow">COMPANY WORKSPACE</span><h1>Your company. Your authorized team.</h1><p>Sign in with an active company membership to open this workspace. Access is checked on the server and in the database.</p><Link className="button" href="/login">Sign in</Link><Link href="/">Return to the marketplace →</Link></main>;}
