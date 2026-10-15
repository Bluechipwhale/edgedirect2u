import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { platformOverview } from '@/lib/platform-server';
import { PlatformConsole } from '@/components/platform-console';
export const metadata={title:'Platform control plane',robots:{index:false,follow:false}};
export default async function Page(){const data=await platformOverview().catch(()=>null);if(data)return <PlatformConsole {...data}/>;return <main className="platform-root platform-locked"><ShieldCheck size={44}/><span className="eyebrow">PLATFORM OWNER</span><h1>Protected by a second factor.</h1><p>Platform administration requires a separately authorized software-owner account and a verified authenticator code. Company administrator access is managed separately.</p><div className="hero-buttons"><Link className="button" href="/platform/security">Verify your authenticator</Link><Link className="text-button" href="/login?next=/platform">Sign in</Link></div><Link href="/company/e-edge-direct-2u">Open E-Edge company operations →</Link></main>;}
