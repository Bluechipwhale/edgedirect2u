import {beforeEach,afterAll,it,expect,vi} from 'vitest';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const mocks=vi.hoisted(()=>({actor:vi.fn(),local:vi.fn(),rpc:vi.fn(),redirect:vi.fn((url:string)=>{throw Error('Redirect '+url);})}));
vi.mock('@/lib/server',()=>({actor:mocks.actor,localMode:mocks.local,supabase:async()=>({rpc:mocks.rpc})}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect}));
import Page from '../src/app/admin/history/page';
vi.stubGlobal('React',React);
afterAll(()=>vi.unstubAllGlobals());
beforeEach(()=>{vi.clearAllMocks();mocks.actor.mockResolvedValue({role:'admin'});mocks.local.mockResolvedValue(false);});
it('redirects signed-out visitors to sign-in without reading any private data',async()=>{
 mocks.actor.mockResolvedValue(null);await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('Redirect /login?next=/admin/history');expect(mocks.rpc).not.toHaveBeenCalled();
});
it('shows a clear access message to non-admin staff',async()=>{
 mocks.actor.mockResolvedValue({role:'operations'});expect(renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}))).toContain('Administrator access required');expect(mocks.rpc).not.toHaveBeenCalled();
});
it('renders verified source records, reconciliation gaps and a pinned export link',async()=>{
 mocks.rpc.mockResolvedValue({error:null,data:{batch:{id:'a'.repeat(64),source_site:'edgedirect2u.com.ng',snapshot_date:'2026-10-29',counts:{orders:2,users:1},reconciliation:{orders_without_details:1,orphan_detail_rows:0}},count:2,rows:[{source_id:'10',data:{id:'10',order_amount:'125.50',order_status:'paid'},checksum:'b'.repeat(64)}]}});
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain('125.50');expect(html).toContain('Headers without item lines');expect(html).toContain('/admin/history/export?table=orders');expect(html).toContain('batch='+ 'a'.repeat(64));
});
