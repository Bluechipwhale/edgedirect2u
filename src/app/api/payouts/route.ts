import {NextResponse} from 'next/server';
import {actor,supabase} from '@/lib/server';
import {guard,failure} from '@/lib/http';
import {payoutAction} from '@/lib/payouts';
export async function POST(req:Request){try{guard(req);await actor();const raw=await req.text();if(raw.length>10000)throw Error('Request too large');const i=payoutAction.parse(JSON.parse(raw)),db=await supabase();const r=i.action==='request'?await db.rpc('request_payout',{p_id:i.id,p_kind:i.kind,p_company:i.company,p_amount:i.amount,p_payee:i.payee,p_note:i.note}):i.action==='cancel'?await db.rpc('cancel_payout_request',{p_id:i.id}):await db.rpc('review_payout',{p_id:i.id,p_action:i.decision,p_note:i.note,p_reference:i.reference,p_checked:i.checked});if(r.error)throw Error(r.error.message);return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
