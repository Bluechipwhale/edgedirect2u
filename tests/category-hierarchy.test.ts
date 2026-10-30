import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
let db:PGlite;
beforeAll(async()=>{db=new PGlite();await db.exec('create table categories(id text primary key,name text not null,image text not null,parent_id text references categories(id));');await db.exec(readFileSync('supabase/migrations/029_category_hierarchy.sql','utf8'));});
afterAll(async()=>db?.close());
it('supports root, subcategory and third-level category with editable order',async()=>{
 await db.exec("insert into categories(id,name,image) values('root','Food','');insert into categories(id,name,image,parent_id,sort_order) values('child','Snacks','','root',2),('other','Drinks','','root',1);insert into categories(id,name,image,parent_id) values('third','Biscuits','','child');");
 expect((await db.query<{id:string}>("select id from categories where parent_id='root' order by sort_order,name")).rows.map(r=>r.id)).toEqual(['other','child']);
});
it('rejects cycles and a fourth level while retaining the original tree',async()=>{
 await expect(db.exec("update categories set parent_id='third' where id='root'")).rejects.toThrow();
 await expect(db.exec("insert into categories(id,name,image,parent_id) values('fourth','Too deep','','third')")).rejects.toThrow('three category levels');
 expect((await db.query<{parent_id:string|null}>("select parent_id from categories where id='root'")).rows[0].parent_id).toBe(null);
});
it('validates the descendant depth when moving a whole branch',async()=>{
 await db.exec("insert into categories(id,name,image) values('new-root','New','')");
 await expect(db.exec("update categories set parent_id='new-root' where id='root'")).rejects.toThrow('exceed three levels');
 await db.exec("update categories set parent_id='new-root' where id='child'");
 expect((await db.query<{parent_id:string}>("select parent_id from categories where id='third'")).rows[0].parent_id).toBe('child');
 await expect(db.exec("update categories set sort_order=-1 where id='child'")).rejects.toThrow();
});
