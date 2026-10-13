import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole,localMode,service,records } from '@/lib/server';
import { guard,failure } from '@/lib/http';
import { submitRefund,fetchRefund } from '@/lib/refunds';
export async function POST(req:Request){try{
  guard(req);await requireRole(['admin']);
  if(await localMode())throw new Error('Refund transfers require Supabase and Paystack. Local requests remain unpaid test records.');
  if(!process.env.PAYSTACK_SECRET_KEY)throw new Error('Configure Paystack before processing refunds');
  const input=z.object({action:z.enum(['process','reconcile']),id:z.string().min(1).max(100),provider:z.string().regex(/^[0-9]+$/).optional()}).parse(await req.json());
  const db=service();let row:{amount_kobo:number;reference:string;provider_reference?:string};
  if(input.action==='process'){
    const {data,error}=await db.rpc('claim_refund',{p_id:input.id});if(error)throw new Error(error.message);row=data;
  }else{
    const record=(await records('refunds')).find(r=>r.id===input.id);if(!record||record.data.status==='requested')throw new Error('Refund not yet submitted');
    const {data,error}=await db.from('orders').select('reference').eq('id',record.data.order_id).single();if(error)throw new Error(error.message);
    row={amount_kobo:Number(record.data.amount_kobo),reference:data.reference,provider_reference:String(record.data.provider_reference||input.provider||'')};
    if(!/^[0-9]+$/.test(row.provider_reference!))throw new Error('Enter the provider refund ID from Paystack to reconcile the ambiguous request');
  }
  let refund;
  try {refund=input.action==='process'?await submitRefund(input.id,row.reference,row.amount_kobo):await fetchRefund(row.provider_reference!,row.reference,row.amount_kobo);}
  catch {throw new Error('Provider confirmation unavailable. Do not submit again. Reconcile this request using its refund ID from Paystack.');}
  const {error}=await db.rpc('reconcile_refund',{p_id:input.id,p_provider:refund.id,p_amount:refund.amount,p_status:refund.status});if(error)throw new Error('Provider accepted the request; reconcile its status before any further action');
  return NextResponse.json({ok:true,status:refund.status});
}catch(e){return failure(e);}}
