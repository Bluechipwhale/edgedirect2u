import {NextResponse} from 'next/server';
import {guard,failure} from '@/lib/http';
import {requireRole,supabase,service} from '@/lib/server';
import {posAction} from '@/lib/pos';
import {paystack,verifiedCharge} from '@/lib/paystack';
import {fetchRefund} from '@/lib/refunds';
export async function POST(req:Request){try{
 guard(req);const a=await requireRole(['admin','operations']);const raw=await req.text();if(raw.length>60000)throw Error('Request too large');const input=posAction.parse(JSON.parse(raw)),db=await supabase();
 if(input.action==='reserve'){const {action,...sale}=input;void action;const r=await db.rpc('reserve_counter_sale',{p_input:sale});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true,id:r.data.id});}
 if(input.action==='cancel'){const r=await db.rpc('cancel_counter_sale',{p_id:input.id});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});}
 if(input.action==='confirm'){const r=await db.rpc('confirm_counter_payment',{p_id:input.id,p_amount:input.amount,p_tender:input.tender,p_reference:input.reference,p_note:input.note,p_checked:input.checked});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});}
 if(input.action==='refund'){if(a.role!=='admin')throw Error('Forbidden');const r=await db.rpc('record_counter_refund',{p_id:input.id,p_sale:input.sale,p_amount:input.amount,p_reference:input.reference,p_note:input.note});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});}
 const id=input.action==='reconcile_refund'?input.sale:input.id;const sale=await db.from('pos_sales').select('*').eq('id',id).single();if(sale.error||!sale.data)throw Error('Sale unavailable');const s=sale.data;
 if(input.action==='initialize'){
  if(!process.env.PAYSTACK_SECRET_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Payment provider unavailable');
  const claim=await db.rpc('claim_pos_initialization',{p_id:id});if(claim.error)throw Error(claim.error.message);if(claim.data.url)return NextResponse.json({url:claim.data.url});
  const payment=await paystack('/transaction/initialize',{email:s.buyer.email,amount:s.total_kobo,currency:'NGN',reference:s.reference,callback_url:`${process.env.NEXT_PUBLIC_SITE_URL}/admin/pos?sale=${id}`});
  const saved=await service().rpc('save_pos_initialization',{p_id:id,p_url:payment.authorization_url});if(saved.error)throw Error('Payment initialized. Refresh and reconcile before starting another payment.');return NextResponse.json({url:payment.authorization_url});
 }
 if(input.action==='verify'){
  if(s.method!=='paystack')throw Error('This sale uses a manual payment method');const charge=verifiedCharge(await paystack(`/transaction/verify/${encodeURIComponent(s.reference)}`),s.reference,s.total_kobo);const r=await service().rpc('apply_pos_payment',{p_reference:s.reference,p_amount:charge.amount,p_currency:charge.currency,p_status:charge.status});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});
 }
 if(input.action==='reconcile_refund'){
  if(a.role!=='admin')throw Error('Forbidden');if(s.method!=='paystack')throw Error('This sale uses a manual payment method');const refund=await fetchRefund(input.provider,s.reference,input.amount);if(refund.status!=='processed')throw Error('The provider has not completed this refund');const r=await service().rpc('reconcile_counter_refund',{p_id:input.id,p_sale:id,p_amount:refund.amount,p_provider:refund.id,p_actor:a.id});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true});
 }
 throw Error('Unknown POS action');
}catch(e){return failure(e);}}
