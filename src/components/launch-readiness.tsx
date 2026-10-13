import { readiness } from '@/lib/readiness';
import { CheckCircle2, CircleDashed, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
export async function LaunchReadiness(){
  const checks=await readiness();
  return <><div className="management-heading"><div><span className="eyebrow muted">LAUNCH READINESS</span><h1>Connect your marketplace.</h1><p>{checks.filter(c=>c.ready).length} of {checks.length} technical checks passed. Complete service acceptance before going live.</p></div></div><div className="readiness-grid">{checks.map(c=><article className="config-card" key={c.name}><span className={`status-chip ${c.ready?'success':''}`}>{c.ready?<CheckCircle2 size={13}/>:<CircleDashed size={13}/>} {c.ready?'Check passed':'Action needed'}</span><h2>{c.name}</h2><p>{c.detail}</p></article>)}</div><div className="resource-subnav"><Link href="/admin/products">Catalogue <ArrowUpRight size={13}/></Link><Link href="/admin/policies">Policies</Link><Link href="/admin/roles">Users & roles</Link><Link href="/admin/theme">Website & branding</Link></div><p className="help-text">These checks do not verify business policies, SMTP delivery, scheduled jobs, backups or live payment acceptance.</p></>;
}
