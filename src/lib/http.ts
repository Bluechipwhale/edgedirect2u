import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function guard(req: Request) {
  const origin=req.headers.get('origin');if(!origin)throw new Error('Invalid request origin');
  const url=new URL(origin);const host=req.headers.get('host')||new URL(req.url).host;
  const configured=process.env.NEXT_PUBLIC_SITE_URL;
  const expected=process.env.NODE_ENV==='production'&&configured?new URL(configured).origin:`${new URL(req.url).protocol}//${host}`;
  if(url.origin!==expected)throw new Error('Invalid request origin');
}
export function failure(e: unknown) { const message = e instanceof ZodError ? e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : e instanceof Error ? e.message : 'Request failed'; const status = message === 'Forbidden' ? 403 : message === 'Authentication required' ? 401 : 400; return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}}); }
