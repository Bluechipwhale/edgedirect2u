'use client';
import {Download} from 'lucide-react';
import {csv} from '@/lib/business';

export function AdminReportExport({name,rows}:{name:string;rows:(string|number|null)[][]}){
 return <button type="button" className="small-button" onClick={()=>{
   const blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);const a=document.createElement('a');
   a.href=url;a.download=`edge-${name}.csv`;a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 }}><Download size={14}/>Export CSV</button>;
}
