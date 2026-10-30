import {NextResponse} from 'next/server';
import {z} from 'zod';
import {actor,supabase} from '@/lib/server';
import {guard,failure} from '@/lib/http';
export async function POST(req:Request){try{guard(req);await actor();const input=z.object({subscribe:z.boolean()}).strict().parse(await req.json());const {data,error}=await(await supabase()).rpc('set_subscription',{p_subscribe:input.subscribe});if(error)throw Error(error.message);return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
