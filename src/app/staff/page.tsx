import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabase,configured } from '@/lib/server';
import { BusinessPortal } from '@/components/business-portal';
import type { BusinessContext,BusinessReport,BusinessTeam } from '@/lib/business';
export const metadata={title:'Staff & client portal',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
  if(!configured())return <main className="container narrow-page"><h1>Staff & client portal</h1><p>Connect production authentication to use the business workspace.</p><Link href="/">View storefront</Link></main>;
  const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user||user.is_anonymous)redirect('/login?next=/staff');
  const {data:context,error}=await db.rpc('business_context');
  if(error)throw new Error('Staff access is temporarily unavailable. Please try again.');
  if(!context)return <main className="container narrow-page"><span className="eyebrow">STAFF & CLIENT PORTAL</span><h1>Your access needs approval.</h1><p>Use the work email approved by your administrator. Confirm its email and sign in again after access is approved.</p><div className="profile-links"><Link href="/account/profile">Switch account or sign out</Link><Link href="/">Visit the customer storefront</Link></div></main>;
  const params=await searchParams;
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
  const month=today.slice(0,7)+'-01';
  const date=(v:string|undefined,fallback:string)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:fallback;
  const from=date(params.from,month),to=date(params.to,today);
  const [report,team]=await Promise.all([db.rpc('business_report',{p_from:from,p_to:to}),context.role==='administrator'?db.rpc('business_team'):Promise.resolve({data:null,error:null})]);
  if(report.error)return <main className="container narrow-page"><h1>Choose a valid reporting period.</h1><p>Use a start and end date no more than 366 days apart.</p><Link href="/staff">Return to this month</Link></main>;
  if(team.error)throw new Error('Team access is temporarily unavailable.');
  return <BusinessPortal context={context as BusinessContext} report={report.data as BusinessReport} team={team.data as BusinessTeam|null} email={user.email||''}/>;
}
