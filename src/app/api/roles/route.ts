import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole,localMode,supabase } from '@/lib/server';
import { guard,failure } from '@/lib/http';
export async function POST(req:Request){try{guard(req);await requireRole(['admin']);if(await localMode())throw new Error('Connect Supabase to manage authenticated users');const input=z.object({user:z.uuid(),role:z.enum(['admin','operations','driver','customer'])}).parse(await req.json());const {error}=await(await supabase()).rpc('set_user_role',{p_user:input.user,p_role:input.role});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}catch(e){return failure(e);}}
