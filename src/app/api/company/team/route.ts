import {NextResponse} from 'next/server';
import {z} from 'zod';
import {platformIdentity} from '@/lib/platform-server';
import {staffRegistration} from '@/lib/field-directory';
import {service} from '@/lib/server';
import {guard,failure} from '@/lib/http';
export async function GET(req:Request){try{const company=z.uuid().parse(new URL(req.url).searchParams.get('company'));const {db}=await platformIdentity();const {data,error}=await db.rpc('company_staff_directory',{p_company:company});if(error)throw new Error(error.message);return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 guard(req);const {db}=await platformIdentity();const raw=await req.text();if(raw.length>5000)throw new Error('Request too large');
 const input=staffRegistration.parse(JSON.parse(raw));
 const {data,error}=await db.rpc('company_prepare_staff',{p_company:input.company_id,p_email:input.email,p_name:input.name,p_phone:input.phone,p_role:input.role,p_principal:input.principal});
 if(error)throw new Error(error.message);
 const origin=new URL(req.headers.get('origin')!).origin;
 let deliveryError:string|null=null;
 try{const sent=data?.exists?await db.auth.resetPasswordForEmail(input.email,{redirectTo:`${origin}/auth/confirm?next=/reset-password`}):await service().auth.admin.inviteUserByEmail(input.email,{redirectTo:`${origin}/reset-password`,data:{name:input.name}});if(sent.error)throw sent.error;}catch{deliveryError='Access is approved, but the invitation email could not be sent. Check email settings and retry.';}
 await db.rpc('company_staff_email_result',{p_company:input.company_id,p_email:input.email,p_error:deliveryError});
 return NextResponse.json({ok:true,emailSent:!deliveryError,message:deliveryError||'Staff access approved. A secure setup email has been sent; the recipient chooses their own password.'},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{guard(req);const {db}=await platformIdentity();const raw=await req.text();if(raw.length>1000)throw new Error('Request too large');const v=z.object({company_id:z.uuid(),email:z.email(),active:z.boolean()}).parse(JSON.parse(raw));const {error}=await db.rpc('company_staff_active',{p_company:v.company_id,p_email:v.email,p_active:v.active});if(error)throw new Error(error.message);return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
