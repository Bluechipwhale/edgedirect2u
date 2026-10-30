import {exportContent} from '@/lib/content-export';
export async function GET(req:Request){return exportContent(req,'gallery');}
