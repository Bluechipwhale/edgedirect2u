import Link from 'next/link';
import {requireRole,supabase} from '@/lib/server';
import {money} from '@/lib/types';
import type {AdminReport} from '@/lib/admin-reports';
import {AdminReportExport} from '@/components/admin-report-export';
import './reports.css';

export const metadata={title:'Commerce reports',robots:{index:false,follow:false}};
const formatDate=(value:string)=>new Date(value).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'});
function ReportTable({title,note,headers,rows,exportName}:{title:string;note:string;headers:string[];rows:(string|number|null)[][];exportName:string}){
 return <section className="report-panel"><div className="report-panel-head"><div><h2>{title}</h2><p>{note}</p></div><AdminReportExport name={exportName} rows={[headers,...rows]}/></div><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${exportName}-${index}`}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="report-empty">No matching records for this period.</p>}</div></section>;
}
export default async function Page({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 await requireRole(['admin']);const params=await searchParams;
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
 const start=today.slice(0,7)+'-01';
 const date=(value:string|undefined,fallback:string)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:fallback;
 const from=date(params.from,start),to=date(params.to,today);
 const db=await supabase();const {data,error}=await db.rpc('admin_reporting',{p_from:from,p_to:to});
 if(error){return <main className="report-page"><h1>Reports are unavailable</h1><p>Choose a valid period of 366 days or less. If the issue continues, check pending database migrations.</p><Link href="/admin/reports">This month</Link></main>}
 const report=data as AdminReport;const o=report.overview;
 return <main className="report-page">
  <div className="management-heading"><div><span className="eyebrow muted">OPERATIONS INTELLIGENCE</span><h1>Commerce reports.</h1><p>Orders, products, stores, customers, payments and delivery from this marketplace.</p></div><Link href="/staff" className="small-button">Open stock & van sales</Link></div>
  <form className="report-filters" action="/admin/reports"><label>From<input name="from" type="date" defaultValue={from} required/></label><label>To<input name="to" type="date" defaultValue={to} required/></label><button className="button">Apply dates</button><p>Reporting dates use Lagos time. Product and stock totals show today’s balances.</p></form>
  <div className="report-cards"><article><span>Verified payments</span><strong>{money(o.verified_payments_kobo)}</strong><small>Provider receipts verified in this period</small></article><article><span>Processed refunds</span><strong>{money(o.processed_refunds_kobo)}</strong><small>Processed requests created in this period</small></article><article><span>Orders</span><strong>{o.orders}</strong><small>{o.paid_orders} currently paid</small></article><article><span>Catalogue</span><strong>{o.active_products}</strong><small>{o.inactive_products} inactive products</small></article><article><span>Physical stock</span><strong>{o.warehouse_units+o.van_units}</strong><small>{o.warehouse_units} warehouse · {o.van_units} in vans</small></article></div>
  <p className="report-note">Sales tables count orders that are currently paid and were created within the selected dates. They show gross item or store value before discounts and delivery. Fully refunded orders are excluded. Legacy .com.ng sales are separate until verified historical records are migrated.</p>
  <ReportTable title="Order status" note="Current fulfilment and payment state for orders created in this period." exportName="order-status" headers={['Order status','Payment status','Count']} rows={report.order_status.map(r=>[r.status.replace(/_/g,' '),r.payment_status,r.count])}/>
  <ReportTable title="Product sales" note="Top 100 products by gross item value." exportName="product-sales" headers={['Product','Units','Gross value (NGN)']} rows={report.product_sales.map(r=>[r.name,r.quantity||0,(r.gross_kobo/100).toFixed(2)])}/>
  <ReportTable title="Store sales" note="Top 100 stores by gross allocation value." exportName="store-sales" headers={['Store','Paid orders','Gross value (NGN)']} rows={report.merchant_sales.map(r=>[r.name,r.orders||0,(r.gross_kobo/100).toFixed(2)])}/>
  <ReportTable title="Top customers" note="Top 50 customers by currently paid orders." exportName="top-customers" headers={['Customer','Paid orders','Order value (NGN)']} rows={report.top_customers.map(r=>[r.name,r.orders||0,(r.gross_kobo/100).toFixed(2)])}/>
  <ReportTable title="Delivery performance" note="Drivers with a delivered event in this period." exportName="delivery-performance" headers={['Driver','Delivered jobs']} rows={report.drivers.map(r=>[r.name,r.deliveries])}/>
  <ReportTable title="Verified payment receipts" note="Most recent 100 receipts verified in this period." exportName="verified-payments" headers={['Reference','Amount (NGN)','Verified']} rows={report.payments.map(r=>[r.reference,(r.amount_kobo/100).toFixed(2),formatDate(r.verified_at)])}/>
  <ReportTable title="Refund requests" note="Most recent 100 requests created in this period. Status shows the latest provider outcome." exportName="refund-requests" headers={['Refund ID','Order ID','Amount (NGN)','Status','Requested']} rows={report.refunds.map(r=>[r.id,r.order_id,(r.amount_kobo/100).toFixed(2),r.status,formatDate(r.created_at)])}/>
 </main>;
}
