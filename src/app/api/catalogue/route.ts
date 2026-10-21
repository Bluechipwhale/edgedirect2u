import { NextResponse } from 'next/server';
import { catalogue } from '@/lib/server';
import {cataloguePage} from '@/lib/catalogue-query';
export async function GET(request: Request) { const p = new URL(request.url).searchParams; const data = await catalogue((p.get('q')||'').slice(0,100),p.get('category')||'',p.get('sort')||'',cataloguePage(p.get('page'))); return NextResponse.json(data); }
