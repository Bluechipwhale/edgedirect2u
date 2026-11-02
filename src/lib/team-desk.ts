import {z} from 'zod';
const common={company:z.uuid(),agent:z.uuid()};
export const teamDeskAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('contact'),...common,name:z.string().trim().min(2).max(100),relationship:z.string().trim().min(2).max(80),phone:z.string().trim().regex(/^\+?[0-9 ()-]{10,25}$/)}).strict(),
 z.object({action:z.literal('schedule'),...common,id:z.uuid(),label:z.string().trim().min(2).max(100),start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true}),notes:z.string().max(500).default(''),active:z.boolean()}).strict(),
 z.object({action:z.literal('message'),...common,id:z.uuid(),body:z.string().trim().min(1).max(4000)}).strict(),
]);
export type TeamSchedule={id:string;label:string;starts_at:string;ends_at:string;notes:string;active:boolean};
export type TeamContact={name:string;relationship:string;phone:string;updated_at:string};
export type TeamMessage={id:string;from_manager:boolean;body:string;created_at:string};
export type TeamDesk={contact:TeamContact|null;messages:TeamMessage[];message_count:number;schedules:TeamSchedule[];schedule_count:number};
export const teamDeskFilter=z.object({company:z.uuid(),agent:z.uuid(),from:z.iso.date(),to:z.iso.date(),message_page:z.coerce.number().int().min(1).max(100000).default(1),schedule_page:z.coerce.number().int().min(1).max(100000).default(1)}).refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000,'Choose a period of up to 366 days');
