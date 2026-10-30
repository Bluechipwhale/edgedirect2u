import {SupportInbox} from '@/components/support-inbox';
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;status?:string;ticket?:string}>}){const p=await searchParams;return <SupportInbox admin page={Math.max(1,Math.min(100000,Math.floor(Number(p.page)||1)))} status={p.status||''} ticket={p.ticket||''}/>;}
