import { NextResponse } from 'next/server';
import { validSignature, paystack,verifiedCharge } from '@/lib/paystack';
import { service } from '@/lib/server';
export async function POST(req: Request) {
  const body=await req.text(); const secret=process.env.PAYSTACK_SECRET_KEY;
  if(!secret || !validSignature(body,req.headers.get('x-paystack-signature')||'',secret)) return new NextResponse('Invalid signature',{status:401});
  try { const event=JSON.parse(body); if(event.event==='charge.success') { const ref=event.data.reference; if(typeof ref!=='string' || !/^edge-[a-z0-9-]{36}$/.test(ref))return new NextResponse('Invalid reference',{status:400}); const data=await paystack(`/transaction/verify/${encodeURIComponent(ref)}`); verifiedCharge(data,ref,data.amount); const {error}=await service().rpc('apply_payment',{p_reference:ref,p_amount:data.amount,p_currency:data.currency,p_status:data.status}); if(error)throw error; } return NextResponse.json({received:true}); } catch { return new NextResponse('Retry required',{status:503}); }
}
