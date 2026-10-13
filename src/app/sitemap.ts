import type { MetadataRoute } from 'next';
import { catalogue,localMode,configured,supabase,records } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import type { Product } from '@/lib/types';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
const base=process.env.NEXT_PUBLIC_SITE_URL||'https://edgedirect2u.com';const [data,stores]=await Promise.all([catalogue(),records('merchants',true)]);let products:{slug:string;created_at:string}[]=[];
if(await localMode())products=localStore().list<Product>('products').filter(p=>p.active);
else if(configured()){const db=await supabase();for(let offset=0;offset<49000;offset+=1000){const {data:batch,error}=await db.from('products').select('slug,created_at').eq('active',true).order('id').range(offset,offset+999);if(error)throw new Error('Sitemap data unavailable');products.push(...(batch||[]));if(!batch||batch.length<1000)break;}}
return [{url:base},{url:base+'/products'},{url:base+'/merchants'},...stores.map(m=>({url:base+'/merchants/'+encodeURIComponent(m.id)})),...data.categories.map(c=>({url:base+'/categories/'+encodeURIComponent(c.id)})),...products.map(p=>({url:base+'/products/'+p.slug,lastModified:p.created_at}))];}
