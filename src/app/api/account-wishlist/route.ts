import {NextResponse} from 'next/server';
import {z} from 'zod';
import {actor,supabase} from '@/lib/server';
import {guard,failure} from '@/lib/http';
export async function GET(){try{await actor();const r=await(await supabase()).rpc('account_wishlist');if(r.error)throw Error(r.error.message);return NextResponse.json(r.data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{guard(req);await actor();const raw=await req.text();if(raw.length>15000)throw Error('Request too large');const input=z.object({owner:z.uuid(),ids:z.array(z.string().min(1).max(100)).max(100)}).strict().parse(JSON.parse(raw));const r=await(await supabase()).rpc('save_account_wishlist',{p_owner:input.owner,p_ids:input.ids});if(r.error)throw Error(r.error.message);return NextResponse.json(r.data,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
