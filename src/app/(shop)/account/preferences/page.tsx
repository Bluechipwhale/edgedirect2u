import {redirect} from 'next/navigation';
import {actor,supabase} from '@/lib/server';
import {SubscriptionPreferences} from '@/components/subscription-preferences';
export const metadata={title:'Email preferences',robots:{index:false,follow:false}};
export default async function Page(){const a=await actor(false);if(!a)redirect('/login?next=/account/preferences');const {data,error}=await(await supabase()).from('subscribers').select('status').eq('owner_id',a.id).maybeSingle();if(error)return <p>Email preferences are temporarily unavailable.</p>;return <main className="container narrow-page"><SubscriptionPreferences initial={data?.status||''}/></main>;}
