import { it, expect } from 'vitest';
import { restoreShopping, cartKey } from '../src/lib/shopping-storage';
import { authInput } from '../src/lib/auth-validation';
import { products } from '../src/lib/seed';

it('discards malformed and oversized browser state before the cart renders',()=>{
  for(const raw of ['broken',JSON.stringify({cart:[{product:null,quantity:1}],wishlist:[]}),JSON.stringify({cart:[],wishlist:Array(101).fill('p-lamp')})])expect(restoreShopping(raw)).toEqual({cart:[],wishlist:[]});
});
it('restores SQL nullable prices and merges equivalent variant lines',()=>{
  const product={...products[0],previous_price_kobo:null};
  const state=restoreShopping(JSON.stringify({cart:[{key:'old-key',product,quantity:2,options:{Size:'M',Colour:'White'}},{key:'another',product,quantity:3,options:{Colour:'White',Size:'M'}}],wishlist:['p-lamp','p-lamp']}));
  expect(state.cart).toHaveLength(1);expect(state.cart[0].quantity).toBe(5);expect(state.cart[0].product.previous_price_kobo).toBeUndefined();expect(state.wishlist).toEqual(['p-lamp']);
  expect(state.cart[0].key).toBe(cartKey(product.id,{Colour:'White',Size:'M'}));
});
it('rejects fractional quantities and impossible cached reservation totals',()=>{
  const state=(product:unknown,quantity:number)=>JSON.stringify({cart:[{product,quantity,options:{}}],wishlist:[]});
  expect(restoreShopping(state(products[0],1.5)).cart).toEqual([]);
  expect(restoreShopping(state({...products[0],reserved:products[0].stock+1},1)).cart).toEqual([]);
});
it('permits existing shorter login passwords while enforcing new password policy',()=>{
  expect(authInput.safeParse({action:'login',email:'shopper@example.com',password:'olderpass'}).success).toBe(true);
  for(const action of ['register','update-password'])expect(authInput.safeParse({action,email:'shopper@example.com',password:'olderpass'}).success).toBe(false);
  expect(authInput.safeParse({action:'recover',email:'not-an-email'}).success).toBe(false);
});
