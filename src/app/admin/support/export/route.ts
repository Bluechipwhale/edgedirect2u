import {requirePermission} from '@/lib/server';
import {failure} from '@/lib/http';
import {GET as exportSupport} from '@/app/(shop)/support/export/route';
export async function GET(req:Request){try{await requirePermission('support.manage');return exportSupport(req);}catch(e){return failure(e);}}
