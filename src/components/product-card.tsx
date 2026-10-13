'use client';
import Image from 'next/image';
import { canOptimize } from '@/lib/images';
import Link from 'next/link';
import { Heart, Plus, ArrowUpRight } from 'lucide-react';
import { money, type Product } from '@/lib/types';
import { useShop } from './shop-state';
export function ProductCard({product:p}:{product:Product}) { const {state,wish,add}=useShop();const options=Object.keys(p.options).length>0; const available=p.stock-p.reserved;
  return <article className="product-card"><div className="product-photo"><Link href={`/products/${p.slug}`}><Image unoptimized={!canOptimize(p.image)} src={p.image} alt={p.name} fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw"/></Link>{available<=0?<span className="product-badge">Out of stock</span>:available<5?<span className="product-badge">Limited stock</span>:null}<button className={`wish-btn ${state.wishlist.includes(p.id)?'selected':''}`} onClick={()=>wish(p.id)} aria-pressed={state.wishlist.includes(p.id)} aria-label={`${state.wishlist.includes(p.id)?'Remove from':'Add to'} wishlist: ${p.name}`}><Heart size={17} fill={state.wishlist.includes(p.id)?'currentColor':'none'}/></button></div><div className="product-meta"><span>{p.brand}</span><span>{p.merchant_name}</span></div><h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3><div className="price-line"><strong>{money(p.price_kobo)}</strong>{p.previous_price_kobo&&p.previous_price_kobo>p.price_kobo&&<del>{money(p.previous_price_kobo)}</del>}{options?<Link href={`/products/${p.slug}`} className="add-btn" aria-label={`Choose options for ${p.name}`}><ArrowUpRight size={18}/></Link>:<button disabled={available<=0} className="add-btn" aria-label={`Add ${p.name} to bag`} onClick={()=>add(p)}><Plus size={18}/></button>}</div></article>;
}
