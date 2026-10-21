import {beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const {catalogue,records}=vi.hoisted(()=>({catalogue:vi.fn(),records:vi.fn()}));
vi.mock('@/lib/server',()=>({catalogue,records}));
vi.mock('@/components/product-card',()=>({ProductCard:()=>null}));
import Storefront from '../src/app/(shop)/merchants/[id]/page';
beforeEach(()=>{
  vi.clearAllMocks();
  records.mockResolvedValue([{id:'edge',data:{name:'Test store',status:'approved',description:'Store details'}}]);
  catalogue.mockResolvedValue({products:[],count:25,categories:[]});
});
async function render(page?:string|string[]){return renderToStaticMarkup(await Storefront({params:Promise.resolve({id:'edge'}),searchParams:Promise.resolve({page})}));}
it('lets shoppers reach later products while keeping the selected store',async()=>{
  const first=await render();expect(catalogue).toHaveBeenLastCalledWith('','','',1,'edge');
  expect(first).toContain('href="/merchants/edge?page=2"');expect(first).toContain('Page 1 of 3');expect(first).not.toContain('rel="prev"');
  const second=await render('2');expect(catalogue).toHaveBeenLastCalledWith('','','',2,'edge');
  expect(second).toContain('href="/merchants/edge?page=1"');expect(second).toContain('href="/merchants/edge?page=3"');
  const last=await render('3');expect(last).toContain('Page 3 of 3');expect(last).not.toContain('rel="next"');
});
it('uses a safe whole page number for malformed or repeated inputs',async()=>{
  for(const [input,wanted] of [['Infinity',1],['NaN',1],['-2',1],['2.5',2],[['2','9'],2],['1000000000',10000]] as const){
    await render(Array.isArray(input)?[...input]:input as string);
    expect(catalogue).toHaveBeenLastCalledWith('','','',wanted,'edge');
  }
});
it('gives shoppers a first-page recovery link when the requested page is empty',async()=>{
  expect(await render('9')).toContain('Return to the first page');
  catalogue.mockResolvedValue({products:[],count:0,categories:[]});
  const empty=await render();expect(empty).toContain('New finds are coming soon.');expect(empty).not.toContain('rel="next"');
});
