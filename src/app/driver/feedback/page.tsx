import {FeedbackReport} from '@/components/feedback-report';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {actor} from '@/lib/server';
export const metadata={title:'My delivery feedback',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){const a=await actor(false);if(!a)redirect('/login?next=/driver/feedback');if(a.role!=='driver')return <main className="container narrow-page"><h1>Delivery driver access required</h1><Link href="/workspaces">Open my workspaces</Link></main>;const p=await searchParams;return <main className="container narrow-page"><FeedbackReport page={Math.max(1,Math.min(100000,Math.floor(Number(p.page)||1)))}/></main>;}
