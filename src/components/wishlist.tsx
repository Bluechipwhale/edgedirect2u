'use client';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useShop } from './shop-state';
import { ProductCard } from './product-card';
import type { Product } from '@/lib/types';
import { useEffect,useState } from 'react';
export function Wishlist({products}:{products:Product[]}){const {state}=useShop();const [saved,setSaved]=useState(products),[message,setMessage]=useState('');const ids=state.wishlist.join('|');useEffect(()=>{const controller=new AbortController();const query=new URLSearchParams();ids.split('|').filter(Boolean).slice(0,100).forEach(id=>query.append('id',id));fetch(`/api/wishlist?${query}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Saved products unavailable');return r.json();}).then(data=>{setSaved(data);setMessage('');}).catch(e=>{if(e.name!=='AbortError')setMessage('Unable to load saved products. Please refresh.');});return()=>controller.abort();},[ids]);const selected=saved.filter(p=>state.wishlist.includes(p.id));return <div className="container catalog-page"><span className="eyebrow muted">SAVED FOR A LITTLE LATER</span><h1>Your favourite finds.</h1>{message&&<p role="status">{message}</p>}{selected.length?<div className="product-grid">{selected.map(p=><ProductCard product={p} key={p.id}/>)}</div>:<div className="empty-state"><Heart size={42}/><h2>A little wishful shopping.</h2><p>Tap the heart on any product to save it here.</p><Link href="/products" className="button">Find your favourites</Link></div>}</div>;}
