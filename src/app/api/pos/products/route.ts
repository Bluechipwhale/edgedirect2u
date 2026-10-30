import {NextResponse} from 'next/server';
import {requireRole,catalogue} from '@/lib/server';
import {failure} from '@/lib/http';
export async function GET(req:Request){try{await requireRole(['admin','operations']);const q=new URL(req.url).searchParams;return NextResponse.json(await catalogue((q.get('q')||'').slice(0,100),'','',Math.min(100000,Math.max(1,Math.floor(Number(q.get('page'))||1))),'edge',0,Number.MAX_SAFE_INTEGER,'',true),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
