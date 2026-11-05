import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({role:vi.fn(),from:vi.fn(),range:vi.fn()}));
vi.mock('@/lib/server',()=>({requireRole:mocks.role,supabase:async()=>({from:mocks.from})}));
import {GET} from '../src/app/admin/pos/export/route';
const receipt={amount_kobo:1402500,tender_kobo:1420000,external_reference:'recorded-cash-reference',confirmed_at:'2026-11-05T19:37:00Z',note:'Counted cash'};
const sale={id:'sale-1',reference:'edge-pos-example',buyer:{name:'Customer',email:'',phone:''},created_by:'clerk',method:'cash',status:'paid',created_at:'2026-11-05T19:30:00Z',total_kobo:1402500,pos_items:[],pos_receipts:receipt,pos_refunds:[]};
const request=()=>new Request('https://example.invalid/admin/pos/export?sale=sale-1');
beforeEach(()=>{
 vi.resetAllMocks();mocks.role.mockResolvedValue({role:'admin'});
 const query={select:()=>query,eq:()=>query,order:()=>query,range:mocks.range};
 mocks.from.mockReturnValue(query);
 mocks.range.mockReturnValue({abortSignal:async()=>({data:[sale],count:1,error:null})});
});
it('exports the recorded one-to-one receipt including cash change',async()=>{
 const response=await GET(request());expect(response.status).toBe(200);
 expect(response.headers.get('Cache-Control')).toContain('no-store');
 const csv=await response.text();expect(csv).toContain('"14025.00","14025.00","14200.00","175.00","recorded-cash-reference"');
 expect(mocks.role).toHaveBeenCalledWith(['admin','operations']);
});
it('keeps unconfirmed sale exports blank instead of inventing a payment',async()=>{
 mocks.range.mockReturnValue({abortSignal:async()=>({data:[{...sale,status:'reserved',pos_receipts:null}],count:1,error:null})});
 const response=await GET(request());expect(response.status).toBe(200);expect(await response.text()).toContain('"14025.00","","","","",""');
});
it('rejects exports before querying financial records when access is denied',async()=>{
 mocks.role.mockRejectedValue(Error('Forbidden'));expect((await GET(request())).status).toBe(403);expect(mocks.from).not.toHaveBeenCalled();
});
