import { z } from 'zod';
export const authInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email: z.email(), password: z.string().min(1).max(100) }),
  z.object({ action: z.literal('register'), email: z.email(), password: z.string().min(10).max(100) }),
  z.object({ action: z.literal('recover'), email: z.email() }),
  z.object({ action: z.literal('update-password'), password: z.string().min(10).max(100) }),
  z.object({ action: z.literal('logout') }),
]);
