import { NextResponse } from 'next/server';
import { service } from '@/lib/server';
export async function POST(req:Request){if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new NextResponse('Unauthorized',{status:401});const {data,error}=await service().rpc('expire_reservations');if(error)return NextResponse.json({error:'Reservation cleanup failed'},{status:503});return NextResponse.json({expired:data});}
