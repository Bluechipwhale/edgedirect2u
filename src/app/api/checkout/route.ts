import { NextResponse } from 'next/server';
import { guestActor, localMode, supabase, orders,actor,service } from '@/lib/server';
import { checkoutSchema } from '@/lib/validation';
import { localStore } from '@/lib/local-store';
import { guard, failure } from '@/lib/http';
import { paystack } from '@/lib/paystack';
export async function POST(request: Request) {
  try { guard(request); const input = checkoutSchema.parse(await request.json());
    if (!(await localMode()) && (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)) return NextResponse.json({error:'Checkout is temporarily unavailable. Please try again later.'},{status:503});
    const a = await guestActor();
    let order; if(await localMode()) order = localStore().checkout(a,input); else { const {data,error} = await (await supabase()).rpc('create_checkout',{p_input:input}); if(error) throw new Error(error.message); order=data; }
    if (await localMode() || !process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({order, configuration:'Order reserved for 30 minutes. Payments require Supabase and Paystack configuration; no charge has been made.'});
    if(order.payment_status === 'paid') return NextResponse.json({order});
    const {data:attempt,error:attemptError}=await(await supabase()).rpc('claim_payment_initialization',{p_reference:order.reference});if(attemptError)throw new Error(attemptError.message);
    if(attempt.url)return NextResponse.json({order,url:attempt.url});
    const payment = await paystack('/transaction/initialize',{email:order.address.email,amount:order.total_kobo,currency:'NGN',reference:order.reference,callback_url:`${process.env.NEXT_PUBLIC_SITE_URL}/checkout/confirmation?reference=${order.reference}`});
    const {error:saveError}=await service().rpc('save_payment_initialization',{p_reference:order.reference,p_url:payment.authorization_url});if(saveError)throw new Error('Payment initialized but confirmation could not be saved. Contact support before retrying.');
    return NextResponse.json({order,url:payment.authorization_url});
  } catch(e) { return failure(e); }
}
export async function GET() { try { const a = (await actor())!; return NextResponse.json(await orders(a)); } catch(e) { return failure(e); } }
