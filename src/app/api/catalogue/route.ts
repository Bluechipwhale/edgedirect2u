import { NextResponse } from 'next/server';
import { catalogue } from '@/lib/server';
export async function GET(request: Request) { const p = new URL(request.url).searchParams; const data = await catalogue((p.get('q')||'').slice(0,100),p.get('category')||'',p.get('sort')||'',Math.max(1,Math.min(10000,Number(p.get('page'))||1))); return NextResponse.json(data); }
