import Link from 'next/link';
import { PlatformMfa } from '@/components/platform-mfa';
export const metadata={title:'Platform security',robots:{index:false,follow:false}};
export default function Page(){return <main className="platform-root platform-main"><Link href="/platform">← Platform</Link><div className="platform-heading"><div><span className="eyebrow">IDENTITY & ACCESS</span><h1>A second layer.<br/>For the control plane.</h1><p>Sign in with the authorized software-owner account before continuing.</p></div></div><PlatformMfa/><p><Link href="/login?next=/platform/security">Sign in to your account →</Link></p></main>;}
