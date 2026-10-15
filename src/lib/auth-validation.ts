import { z } from 'zod';
export const authInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email: z.email(), password: z.string().min(1).max(100) }),
  z.object({ action: z.literal('register'), email: z.email(), password: z.string().min(10).max(100), next: z.literal('/checkout').optional() }),
  z.object({ action: z.literal('recover'), email: z.email() }),
  z.object({ action: z.literal('update-password'), password: z.string().min(10).max(100) }),
  z.object({ action: z.literal('recovery-session'), access_token: z.string().min(20).max(10000), refresh_token: z.string().min(10).max(2000) }),
  z.object({ action: z.literal('logout') }),
]);
