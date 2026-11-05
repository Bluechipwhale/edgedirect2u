import Image from 'next/image';
import {getPosReceipt,type PosSale} from '@/lib/pos';
import {money} from '@/lib/types';
import styles from './sale-receipt.module.css';

function date(value:string){
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?'Not recorded':new Intl.DateTimeFormat('en-NG',{
  timeZone:'Africa/Lagos',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,
 }).format(parsed)+' WAT';
}
const methods={cash:'Cash',bank_transfer:'Bank transfer',paystack:'Paystack'};

/** Presentation only: payment and refund evidence always comes from the recorded subledger. */
export function SaleReceipt({sale}:{sale:PosSale}){
 const receipt=getPosReceipt(sale);
 const refunds=sale.pos_refunds||[];
 const refunded=refunds.reduce((sum,r)=>sum+r.amount_kobo,0);
 const paid=Boolean(receipt)&&['paid','refunded'].includes(sale.status);
 const title=paid?'Sales receipt':sale.status==='reserved'?'Sale reservation':'Sale summary';
 const status=refunded>0&&paid?(sale.status==='refunded'?'Refunded':'Partially refunded'):
  ({paid:'Paid',reserved:'Awaiting payment',cancelled:'Cancelled',expired:'Expired',refunded:'Refunded'}[sale.status]||sale.status);
 return <article className={styles.paper} aria-label={title}>
  <header className={styles.header}>
   <div><Image className={styles.logo} src="/brand/e-edge-direct-2u-official.png" alt="E-Edge Direct 2U" width={280} height={74} unoptimized loading="eager"/><p className={styles.brandNote}>COUNTER SALES · EDGEDIRECT2U.COM</p></div>
   <div className={styles.heading}><span className={styles.eyebrow}>E-EDGE DIRECT 2U</span><h1>{title}</h1><span className={styles.badge} data-paid={paid}>{status}</span></div>
  </header>
  <div className={styles.reference}><span>Sale reference</span><strong>{sale.reference}</strong></div>
  <section className={styles.meta} aria-label="Customer and transaction details">
   <div><h2>Customer</h2><strong>{sale.buyer.name||'Counter customer'}</strong>{sale.buyer.phone&&<span>{sale.buyer.phone}</span>}{sale.buyer.email&&<span>{sale.buyer.email}</span>}</div>
   <div><h2>Transaction</h2><dl><div><dt>Sale date</dt><dd>{date(sale.created_at)}</dd></div><div><dt>Payment method</dt><dd>{methods[sale.method]}</dd></div><div><dt>Fulfilment</dt><dd>Counter collection</dd></div></dl></div>
  </section>
  <table className={styles.items}>
   <caption className={styles.srOnly}>Items for {sale.reference}</caption>
   <thead><tr><th scope="col">Item / description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
   <tbody>{sale.pos_items.map((item,index)=><tr key={item.id}><td><span className={styles.itemNumber}>{String(index+1).padStart(2,'0')}</span><strong>{item.name}</strong>{Object.keys(item.options||{}).length>0&&<small>{Object.entries(item.options).map(([k,v])=>`${k}: ${v}`).join(' · ')}</small>}</td><td>{item.quantity}</td><td>{money(item.price_kobo)}</td><td>{money(item.price_kobo*item.quantity)}</td></tr>)}</tbody>
  </table>
  <section className={styles.settlement} aria-label="Sale totals and payment">
   <div className={styles.payment}><h2>{receipt?'Payment record':'Payment status'}</h2>{receipt?<><p className={styles.paymentReference}>{receipt.external_reference||'No external reference recorded'}</p><p>Confirmed {date(receipt.confirmed_at)}</p>{!paid&&<p>The sale is {status.toLowerCase()}; this payment record does not change its status.</p>}</>:<p>{sale.status==='reserved'?'This reservation is awaiting payment. It is not proof of payment.':'No payment confirmation record is available for this sale.'}</p>}{sale.status==='reserved'&&<p>Reservation expires {date(sale.expires_at)}.</p>}</div>
   <dl className={styles.totals}><div><dt>Items subtotal</dt><dd>{money(sale.pos_items.reduce((n,i)=>n+i.price_kobo*i.quantity,0))}</dd></div><div><dt>Delivery · collection</dt><dd>{money(0)}</dd></div><div className={styles.total}><dt>Sale total</dt><dd>{money(sale.total_kobo)}</dd></div>{receipt&&<><div><dt>Payment received</dt><dd>{money(receipt.amount_kobo)}</dd></div>{sale.method==='cash'&&<><div><dt>Cash tendered</dt><dd>{money(receipt.tender_kobo)}</dd></div><div><dt>Change returned</dt><dd>{money(receipt.tender_kobo-receipt.amount_kobo)}</dd></div></>}</>}{refunded>0&&<><div><dt>Refunds recorded</dt><dd>{money(refunded)}</dd></div>{receipt&&<div><dt>Net payment retained</dt><dd>{money(receipt.amount_kobo-refunded)}</dd></div>}</>}</dl>
  </section>
  {refunds.length>0&&<section className={styles.refunds}><h2>Refund history</h2>{refunds.map(r=><div key={r.id}><strong>{money(r.amount_kobo)}</strong><span>{r.external_reference}</span><span>{date(r.confirmed_at)}</span><p>{r.note}</p></div>)}</section>}
  <footer className={styles.footer}><strong>Thank you for choosing E-Edge Direct 2U.</strong><span>Please keep this document and quote the sale reference for enquiries.</span><div><span>edgedirect2u.com</span><span>All amounts in Nigerian naira (NGN)</span></div></footer>
 </article>;
}
