import {expect,it} from 'vitest';
import {cataloguePage,cataloguePrice,catalogueSearchParams} from '../src/lib/catalogue-query';
it('normalizes public catalogue pages without invalid database ranges',()=>{
  for(const value of [undefined,null,'',NaN,Infinity,-Infinity,'Infinity','NaN',{},[],0,-2])expect(cataloguePage(value)).toBe(1);
  expect(cataloguePage('2.5')).toBe(2);expect(cataloguePage(['3','9'])).toBe(3);expect(cataloguePage('1000000000')).toBe(10000);
});
it('keeps valid kobo filters and replaces non-finite price bounds',()=>{
  expect(cataloguePrice(125050,0)).toBe(125050);expect(cataloguePrice(125049.99999999999,0)).toBe(125050);
  expect(cataloguePrice(Infinity,0)).toBe(0);expect(cataloguePrice(NaN,Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  expect(cataloguePrice(-100,0)).toBe(0);
});
it('handles repeated URL parameters as the first selected value',()=>{
  expect(catalogueSearchParams({q:['Morning Fresh','Other'],category:['household'],brand:'PZ Cussons',page:undefined})).toEqual({q:'Morning Fresh',category:'household',brand:'PZ Cussons',page:undefined});
});
