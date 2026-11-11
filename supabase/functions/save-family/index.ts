import { ApiError, checkDb, emailField, endpoint, readBody, requireAdmin, textField } from '../_shared/api.ts';
import type { JsonRecord } from '../_shared/api.ts';
import { encryptCredential } from '../_shared/credentials.ts';
import { serviceClient } from '../_shared/supabase.ts';

Deno.serve(endpoint(async req => {
  const actor = await requireAdmin(req); const body = await readBody(req, 16384);
  const id = textField(body.id, 'ID', 128);
  const input: JsonRecord = { ...body, id, name: textField(body.name, 'Nama', 200, false), ownerEmail: emailField(body.ownerEmail) };
  if (!['create', 'update'].includes(String(body.operation)) || !['slot', 'account_ready'].includes(String(body.productType))) throw new ApiError('INVALID_INPUT', 'Jenis operasi atau produk tidak valid.');
  for (const field of ['storageUsed', 'priceMonthly', 'priceAnnual', 'priceSale']) {
    const value = body[field] ?? 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'storageUsed' && value > 5120)) throw new ApiError('INVALID_INPUT', 'Harga atau storage tidak valid.');
    input[field] = value;
  }
  if (body.expiryDate && (typeof body.expiryDate !== 'string' || !Number.isFinite(Date.parse(body.expiryDate)))) throw new ApiError('INVALID_DATE', 'Tanggal tidak valid.');
  for (const field of ['isBanned','isPublic','isActive']) if (body[field] !== undefined && typeof body[field] !== 'boolean') throw new ApiError('INVALID_INPUT', 'Status family tidak valid.');
  input.notes = textField(body.notes ?? '', 'Catatan', 5000, false);
  if (body.operation === 'create' && body.members !== undefined) {
    if (!Array.isArray(body.members) || body.members.length > 5) throw new ApiError('INVALID_MEMBERS', 'Maksimal 5 member.');
    input.members = body.members.map(value => {
      if (!value || typeof value !== 'object') throw new ApiError('INVALID_MEMBERS', 'Member tidak valid.');
      const m = value as JsonRecord; const storage = Number(m.storageUsed ?? m.storage_used ?? 0);
      if (!Number.isFinite(storage) || storage < 0) throw new ApiError('INVALID_STORAGE', 'Storage member tidak valid.');
      return { id: m.id ? textField(m.id, 'ID member', 128) : crypto.randomUUID(), name: textField(m.name ?? '', 'Nama member', 100, false), email: emailField(m.email), storageUsed: storage, memberType: m.memberType === 'pribadi' ? 'pribadi' : 'pembeli', expiryDate: m.memberType === 'pribadi' ? null : (m.expiryDate || null), addedAt: m.addedAt || null };
    });
  }
  if (body.operation === 'update') delete input.members;
  let encrypted: string | null = null;
  if (Object.hasOwn(body, 'ownerPassword')) {
    if (typeof body.ownerPassword !== 'string' || body.ownerPassword.length === 0 || body.ownerPassword.length > 4096) throw new ApiError('INVALID_PASSWORD', 'Password tidak valid.');
    encrypted = await encryptCredential(body.ownerPassword, id);
  } else if (body.operation === 'create') throw new ApiError('PASSWORD_REQUIRED', 'Password wajib diisi.');
  delete input.ownerPassword;
  const { data, error } = await serviceClient().rpc('app_save_family', { p_actor: actor.id, p_input: input, p_ciphertext: encrypted });
  checkDb(error); return { id: data };
}));
