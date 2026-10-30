import {SupportInbox} from '@/components/support-inbox';
export const metadata={title:'My support inbox',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;status?:string;ticket?:string}>}){const p=await searchParams;return <main className="container narrow-page"><SupportInbox page={Math.max(1,Math.min(100000,Math.floor(Number(p.page)||1)))} status={p.status||''} ticket={p.ticket||''}/></main>;}
