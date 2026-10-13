import Products from '../../products/page';
export default async function Category({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {const {id}=await params;return <Products searchParams={Promise.resolve({...await searchParams,category:id})}/>;}
