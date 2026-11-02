export type DeliveryFeedback={id:string;job_id:string;order_id:string;driver:string;rating:number;comment:string;status:string;created_at:string;updated_at:string};
export type FeedbackDelivery={job_id:string;order_id:string;reference:string;driver:string;rating:number|null;comment:string|null;status:string|null;created_at:string};
