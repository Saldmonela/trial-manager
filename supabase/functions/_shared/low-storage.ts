import { checkDb } from './api.ts';
import type { serviceClient } from './supabase.ts';

export type LowStorageTier = '5GB' | '15GB';

export interface ExpiredFamilySummary {
  id: string;
  name: string;
}

export interface LowStorageDetectionResult {
  lowStorageTier: LowStorageTier | null;
  expiredFamilies: ExpiredFamilySummary[];
}

interface FamilyExpiryRow {
  id: string;
  name: string | null;
  owner_email: string | null;
  expiry_date: string | null;
}

const GB_BYTES = 1_000_000_000;
const GIB_BYTES = 1024 * 1024 * 1024;
const ONE_DAY_MS = 86_400_000;

/**
 * Detects whether a Google Drive total quota has dropped to a problematic 5 GB or 15 GB tier.
 * Accepts both binary GiB (what Google Drive API reports) and decimal GB within a narrow band.
 */
export function detectLowStorageTier(totalBytes: number | null | undefined): LowStorageTier | null {
  if (totalBytes === null || totalBytes === undefined) return null;
  const n = Number(totalBytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 4.9 * GB_BYTES && n <= 5.1 * GIB_BYTES) return '5GB';
  if (n >= 14.9 * GB_BYTES && n <= 15.1 * GIB_BYTES) return '15GB';
  return null;
}

/**
 * When a Google Drive account's quota is 5 GB or 15 GB, marks matching active families
 * (whose expiry_date is not already expired) as expired and records an audit trail.
 */
export async function expireFamiliesForLowStorage(
  svc: ReturnType<typeof serviceClient>,
  params: {
    actorId: string;
    email: string | null | undefined;
    totalBytes: number | null | undefined;
    previousTotalBytes?: number | null;
    nowMs?: number;
  },
): Promise<LowStorageDetectionResult> {
  const tier = detectLowStorageTier(params.totalBytes);
  if (!tier) return { lowStorageTier: null, expiredFamilies: [] };

  const normalizedEmail = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  if (!normalizedEmail) return { lowStorageTier: tier, expiredFamilies: [] };

  const { data: families, error: fetchError } = await svc
    .from('families')
    .select('id,name,owner_email,expiry_date')
    .is('archived_at', null);
  checkDb(fetchError);

  const matched = ((families ?? []) as FamilyExpiryRow[]).filter(
    (f) => typeof f.owner_email === 'string' && f.owner_email.trim().toLowerCase() === normalizedEmail,
  );
  if (matched.length === 0) return { lowStorageTier: tier, expiredFamilies: [] };

  const nowMs = params.nowMs ?? Date.now();
  // getDaysRemaining uses Math.ceil((expiry - now) / 1 day) and getExpiryStatus requires < 0 for EXPIRED.
  const toExpire = matched.filter((f) => {
    if (!f.expiry_date) return true;
    const parsed = Date.parse(f.expiry_date);
    return Number.isNaN(parsed) || parsed > nowMs - ONE_DAY_MS;
  });
  if (toExpire.length === 0) return { lowStorageTier: tier, expiredFamilies: [] };

  const expiredIso = new Date(nowMs - 2 * ONE_DAY_MS).toISOString();
  const ids = toExpire.map((f) => String(f.id));
  const { error: updateError } = await svc
    .from('families')
    .update({ expiry_date: expiredIso })
    .in('id', ids)
    .is('archived_at', null);
  checkDb(updateError);

  const auditRows = toExpire.map((f) => ({
    actor_id: params.actorId,
    object_type: 'family',
    object_id: String(f.id),
    action: 'auto_expired_low_storage',
    details: {
      email: normalizedEmail,
      tier,
      total_bytes: params.totalBytes ?? null,
      previous_total_bytes: params.previousTotalBytes ?? null,
      previous_expiry_date: f.expiry_date ?? null,
      new_expiry_date: expiredIso,
    },
  }));
  const { error: auditError } = await svc.from('app_audit_log').insert(auditRows);
  if (auditError) console.error('audit_log_failed', 'auto_expired_low_storage');

  return {
    lowStorageTier: tier,
    expiredFamilies: toExpire.map((f) => ({
      id: String(f.id),
      name: String(f.name || f.owner_email || 'Family Plan'),
    })),
  };
}
