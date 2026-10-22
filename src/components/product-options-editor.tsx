'use client';
import {useRef,useState} from 'react';
type Options=Record<string,string[]>;
export function ProductOptionsEditor({value,onChange,onError}:{value:Options;onChange:(value:Options)=>void;onError:(error:string)=>void}){
 const nextId=useRef(Object.keys(value).length);
 const [rows,setRows]=useState(()=>Object.entries(value).map(([name,values],id)=>({id,name,values:values.join(', ')})));
 function update(next:typeof rows){
  setRows(next);const result:Options={},names=new Set<string>();
  for(const row of next){
   const name=row.name.trim(),values=row.values.split(',').map(v=>v.trim()).filter(Boolean);
   if(!name||!values.length){onError('Give each option a name and at least one value, or remove the empty row.');return;}
   if(name.length>60||values.length>30||values.some(v=>v.length>500)){onError('Use option names up to 60 characters and at most 30 values of 500 characters each.');return;}
   if(names.has(name.toLowerCase())||new Set(values.map(v=>v.toLowerCase())).size!==values.length){onError('Option names and their values must be unique.');return;}
   names.add(name.toLowerCase());Object.defineProperty(result,name,{value:values,enumerable:true,configurable:true,writable:true});
  }
  onError('');onChange(result);
 }
 return <fieldset className="product-options-editor"><legend>Product options</legend><p className="help-text">Add choices such as Size or Flavour. Separate the available values with commas.</p>{rows.map(row=><div className="product-option-row" key={row.id}><label>Option name<input value={row.name} maxLength={60} onChange={e=>update(rows.map(r=>r.id===row.id?{...r,name:e.target.value}:r))} placeholder="Size"/></label><label>Option values<input value={row.values} onChange={e=>update(rows.map(r=>r.id===row.id?{...r,values:e.target.value}:r))} placeholder="Small, Medium, Large"/></label><button type="button" className="small-button" aria-label={`Remove option ${row.name||'row'}`} onClick={()=>update(rows.filter(r=>r.id!==row.id))}>Remove</button></div>)}<button type="button" className="small-button" onClick={()=>update([...rows,{id:nextId.current++,name:'',values:''}])}>Add option</button></fieldset>;
}
