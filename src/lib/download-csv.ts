import {csv} from './business';
export function downloadRows(name:string,rows:Record<string,unknown>[]){
 const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const text=csv([keys,...rows.map(row=>keys.map(key=>{const value=row[key];return value===null||value===undefined?null:typeof value==='number'?value:typeof value==='object'?JSON.stringify(value):String(value);} ))]);
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
