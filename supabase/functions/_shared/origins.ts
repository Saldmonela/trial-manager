export function allowedOrigins(): string[] {
  return [...new Set([Deno.env.get('FRONTEND_URL') ?? '', ...(Deno.env.get('ALLOWED_FRONTEND_ORIGINS') ?? '').split(',')].filter(Boolean).map(v => new URL(v.trim()).origin))];
}
export function redirectTarget(origin: string, path: string): string {
  if (!allowedOrigins().includes(origin) || !['/storage', '/admin'].includes(path)) throw new Error('INVALID_REDIRECT');
  return new URL(path, origin).href;
}
