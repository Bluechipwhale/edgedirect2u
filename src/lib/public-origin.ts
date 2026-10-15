export function publicOrigin(request: Request): string {
  if (process.env.NODE_ENV !== 'production') return new URL(request.url).origin;
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || '');
  if (site.protocol !== 'https:' || site.username || site.password) throw new Error('A public HTTPS site URL is required');
  return site.origin;
}
