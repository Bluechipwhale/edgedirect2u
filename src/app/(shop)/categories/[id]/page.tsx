import Products from '../../products/page';
import Link from 'next/link';
import {catalogue} from '@/lib/server';
import {notFound} from 'next/navigation';
export default async function Category({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
 const {id}=await params;const {categories}=await catalogue();const current=categories.find(c=>c.id===id);if(!current)notFound();
 const trail=[current];const seen=new Set([current.id]);
 while(trail[0].parent_id&&trail.length<3){const parent=categories.find(c=>c.id===trail[0].parent_id);if(!parent||seen.has(parent.id))break;seen.add(parent.id);trail.unshift(parent);}
 const children=categories.filter(c=>c.parent_id===id);
 return <><nav aria-label="Category breadcrumb" className="container resource-subnav" style={{paddingTop:24}}><Link href="/products">All products</Link>{trail.map(c=>c.id===id?<span key={c.id} aria-current="page">{c.name}</span>:<Link key={c.id} href={'/categories/'+encodeURIComponent(c.id)}>{c.name}</Link>)}</nav>{children.length>0&&<nav className="container resource-subnav" aria-label="Subcategories">{children.map(c=><Link key={c.id} href={'/categories/'+encodeURIComponent(c.id)}>{c.name} →</Link>)}</nav>}<Products searchParams={Promise.resolve({...await searchParams,category:id})}/></>;
}
