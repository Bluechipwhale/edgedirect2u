import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
const {enrich}=createRequire(import.meta.url)('../scripts/enrich-legacy-customers.cjs') as {
 enrich:(data:unknown,contacts:unknown[],locations:unknown[])=>Record<string,unknown>[];
};
const contact={legacyId:'12',name:'A shop...',email:'shop@example.com',phone:'08000',verified:true};
const location={legacyId:'12',latitude:null,longitude:null,street:'Old Road',state:'Lagos'};
const user={id:'12',f_name:'A complete',l_name:'shop',street_address:'New Road',state:'Lagos',city:'42'};
const address={id:'1',customer_id:'12',is_billing:'0',is_verified:'YES',address:'Shop Road',city:'42',latitude:'6.6',longitude:'3.4',updated_at:'2026-10-16'};
const data=(rows:unknown[])=>({tables:{users:[user],shipping_addresses:rows,st_local_govt:[{id_no:'42',local_govt:'Ikeja'}]}});

it('restores full names and resolves original area IDs without changing account identity',()=>{
 const [row]=enrich(data([address]),[contact],[location]);
 expect(row).toMatchObject({source_id:'12',first_name:'A complete',last_name:'shop',name:'A complete shop',recovered_gps:true,latitude:6.6,longitude:3.4,address:{street:'New Road',city:'Ikeja',state:'Lagos'}});
 expect(row).not.toHaveProperty('email');
 expect(row).not.toHaveProperty('password');
});

it('preserves earlier valid geofences and excludes billing or implausible GPS',()=>{
 const [existing]=enrich(data([address]),[contact],[{...location,latitude:'6.7',longitude:'3.5'}]);
 expect(existing).toMatchObject({latitude:6.7,longitude:3.5,recovered_gps:false});
 const [missing]=enrich(data([{...address,is_billing:'1'},{...address,id:'2',latitude:'51.5',longitude:'-0.1'}]),[contact],[location]);
 expect(missing).toMatchObject({latitude:null,longitude:null,recovered_gps:false});
});

it('requires complete matching source IDs before any maintenance',()=>{
 expect(()=>enrich({tables:{users:[user,user],shipping_addresses:[]}},[contact],[location])).toThrow('ID count mismatch');
 expect(()=>enrich({tables:{users:[{...user,id:'13'}],shipping_addresses:[]}},[contact],[location])).toThrow('Unmatched source customer');
});
