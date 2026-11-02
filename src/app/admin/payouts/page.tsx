import {PayoutWorkspace} from '@/components/payout-workspace';
import {requireRole} from '@/lib/server';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){await requireRole(['admin']);return <PayoutWorkspace kind="merchant" base="/admin/payouts" params={await searchParams}/>;}
