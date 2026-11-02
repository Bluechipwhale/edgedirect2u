import {PayoutWorkspace} from '@/components/payout-workspace';
export const metadata={title:'Merchant withdrawals',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){return <PayoutWorkspace kind="merchant" base="/merchant/payouts" params={await searchParams}/>;}
