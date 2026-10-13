import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole,supabase } from '@/lib/server';
import { guard,failure } from '@/lib/http';
const image=z.string().max(1000).refine(v=>!v||v.startsWith('https://'),'Use HTTPS image URLs');
export async function POST(req:Request){try{guard(req);await requireRole(['merchant']);const input=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(1000),logo:image,cover:image}).parse(await req.json());const {error}=await(await supabase()).rpc('update_merchant_profile',{p_data:input});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return failure(e);}}
