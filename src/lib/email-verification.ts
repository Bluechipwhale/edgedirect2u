import { z } from 'zod';

export const emailVerification = z.object({
  token_hash: z.string().min(20).max(2000).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(['email', 'signup', 'recovery','invite']),
  next: z.enum(['/account', '/checkout', '/reset-password']).catch('/account'),
});
