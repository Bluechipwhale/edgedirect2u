import {NextResponse} from 'next/server';
import {z} from 'zod';
import {platformIdentity} from '@/lib/platform-server';
import {failure} from '@/lib/http';
export async function GET(req:Request){try{
 const query=new URL(req.url).searchParams;
 const input=z.object({company:z.uuid(),q:z.string().max(120),route:z.string().max(250),location:z.enum(['all','ready','missing']),page:z.coerce.number().int().min(1).max(100000)}).parse({company:query.get('company'),q:query.get('q')||'',route:query.get('route')||'',location:query.get('location')||'all',page:query.get('page')||1});
 const {db}=await platformIdentity();const {data,error}=await db.rpc('field_store_directory',{p_company:input.company,p_query:input.q,p_route:input.route,p_location:input.location,p_page:input.page});
 if(error)throw new Error(error.message);
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
