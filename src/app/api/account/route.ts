import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor,localMode,supabase } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { guard,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);const a=(await actor())!;const {name}=z.object({name:z.string().trim().min(2).max(100)}).parse(await req.json());if(await localMode())localStore().put('profile',a.id,{name});else{const {error}=await(await supabase()).rpc('update_profile',{p_name:name});if(error)throw new Error(error.message);}return NextResponse.json({ok:true});}catch(e){return failure(e);}}
