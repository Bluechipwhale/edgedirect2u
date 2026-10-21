import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { records,catalogue } from '@/lib/server';
import { ProductCard } from '@/components/product-card';
import {cataloguePage} from '@/lib/catalogue-query';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string|string[]}>}){
  const {id}=await params;
  const m=(await records('merchants',true)).find(m=>m.id===id&&m.data.status==='approved');
  if(!m)notFound();
  const query=await searchParams;
  const page=cataloguePage(query.page);
  const data=await catalogue('','','',page,id);
  const pages=Math.max(1,Math.ceil(data.count/12));
  return <div className="container catalog-page"><span className="eyebrow muted">MERCHANT STOREFRONT</span><h1>{String(m.data.name)}</h1>{Boolean(m.data.cover)&&<div className="merchant-cover"><Image src={String(m.data.cover)} alt={`${String(m.data.name)} cover`} fill unoptimized sizes="100vw"/></div>}{Boolean(m.data.logo)&&<Image src={String(m.data.logo)} alt={`${String(m.data.name)} logo`} width={100} height={100} unoptimized/>}<p>{String(m.data.description)}</p><p>{data.count} products in this store.</p><div className="product-grid">{data.products.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!data.products.length&&<div className="empty-state">{data.count?<><h2>No products on this page.</h2><Link href={`/merchants/${encodeURIComponent(id)}`}>Return to the first page</Link></>:'New finds are coming soon.'}</div>}<nav className="pagination" aria-label="Store product pages">{page>1&&<Link className="button secondary-button" rel="prev" href={`/merchants/${encodeURIComponent(id)}?page=${page-1}`}>Previous</Link>}<span>Page {page} of {pages}</span>{page<pages&&<Link className="button" rel="next" href={`/merchants/${encodeURIComponent(id)}?page=${page+1}`}>Next</Link>}</nav></div>;
}
