import { notFound } from 'next/navigation';
import Link from 'next/link';
import { product,catalogue,publicReviews } from '@/lib/server';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/product-card';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const p=await product((await params).slug);return {title:p?.name||'Product unavailable',description:p?.description,alternates:{canonical:p?`/products/${p.slug}`:undefined}};}
export default async function Detail({params}:{params:Promise<{slug:string}>}){const p=await product((await params).slug);if(!p)notFound();const [related,reviews]=await Promise.all([catalogue('',p.category_id),publicReviews(p.id)]);return <div className="container catalog-page"><div className="breadcrumbs"><Link href="/">Home</Link>/<Link href="/products">Collection</Link>/{p.name}</div><ProductDetail product={p} reviews={reviews}/><section className="section"><h2>A little more to discover.</h2><div className="product-grid">{related.products.filter(r=>r.id!==p.id).slice(0,4).map(r=><ProductCard key={r.id} product={r}/>)}</div></section></div>;}
