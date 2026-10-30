import Link from 'next/link';
import {redirect} from 'next/navigation';
import {actor,localMode,supabase} from '@/lib/server';
import {historyColumns,label,text,type HistoryPage} from '@/lib/legacy-history';

export const metadata={title:'Former store records',robots:{index:false,follow:false}};
export default async function History({searchParams}:{searchParams:Promise<{table?:string;q?:string;page?:string;batch?:string}>}){
 const user=await actor(false);
 if(!user)redirect('/login?next=/admin/history');
 if(user.role!=='admin')return <main><h1>Administrator access required</h1><p>Only administrators can view private former-store records.</p><Link href="/">Return to storefront</Link></main>;
 const params=await searchParams;
 const table=/^[a-z][a-z0-9_]{0,63}$/.test(params.table||'')?params.table!:'orders';
 const query=(params.q||'').trim().slice(0,120),page=Math.max(1,Math.min(100000,Math.floor(Number(params.page)||1)));
 const batch=/^[a-f0-9]{64}$/.test(params.batch||'')?params.batch!:null;
 if(await localMode())return <main><h1>Former store records</h1><p>Historical business records are available only through an authorized production account.</p></main>;
 const {data,error}=await(await supabase()).rpc('admin_legacy_history',{p_table:table,p_query:query,p_page:page,p_batch:batch});
 if(error)return <main><h1>Former store records unavailable</h1><p>Check the selected source table and the history import status.</p><Link href="/admin/history">Open latest archive</Link></main>;
 const result=data as HistoryPage,b=result.batch;
 if(!b)return <main><h1>Former store records</h1><p>No verified historical archive is available yet.</p></main>;
 const columns=historyColumns[table]||Object.keys(result.rows[0]?.data||{}).slice(0,8);
 const url=(nextPage:number)=>'/admin/history?'+new URLSearchParams({table,q:query,page:String(nextPage),batch:b.id});
 const exportUrl='/admin/history/export?'+new URLSearchParams({table,q:query,batch:b.id});
 return <main>
  <div className="management-heading"><div><span className="eyebrow muted">BUSINESS HISTORY</span><h1>Former store records</h1><p>Search and export the original {b.source_site} records. Snapshot: {b.snapshot_date}.</p></div><Link className="small-button" href={exportUrl}>Export matching records</Link></div>
  <p className="info-message">These are historical source records. Old payment labels have not been verified against processor receipts. They do not change current orders, prices, stock, wallets or revenue. Some source orders have missing item lines; the original gaps are retained.</p>
  <div className="stat-grid"><article><div>Customers</div><strong>{(b.counts.users||0).toLocaleString()}</strong></article><article><div>Old order headers</div><strong>{(b.counts.orders||0).toLocaleString()}</strong></article><article><div>Headers without item lines</div><strong>{b.reconciliation.orders_without_details.toLocaleString()}</strong></article><article><div>Item lines without a header</div><strong>{b.reconciliation.orphan_detail_rows.toLocaleString()}</strong></article></div>
  <form action="/admin/history" className="table-toolbar"><input type="hidden" name="batch" value={b.id}/><label>Records <select name="table" defaultValue={table}>{Object.entries(b.counts).sort(([a],[c])=>a.localeCompare(c)).map(([name,count])=><option key={name} value={name}>{label(name)} ({count.toLocaleString()})</option>)}</select></label><label>Search <input name="q" type="search" defaultValue={query} placeholder="Old ID, customer, reference or text" maxLength={120}/></label><button className="small-button">Apply</button></form>
  <p className="muted">{result.count.toLocaleString()} matching records · Amounts and quantities retain their original source values.</p>
  <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{label(c)}</th>)}<th>Full record</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.source_id}>{columns.map(c=><td key={c}>{text(row.data[c])||'—'}</td>)}<td><details><summary>View all fields</summary><dl>{Object.entries(row.data).map(([key,value])=><div key={key}><dt><strong>{label(key)}</strong></dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxWidth:420}}>{text(value)||'—'}</dd></div>)}</dl></details></td></tr>)}</tbody></table>{!result.rows.length&&<p>No matching records.</p>}</div>
  {result.count>50&&<div className="pagination">{page>1&&<Link href={url(page-1)}>Previous</Link>}<span>Page {page} of {Math.ceil(result.count/50)}</span>{page*50<result.count&&<Link href={url(page+1)}>Next</Link>}</div>}
 </main>;
}
