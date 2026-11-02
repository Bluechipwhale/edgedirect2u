import {FeedbackReport} from '@/components/feedback-report';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){const p=await searchParams;return <FeedbackReport admin page={Math.max(1,Math.min(100000,Math.floor(Number(p.page)||1)))} status={p.status||''}/>;}
