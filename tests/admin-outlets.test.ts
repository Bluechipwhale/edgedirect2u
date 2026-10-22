import {beforeEach,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const mocks=vi.hoisted(()=>({role:vi.fn(),local:vi.fn(),snapshot:vi.fn()}));
vi.mock('@/lib/server',()=>({requireRole:mocks.role,localMode:mocks.local}));
vi.mock('@/lib/platform-server',()=>({companySnapshot:mocks.snapshot}));
vi.mock('@/components/outlet-directory',()=>({OutletDirectory:({initialQuery}:{initialQuery:string})=>createElement('div',{'data-query':initialQuery},'Authorized outlet editor')}));
import Page from '../src/app/admin/outlets/page';
beforeEach(()=>{vi.resetAllMocks();mocks.role.mockResolvedValue({role:'admin'});mocks.local.mockResolvedValue(false);mocks.snapshot.mockResolvedValue({role:'company_admin'});});
it('requires admin authorization before loading private customer data',async()=>{
 mocks.role.mockRejectedValue(new Error('Forbidden'));await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow('Forbidden');expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('preserves company-level permissions and never presents editing to a field agent',async()=>{
 mocks.snapshot.mockResolvedValue({role:'field_agent'});const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));expect(html).toContain('Company authorization required');expect(html).not.toContain('Authorized outlet editor');
});
it('opens the flagship editor with the first repeated customer search value',async()=>{
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({q:['  customer 123  ','ignored']})}));expect(mocks.snapshot).toHaveBeenCalledWith('e-edge-direct-2u');expect(html).toContain('data-query="customer 123"');expect(html).toContain('Authorized outlet editor');
});
