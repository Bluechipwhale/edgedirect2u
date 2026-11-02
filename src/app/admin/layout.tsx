import {actor,localMode,commerceContext} from '@/lib/server';
import {commerceRoutes} from '@/lib/commerce-permissions';
import { AdminShell } from '@/components/admin-shell';
import Link from 'next/link';
import { AdminGettingStarted } from '@/components/admin-getting-started';
export const metadata={title:'Commerce workspace',robots:{index:false,follow:false}};
export default async function Layout({children}:{children:React.ReactNode}){const a=await actor(false);let context=null;if(a&&!['admin','operations'].includes(a.role))context=await commerceContext();const routes=context?commerceRoutes(context.permissions):undefined;if(!a||routes&&!routes.length)return <div className="narrow-page container"><h1>Your workspace awaits.</h1><p>Sign in with your approved administrator, operations or custom staff account.</p><Link className="button" href="/login?next=/admin">Sign in</Link><p className="help-text">Your administrator must approve access. Signing in does not grant staff permissions automatically.</p></div>;return <AdminShell local={await localMode()} allowedRoutes={routes} roleName={context?.name||(a.role==='operations'?'Operations':'Administrator')}>{a.role==='admin'&&<AdminGettingStarted/>}{children}</AdminShell>;}
