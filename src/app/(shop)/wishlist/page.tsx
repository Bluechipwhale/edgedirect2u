import { catalogue } from '@/lib/server';
import { Wishlist } from '@/components/wishlist';
export default async function Page(){const data=await catalogue();return <Wishlist products={data.products}/>;}
