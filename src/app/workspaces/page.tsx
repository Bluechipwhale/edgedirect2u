import Link from 'next/link';
import { platformIdentity } from '@/lib/platform-server';
export const metadata={title:'Your workspaces',robots:{index:false,follow:false}};
export default async function Page(){
  const identity=await platformIdentity().catch(()=>null);
  if(!identity)return <main className="platform-root platform-locked"><h1>Your work starts here.</h1><p>Sign in to see the company workspaces assigned to your account.</p><Link className="button" href="/login?next=/workspaces">Sign in</Link></main>;
  const {data,error}=await identity.db.rpc('my_company_workspaces');
  const companies=(data||[]) as {slug:string;name:string;role:string}[];
  return <main className="platform-root platform-main"><Link href="/account">← Your account</Link><div className="platform-heading"><div><span className="eyebrow">YOUR AUTHORIZED WORKSPACES</span><h1>Choose your company.</h1><p>Each workspace uses its own team, brand and operational data.</p></div></div>{error?<p role="status">Your workspaces could not load. Please try again.</p>:<section className="platform-grid">{companies.map(c=><article className="platform-panel" key={c.slug}><span className="status-chip">{c.role.replaceAll('_',' ')}</span><h2>{c.name}</h2><Link className="button" href={`/${c.role==='field_agent'?'field':'company'}/${c.slug}`}>Open workspace →</Link></article>)}</section>}{!error&&!companies.length&&<p>Your account has no active company workspace. Ask your company administrator to add your confirmed email.</p>}</main>;
}
