import { NextResponse } from 'next/server';
import { actor, orders, localMode, service } from '@/lib/server';
import { paystack, verifiedCharge } from '@/lib/paystack';
import { localStore } from '@/lib/local-store';
import { failure, guard } from '@/lib/http';
export async function POST(req: Request) { try { guard(req); const a=(await actor())!; const {reference} = await req.json(); if(typeof reference!=='string' || !/^edge-[a-z0-9-]{36}$/.test(reference)) throw new Error('Invalid payment reference'); const o=(await orders(a)).find(o=>o.reference===reference); if(!o) throw new Error('Forbidden'); const data=verifiedCharge(await paystack(`/transaction/verify/${encodeURIComponent(reference)}`),reference,o.total_kobo); if(await localMode()) localStore().verifiedPayment(reference,data.amount,data.currency,data.status); else { const {error}=await service().rpc('apply_payment',{p_reference:reference,p_amount:data.amount,p_currency:data.currency,p_status:data.status}); if(error)throw new Error(error.message); } return NextResponse.json({ok:true}); } catch(e){return failure(e);} }
