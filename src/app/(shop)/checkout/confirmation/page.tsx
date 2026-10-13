import { PaymentConfirmation } from '@/components/payment-confirmation';
export default async function Page({searchParams}:{searchParams:Promise<{reference?:string}>}){return <PaymentConfirmation reference={(await searchParams).reference||''}/>;}
