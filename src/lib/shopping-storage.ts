import { z } from 'zod';
import { productSchema } from './resources';
import type { Product } from './types';
export type CartLine = { key: string; product: Product; quantity: number; options: Record<string,string> };
export type ShoppingState = { cart: CartLine[]; wishlist: string[] };
const product = productSchema.extend({
  id: z.string().min(1).max(100), stock: z.number().int().min(0), reserved: z.number().int().min(0),
  previous_price_kobo: z.number().int().positive().nullable().optional().transform(v => v ?? undefined),
  created_at: z.string().max(100),
}).refine(p => p.reserved <= p.stock);
const shopping = z.object({
  cart: z.array(z.object({ product, quantity: z.number().int().min(1).max(50), options: z.record(z.string().max(60),z.string().max(80)) })).max(50),
  wishlist: z.array(z.string().min(1).max(100)).max(100),
});
export function cartKey(productId:string, options:Record<string,string>) {
  return productId + JSON.stringify(Object.fromEntries(Object.entries(options).sort(([a],[b]) => a.localeCompare(b))));
}
export function restoreShopping(raw:string|null):ShoppingState {
  try {
    const parsed = shopping.safeParse(JSON.parse(raw || 'null'));
    if (parsed.success) {
      const cart = new Map<string,CartLine>();
      for (const line of parsed.data.cart) {
        const key=cartKey(line.product.id,line.options);
        cart.set(key,{...line,key,quantity:Math.min(50,(cart.get(key)?.quantity || 0)+line.quantity)});
      }
      return {cart:[...cart.values()],wishlist:[...new Set(parsed.data.wishlist)]};
    }
  } catch { /* Invalid or old storage is safely discarded. */ }
  return {cart:[],wishlist:[]};
}
