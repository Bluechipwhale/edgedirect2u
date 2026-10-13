import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor,localMode,supabase } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { guard,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);const a=(await actor())!;const input=z.object({name:z.string().min(2).max(100),email:z.email(),description:z.string().min(10).max(1000)}).parse(await req.json());if(await localMode())localStore().record('merchants',{...input,status:'pending',commission_bps:1000},a.id,a);else{const {error}=await(await supabase()).rpc('apply_merchant',{p_data:input});if(error)throw new Error(error.message);}return NextResponse.json({ok:true});}catch(e){return failure(e);}}
