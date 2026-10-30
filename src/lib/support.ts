import {z} from 'zod';
export const contactInput=z.object({id:z.uuid(),name:z.string().trim().min(1).max(160),email:z.email().max(254),subject:z.string().trim().min(3).max(160),body:z.string().trim().min(1).max(5000),website:z.string().max(100).default('')}).strict();
export type SupportTicket={id:string;name:string;email:string;subject:string;status:string;created_at:string;updated_at:string};
export type SupportMessage={id:string;staff:boolean;body:string;created_at:string};
