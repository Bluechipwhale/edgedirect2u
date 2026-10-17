import {createRequire} from 'node:module';
import {expect,it} from 'vitest';

const {parseDump}=createRequire(import.meta.url)('../scripts/inspect-legacy-export.cjs') as {
  parseDump:(sql:string,allowed:Set<string>)=>{tables:Record<string,Record<string,string|null>[]>};
};
const schema="CREATE TABLE `users` (\n `id` int,\n `name` text,\n `note` text\n) ENGINE=InnoDB;\n";

it('reads escaped MySQL data without treating embedded punctuation as SQL',()=>{
  const sql=schema+"INSERT INTO `users` VALUES (1,'O\\'Brien','comma, tuple); and \\n newline'),(2,'Ada''s shop',NULL);";
  expect(parseDump(sql,new Set(['users'])).tables.users).toEqual([
    {id:'1',name:"O'Brien",note:'comma, tuple); and \n newline'},
    {id:'2',name:"Ada's shop",note:null},
  ]);
});

it('honors explicit column order and the table allowlist',()=>{
  const sql=schema+"INSERT INTO `users` (`name`,`id`,`note`) VALUES ('Shop',8,'ok');";
  expect(parseDump(sql,new Set(['users'])).tables.users[0]).toEqual({name:'Shop',id:'8',note:'ok'});
  expect(parseDump(sql,new Set()).tables).toEqual({});
});

it('rejects executable expressions and malformed tuple lengths',()=>{
  expect(()=>parseDump(schema+"INSERT INTO `users` VALUES (1,LOAD_FILE('/secret'),NULL);",new Set(['users']))).toThrow('Unsupported SQL literal');
  expect(()=>parseDump(schema+"INSERT INTO `users` VALUES (1,'Short');",new Set(['users']))).toThrow('column count mismatch');
  expect(()=>parseDump(schema+"INSERT INTO `users` VALUES (1,'open",new Set(['users']))).toThrow('Unclosed SQL string');
});
