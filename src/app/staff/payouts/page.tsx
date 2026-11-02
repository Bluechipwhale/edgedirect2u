import {PayoutWorkspace} from '@/components/payout-workspace';
export const metadata={title:'Finance payment requests',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string;status?:string;page?:string}>}){const p=await searchParams,kind=p.kind==='merchant'?'merchant':'staff';return <PayoutWorkspace kind={kind} company={kind==='staff'?'10000000-0000-4000-8000-000000000001':null} base={`/staff/payouts?kind=${kind}`} params={p}/>;}
