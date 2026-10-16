import Link from 'next/link';
import { localMode, records, requireRole, supabase } from '@/lib/server';

type ImportedCustomer = {
  source_id:string; first_name:string; last_name:string; email:string|null; phone:string;
  address:Record<string,unknown>; route:string; legacy_order_count:number|null; blocked:boolean|null;
  details:{legacy_verified?:boolean;truncated_name?:boolean;blank_name?:boolean;unusable_legacy_email?:string}; linked_user_id:string|null; imported_at:string;
};
type ImportedPage = {count:number;rows:ImportedCustomer[];linked_count:number;missing_email_count:number;legacy_unverified_count:number;truncated_name_count:number};

export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  await requireRole(['admin']);
  const params=await searchParams;
  const query=(params.q||'').trim().slice(0,120);
  const page=Math.max(1,Math.min(100000,Math.floor(Number(params.page)||1)));
  let imported:ImportedPage={count:0,rows:[],linked_count:0,missing_email_count:0,legacy_unverified_count:0,truncated_name_count:0};
  if(!await localMode()){
    const {data,error}=await(await supabase()).rpc('admin_legacy_customers',{p_query:query,p_page:page});
    if(error)throw new Error('Customer directory is unavailable');
    imported=data as ImportedPage;
  }
  const registered=await records('customers');
  const search=new URLSearchParams(); if(query)search.set('q',query);
  const pageLink=(value:number)=>{const next=new URLSearchParams(search);next.set('page',String(value));return `/admin/customers?${next}`;};
  return <>
    <div className="management-heading"><div><span className="eyebrow muted">CUSTOMER RELATIONSHIPS</span><h1>Customers</h1><p>Customers imported from your former store and accounts registered on this website.</p></div><Link className="small-button" href="/admin/customers/export">Download customer CSV</Link></div>
    <div className="stat-grid"><article><div>Imported customer records</div><strong>{Number(imported.count).toLocaleString()}</strong><small>From edgedirect2u.com.ng</small></article><article><div>Linked accounts</div><strong>{Number(imported.linked_count).toLocaleString()}</strong><small>Confirmed email matches only</small></article><article><div>Unverified on former store</div><strong>{Number(imported.legacy_unverified_count).toLocaleString()}</strong><small>Old status kept for reference</small></article><article><div>Shortened old names</div><strong>{Number(imported.truncated_name_count).toLocaleString()}</strong><small>Review before using in messages</small></article></div>
    <p className="info-message" style={{marginBottom:22}}>Imported contacts are private. An existing customer can create an account with their own password and confirm their email to link their record. Previous passwords and order payments are not copied.</p>
    <form method="get" action="/admin/customers" className="table-toolbar"><div className="input-icon"><input type="search" name="q" aria-label="Search imported customers" defaultValue={query} placeholder="Search name, email, phone or old ID"/></div><button className="small-button">Search</button>{query&&<Link className="small-button" href="/admin/customers">Clear</Link>}<span>{Number(imported.count).toLocaleString()} matching records</span></form>
    <div className="table-wrap"><table><thead><tr><th>Legacy ID</th><th>Customer</th><th>Contact</th><th>Route</th><th>Old orders</th><th>Account</th></tr></thead><tbody>{imported.rows.map(row=><tr key={row.source_id}>
      <td><code>{row.source_id}</code></td>
      <td><strong>{[row.first_name,row.last_name].filter(Boolean).join(' ')||'Unnamed customer'}</strong>{row.details?.truncated_name&&<small className="table-small">Shortened in former store</small>}{row.blocked&&<small className="table-small">Blocked on former store</small>}{Boolean(row.address?.street)&&<small className="table-small">{[row.address.street,row.address.city,row.address.state].filter(Boolean).join(', ')}</small>}</td>
      <td>{row.email||'No usable email'}{row.details?.unusable_legacy_email&&<small className="table-small">Old value: {row.details.unusable_legacy_email}</small>}{row.phone&&<small className="table-small">{row.phone}</small>}</td>
      <td>{row.route||'—'}</td><td>{row.legacy_order_count??'—'}</td>
      <td><span className="status-chip">{row.linked_user_id?'Linked':'Pending sign-in'}</span><small className="table-small">Former store: {row.details?.legacy_verified?'verified':'not verified'}</small></td>
    </tr>)}</tbody></table>{!imported.rows.length&&<div className="empty-state"><h3>No matching customers.</h3><p>{query?'Try another name, phone, email or old ID.':'Imported customers will appear here after a verified export is applied.'}</p></div>}</div>
    {imported.count>50&&<div className="pagination">{page>1&&<Link href={pageLink(page-1)}>Previous</Link>}<span>Page {page} of {Math.ceil(imported.count/50)}</span>{page*50<imported.count&&<Link href={pageLink(page+1)}>Next</Link>}</div>}
    <section style={{marginTop:32}}><h2>Registered on this website</h2><p className="muted">Recent customer accounts in Supabase Auth. An imported contact appears in this list after that person registers and confirms their email.</p><div className="table-wrap"><table><thead><tr><th>Account ID</th><th>Name</th><th>Created</th></tr></thead><tbody>{registered.map(row=><tr key={row.id}><td><code>{row.id}</code></td><td>{String(row.data.name||'Unnamed customer')}</td><td>{new Date(row.created_at).toLocaleDateString('en-NG')}</td></tr>)}</tbody></table>{!registered.length&&<div className="empty-state"><h3>No registered customers yet.</h3></div>}</div></section>
  </>;
}
