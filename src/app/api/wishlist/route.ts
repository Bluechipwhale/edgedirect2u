import { NextResponse } from 'next/server';
import { z } from 'zod';
import { localMode,supabase,configured } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import type { Product } from '@/lib/types';
import { failure } from '@/lib/http';
export async function GET(req:Request){try{const ids=z.array(z.string().min(1).max(100)).max(100).parse(new URL(req.url).searchParams.getAll('id'));if(!ids.length)return NextResponse.json([]);if(await localMode())return NextResponse.json(localStore().list<Product>('products').filter(p=>p.active&&ids.includes(p.id)));if(!configured())return NextResponse.json([]);const {data,error}=await(await supabase()).from('products').select('*').eq('active',true).in('id',ids);if(error)throw new Error('Saved products unavailable');return NextResponse.json(data);}catch(e){return failure(e);}}
