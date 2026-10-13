import Link from 'next/link';
import { actor,localMode,supabase } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { AccountSettings } from '@/components/account-settings';
export default async function Page(){const a=await actor(false);if(!a)return <div className="container narrow-page"><h1>Your profile.</h1><Link href="/login" className="button">Sign in</Link></div>;const local=await localMode();const name=local?localStore().get<{name:string}>('profile',a.id)?.name||'':(await(await supabase()).from('profiles').select('name').eq('id',a.id).single()).data?.name||'';return <div className="container narrow-page"><Link href="/account">← Your account</Link><h1>Your profile.</h1><AccountSettings name={name} local={local}/></div>;}
