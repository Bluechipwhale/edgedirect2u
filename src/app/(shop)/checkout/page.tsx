import { Cart } from '@/components/cart';
import { checkoutActor, configured, localMode, records, supabase } from '@/lib/server';
import { redirect } from 'next/navigation';
import type { Address } from '@/lib/types';
export const metadata={title:'Checkout',robots:{index:false,follow:false}};
export default async function Checkout(){
  const a = await checkoutActor().catch(() => null);
  if (!a) redirect('/login?next=/checkout');
  const addresses = a ? (await records('addresses')).filter(r => r.owner_id === a.id).map(r => ({ id: r.id, ...Object.fromEntries(['name','phone','street','city','state'].map(key => [key, String(r.data[key] || '')])) })) as (Omit<Address,'email'> & { id: string })[] : [];
  const email = a && !a.local && configured() ? (await (await supabase()).auth.getUser()).data.user?.email || '' : '';
  return <Cart checkout addresses={addresses} email={email} paymentsReady={await localMode() || Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)} />;
}
