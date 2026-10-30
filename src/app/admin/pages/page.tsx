import {ContentAdmin} from '@/components/content-admin';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;state?:string;page?:string}>}){return <ContentAdmin kind="pages" params={await searchParams}/>;}
