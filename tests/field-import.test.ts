import {createRequire} from 'node:module';
import {it,expect} from 'vitest';
const {normalize}=createRequire(import.meta.url)('../scripts/import-field-customers.cjs');
it('preserves customer identities while explicitly separating missing and implausible locations',()=>{
 const c=[{legacyId:'1',name:'Actual Store',phone:'08000000000',route:', Lagos State'},{legacyId:'2',name:'Other Store',route:'Ogba, Lagos State'},{legacyId:'3',name:'Review Store',route:', Lagos'}];
 const g=[{legacyId:'1',latitude:'6.5',longitude:'3.4',state:'Lagos State'},{legacyId:'2',latitude:'',longitude:'',state:'Lagos State'},{legacyId:'3',latitude:'51.5',longitude:'-0.1'}];
 const rows=normalize(c,g);expect(rows[0]).toMatchObject({legacy_id:'1',name:'Actual Store',route:'',latitude:6.5,longitude:3.4,location_source:'legacy'});expect(rows[1]).toMatchObject({route:'Ogba',latitude:null,longitude:null,location_source:'missing'});expect(rows[1].address).toContain('Address not recorded');expect(rows[2].location_review).toContain('need review');expect(rows[2].latitude).toBeNull();
 expect(()=>normalize(c,g.slice(1))).toThrow('Missing');expect(()=>normalize(c,[...g,g[0]])).toThrow('Duplicate');
});
