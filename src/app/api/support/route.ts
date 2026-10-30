import {createHmac} from 'node:crypto';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {guard,failure} from '@/lib/http';
import {supabase,service,actor} from '@/lib/server';
import {contactInput} from '@/lib/support';
export async function POST(req:Request){try{
 guard(req);const raw=await req.text();if(raw.length>15000)throw Error('Request too large');const input=contactInput.parse(JSON.parse(raw));if(input.website)throw Error('Unable to submit this request');
 const db=await supabase();const {data:{user}}=await db.auth.getUser();const owner=user&&!user.is_anonymous&&user.email_confirmed_at?user:null;
 const email=owner?.email||input.email;const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Support submission is temporarily unavailable');
 const ipHash=createHmac('sha256',key).update(ip).digest('hex');
 const {data,error}=await service().rpc('submit_contact',{p_id:input.id,p_name:input.name,p_email:email,p_subject:input.subject,p_body:input.body,p_ip_hash:ipHash,p_owner:owner?.id||null});
 if(error)throw Error(error.message);return NextResponse.json({id:data,ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{
 guard(req);await actor();const raw=await req.text();if(raw.length>15000)throw Error('Request too large');const input=z.object({ticket:z.uuid(),id:z.uuid(),body:z.string().trim().min(1).max(5000),status:z.enum(['open','in_progress','resolved','closed']).optional()}).strict().parse(JSON.parse(raw));
 const {error}=await(await supabase()).rpc('reply_support',{p_ticket:input.ticket,p_id:input.id,p_body:input.body,p_status:input.status||null});if(error)throw Error(error.message);return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
