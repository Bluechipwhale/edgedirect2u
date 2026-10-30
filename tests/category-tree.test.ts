import {it,expect} from 'vitest';
import {categoryScope} from '../src/lib/category-tree';
it('includes subcategory and third-level products when browsing a parent',()=>{
 const rows=[{id:'food'},{id:'snacks',parent_id:'food'},{id:'biscuits',parent_id:'snacks'},{id:'cleaning'}];
 expect(categoryScope(rows,'food')).toEqual(['food','snacks','biscuits']);expect(categoryScope(rows,'snacks')).toEqual(['snacks','biscuits']);
});
it('does not loop on invalid legacy cycles or include unrelated categories',()=>{
 expect(categoryScope([{id:'a',parent_id:'b'},{id:'b',parent_id:'a'},{id:'c'}],'a')).toEqual(['a','b']);
 expect(categoryScope([],'unknown')).toEqual(['unknown']);
});
