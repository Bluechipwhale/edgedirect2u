import {actor,supabase} from '@/lib/server';
import {redirect} from 'next/navigation';
import {PayoutWorkspace} from '@/components/payout-workspace';
export const metadata={title:'Company payment requests',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{status?:string;page?:string}>}){const {slug}=await params;if(!await actor(false))redirect('/login?next='+encodeURIComponent(`/company/${slug}/payments`));const c=await(await supabase()).rpc('company_context',{p_slug:slug});if(c.error)return <p>Company payment access required.</p>;return <PayoutWorkspace kind="staff" company={c.data.id} base={`/company/${slug}/payments`} params={await searchParams}/>;}
