export class GoogleError extends Error {
  constructor(public status: number, public providerCode = '') { super('Google request failed'); }
  get revoked(): boolean { return this.providerCode === 'invalid_grant' || this.providerCode === 'invalid_token'; }
}
export async function googleJson(response: Response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new GoogleError(response.status, typeof value.error === 'string' ? value.error : '');
  return value;
}
