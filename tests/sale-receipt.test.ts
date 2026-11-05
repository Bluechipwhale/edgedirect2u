import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {getPosReceipt,type PosSale,type PosReceipt} from '@/lib/pos';
import {SaleReceipt} from '@/components/sale-receipt';

vi.stubGlobal('React',React);
const receipt:PosReceipt={amount_kobo:1402500,tender_kobo:1500000,external_reference:'cash-confirmed-123',confirmed_at:'2026-11-05T19:37:00Z',note:'Cash counted'};
const sale:PosSale={id:'sale-1',created_by:'clerk-1',buyer:{name:'Example Customer',email:'customer@example.invalid',phone:''},method:'cash',status:'paid',total_kobo:1402500,reference:'edge-pos-example',created_at:'2026-11-05T19:30:00Z',expires_at:'2026-11-05T20:00:00Z',pos_items:[{id:'item-1',product_id:'product-1',name:'Morning Fresh Liquid',quantity:1,price_kobo:1402500,options:{Size:'1000ml'}}],pos_receipts:receipt,pos_refunds:[]};
const render=(changes:Partial<PosSale>={})=>renderToStaticMarkup(React.createElement(SaleReceipt,{sale:{...sale,...changes}}));

describe('counter sale receipt evidence',()=>{
 it('handles the one-to-one database object and legacy arrays consistently',()=>{
  expect(getPosReceipt(sale)).toEqual(receipt);
  expect(getPosReceipt({pos_receipts:[receipt]})).toEqual(receipt);
  expect(getPosReceipt({pos_receipts:null})).toBeNull();
  expect(getPosReceipt({pos_receipts:[]})).toBeNull();
  expect(render()).toEqual(render({pos_receipts:[receipt]}));
 });
 it('shows the official logo, paid receipt, recorded payment, change and Lagos time',()=>{
  const html=render();
  for(const text of ['e-edge-direct-2u-official.png','Sales receipt','Paid','₦14,025','₦15,000','₦975','cash-confirmed-123','08:37 pm WAT','1000ml'])expect(html).toContain(text);
  expect(html).not.toContain('Review reserved sale');
 });
 it('does not fabricate confirmation for paid sales with a missing receipt',()=>{
  const html=render({pos_receipts:null});
  expect(html).toContain('Sale summary');
  expect(html).toContain('No payment confirmation record');
  expect(html).not.toContain('Payment received');
 });
 it.each(['reserved','cancelled','expired'])('does not present %s sales as paid receipts',status=>{
  const html=render({status,pos_receipts:null});
  expect(html).not.toContain('Sales receipt');
  expect(html).not.toContain('Payment received');
  if(status==='reserved')expect(html).toContain('It is not proof of payment.');
 });
 it('shows partial and full refunds with dated references and the actual net payment',()=>{
  const refund={id:'refund-1',amount_kobo:200000,external_reference:'refund-verified-1',note:'Completed external refund',confirmed_at:receipt.confirmed_at};
  const html=render({pos_refunds:[refund]});
  for(const text of ['Partially refunded','Refund history','₦2,000','₦12,025','refund-verified-1','Net payment retained'])expect(html).toContain(text);
  expect(render({status:'refunded',pos_refunds:[{...refund,amount_kobo:sale.total_kobo}]})).toContain('₦0');
 });
 it('keeps bank and Paystack receipts free of cash tender/change fields',()=>{
  for(const method of ['bank_transfer','paystack'] as const){
   const html=render({method});
   expect(html).toContain('Payment received');expect(html).not.toContain('Cash tendered');expect(html).not.toContain('Change returned');
  }
 });
 it('escapes customer and product values instead of interpreting them as markup',()=>{
  const html=render({buyer:{name:'<script>bad()</script>',email:'',phone:''}});
  expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>bad()');
 });
});
