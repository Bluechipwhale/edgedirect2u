import {NextResponse} from 'next/server';
import {z} from 'zod';
import {platformIdentity} from '@/lib/platform-server';
import {failure} from '@/lib/http';
export async function GET(req:Request){try{const company=z.uuid().parse(new URL(req.url).searchParams.get('company'));const {db}=await platformIdentity();const {data,error}=await db.rpc('field_route_plan',{p_company:company});if(error)throw new Error(error.message);return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
