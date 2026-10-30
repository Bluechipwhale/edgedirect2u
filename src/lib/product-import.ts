import {z} from 'zod';
export const importColumns=['slug','name','category_id','brand','merchant_id','price_naira','image','description'] as const;
export const importRow=z.object({slug:z.string().regex(/^[a-z0-9-]{1,100}$/),name:z.string().trim().min(1).max(500),category_id:z.string().trim().min(1).max(100),brand:z.string().trim().min(1).max(160),merchant_id:z.string().trim().min(1).max(100),price_naira:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).transform(v=>{const [n,f='']=v.split('.');return Number(n)*100+Number(f.padEnd(2,'0'));}).pipe(z.number().int().positive().max(1_000_000_000)),image:z.string().max(1000).refine(v=>!v||/^https:\/\/[^\s]+$/.test(v)||/^\/(?!\/)[^\s]*$/.test(v),'Use HTTPS or a relative image URL'),description:z.string().trim().min(1).max(500)}).strict();
/** RFC 4180 quoted fields, including embedded newlines. Reject malformed/truncated input. */
export function parseImportCsv(text:string){
 if(text.length>1_000_000)throw Error('Choose a CSV smaller than 1 MB');
 text=text.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Malformed quoted CSV field');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];if(rows.length>251)throw Error('Use at most 250 products per import');}}
  else{if(closed)throw Error('Unexpected text after a quoted CSV field');field+=c;}
 }
 if(quoted)throw Error('Unclosed quoted CSV field');if(field||row.length){row.push(field);if(row.some(Boolean))rows.push(row);}
 const header=rows.shift();if(!header||header.length!==importColumns.length||header.some((h,i)=>h.trim()!==importColumns[i]))throw Error(`Use these columns in order: ${importColumns.join(',')}`);
 if(!rows.length||rows.length>250)throw Error('Use 1–250 products per import');
 const seen=new Set<string>();return rows.map((values,i)=>{
  const record=Object.fromEntries(importColumns.map((key,j)=>[key,values[j]||'']));const parsed=importRow.safeParse(record);
  let error=values.length!==header.length?'Column count does not match the header':parsed.success?'':parsed.error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join('; ');
  if(seen.has(record.slug))error=[error,'Duplicate slug in this file'].filter(Boolean).join('; ');seen.add(record.slug);
  return {line:i+2,data:parsed.success?{...parsed.data,price_kobo:parsed.data.price_naira}:null,error,slug:record.slug};
 });
}
