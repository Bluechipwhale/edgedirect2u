import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({role:vi.fn(),local:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/server',()=>({requireRole:mocks.role,localMode:mocks.local,supabase:async()=>({rpc:mocks.rpc})}));
import {GET} from '../src/app/admin/history/export/route';
const batch='a'.repeat(64),request=()=>new Request('https://example.com/admin/history/export?table=orders&batch='+batch);
const result=(rows:object[],count:number)=>({data:{batch:{id:batch,source_site:'edgedirect2u.com.ng',snapshot_date:'2026-10-29'},count,rows},error:null});
beforeEach(()=>{vi.resetAllMocks();mocks.role.mockResolvedValue({role:'admin'});mocks.local.mockResolvedValue(false);});
it('requires administrator access before retrieving any history',async()=>{
 mocks.role.mockRejectedValue(Error('Forbidden'));expect((await GET(request())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
});
it('streams every page, preserves snapshot and filters, and escapes spreadsheet formulas',async()=>{
 mocks.rpc.mockResolvedValueOnce(result([{source_id:'1',data:{id:'1',name:'=SUM(1,2)'}}],2)).mockResolvedValueOnce(result([{source_id:'2',data:{id:'2',name:'Shop'}}],2));
 const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store');const csv=await response.text();expect(csv).toContain("'=SUM(1,2)");expect(csv).toContain('Shop');expect(mocks.rpc).toHaveBeenLastCalledWith('admin_legacy_history',expect.objectContaining({p_batch:batch,p_table:'orders',p_page:2,p_limit:1000}));
});
it('fails the download when a later page is missing instead of silently returning a partial file',async()=>{
 mocks.rpc.mockResolvedValueOnce(result([{source_id:'1',data:{id:'1'}}],2)).mockResolvedValueOnce(result([],2));
 const response=await GET(request());await expect(response.text()).rejects.toThrow('interrupted');
});
