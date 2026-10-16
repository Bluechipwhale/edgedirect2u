export type ReportMoneyRow={id:string;name:string;gross_kobo:number;orders?:number;quantity?:number};
export type AdminReport={
 from:string;to:string;
 overview:{orders:number;paid_orders:number;verified_payments_kobo:number;processed_refunds_kobo:number;active_products:number;inactive_products:number;warehouse_units:number;van_units:number};
 order_status:{status:string;payment_status:string;count:number}[];
 product_sales:ReportMoneyRow[];merchant_sales:ReportMoneyRow[];top_customers:ReportMoneyRow[];
 drivers:{id:string;name:string;deliveries:number}[];
 payments:{reference:string;amount_kobo:number;verified_at:string}[];
 refunds:{id:string;order_id:string;amount_kobo:number;status:string;created_at:string}[];
};
