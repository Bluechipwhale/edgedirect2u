export function categoryScope(rows:{id:string;parent_id?:string|null}[],id:string){
 const found=new Set([id]);let parents=[id];
 for(let depth=0;depth<2;depth++){
  const next=rows.filter(r=>r.parent_id&&parents.includes(r.parent_id)&&!found.has(r.id)).map(r=>r.id);
  next.forEach(id=>found.add(id));parents=next;
 }
 return [...found];
}
