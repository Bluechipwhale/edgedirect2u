import {z} from 'zod';
export const orderQueues=['pending','confirmed','packaging','out_for_delivery','delivered','returned','failed','cancelled'] as const;
export const orderFilters=z.object({q:z.string().max(120).default(''),queue:z.enum(['',...orderQueues]).default(''),payment:z.enum(['','pending','paid','refunded']).default(''),from:z.iso.date(),to:z.iso.date()}).refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000,'Choose a period of up to 366 days');
