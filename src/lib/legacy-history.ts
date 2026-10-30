export type HistoryRecord={source_id:string;data:Record<string,unknown>;checksum:string};
export type HistoryPage={batch:null|{id:string;source_site:string;snapshot_date:string;counts:Record<string,number>;reconciliation:{orders:number;orders_without_details:number;orphan_detail_rows:number};verified_at:string};count:number;rows:HistoryRecord[]};
export const historyColumns:Record<string,string[]>={
 orders:['id','customer_id','order_status','payment_status','payment_method','order_amount','shipping_cost','delivery_man_id','created_at'],
 order_details:['id','order_id','product_id','qty','price','tax','discount','delivery_status','payment_status'],
 users:['id','f_name','l_name','name','email','phone','street_address','city','state','route'],
 shipping_addresses:['id','customer_id','contact_person_name','address','city','state','phone','latitude','longitude'],
 products:['id','name','unit','unit_price','current_stock','status'],
 inventory:['id','store_name','payment_status','order_status','order_amount','delivery_man_id','created_at'],
 inventory_details:['id','inventory_id','product_id','qty','price','tax','discount'],
 delivery_men:['id','f_name','l_name','email','phone','is_active'],
};
export function label(value:string){return value.replaceAll('_',' ');}
export function text(value:unknown){return value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);}
