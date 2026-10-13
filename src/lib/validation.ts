import { z } from 'zod';
export const checkoutSchema = z.object({
  key: z.uuid(),
  items: z.array(z.object({ product_id: z.string().min(1).max(100), quantity: z.number().int().min(1).max(50), options: z.record(z.string(), z.string().max(80)).default({}) })).min(1).max(50),
  address: z.object({ name: z.string().min(2).max(100), email: z.email(), phone: z.string().regex(/^\+?[\d\s()-]{10,18}$/), street: z.string().min(5).max(250), city: z.string().min(2).max(80), state: z.enum(['Lagos', 'Ogun', 'Oyo', 'Abuja', 'Rivers', 'Other']) }),
  coupon: z.string().max(40).default(''),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export function assertRole(actual: string, allowed: string[]) { if (!allowed.includes(actual)) throw new Error('Forbidden'); }
export function fee(state: string) { return state === 'Lagos' ? 250000 : state === 'Ogun' || state === 'Oyo' ? 350000 : 500000; }
