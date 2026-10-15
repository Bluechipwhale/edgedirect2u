import Link from 'next/link';
import { companySnapshot } from '@/lib/platform-server';
import { CompanyWorkspace } from '@/components/company-workspace';
export const metadata={title:'Field operations',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const snapshot=await companySnapshot(slug).catch(()=>null);if(snapshot)return <CompanyWorkspace snapshot={snapshot} fieldMode/>;return <main className="platform-root platform-locked"><span className="eyebrow">FIELD OPERATIONS</span><h1>A better field day starts here.</h1><p>Sign in with your assigned company account to view stores, shifts and visit history.</p><Link className="button" href="/login">Field team sign in</Link></main>;}
