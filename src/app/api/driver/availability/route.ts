import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole,supabase } from '@/lib/server';
import { guard,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);await requireRole(['driver']);const {available}=z.object({available:z.boolean()}).parse(await req.json());const {error}=await(await supabase()).rpc('set_driver_availability',{p_available:available});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return failure(e);}}
