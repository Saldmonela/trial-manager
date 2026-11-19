import type {
  CockpitArgonStatus,
  CockpitEligibilityStatus,
  CockpitImportAccountInput,
  CockpitPlanTier,
  CockpitQuotaItem,
} from '../types';

export const MAX_COCKPIT_IMPORT_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE_KEY_RE = /token|secret|pass|cookie|auth|credential|key/i;

export interface ParsedCockpitSnapshot {
  accounts: CockpitImportAccountInput[];
  skipped: Array<{ index: number; reason: string }>;
  strippedSecretFieldsCount: number;
}

export class CockpitParseError extends Error {
  constructor(
    public code: 'TOO_LARGE' | 'INVALID_FORMAT' | 'EMPTY_DATA',
    message: string,
  ) {
    super(message);
    this.name = 'CockpitParseError';
  }
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, 60);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 20) break;
  }
  return out;
}

export function deriveEligibilityStatus(tags: string[]): CockpitEligibilityStatus {
  const lowered = tags.map((t) => t.toLowerCase());
  if (lowered.some((t) => t === 'ban' || t === 'banned')) return 'ban';
  if (lowered.some((t) => t === 'need verif' || t === 'need_verif' || t === 'need-verif')) {
    return 'need_verif';
  }
  if (lowered.some((t) => t === 'bisa')) return 'bisa';
  return 'untagged';
}

export function isActiveCockpitEligibility(status: CockpitEligibilityStatus): boolean {
  return status === 'bisa' || status === 'untagged';
}

export function isArgonModelName(modelName: string): boolean {
  const lower = modelName.trim().toLowerCase();
  return (
    lower.includes('argon') ||
    lower === 'argon:weekly' ||
    lower === 'gemini-argon-wtu-weekly'
  );
}

export function getArgonQuotaPct(quotas: CockpitQuotaItem[]): number | null {
  for (const q of quotas) {
    if (isArgonModelName(q.model) && typeof q.remaining_pct === 'number' && Number.isFinite(q.remaining_pct)) {
      return q.remaining_pct;
    }
  }
  return null;
}

export function parseArgonStatus(raw: unknown): CockpitArgonStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === 'available' || lower === 'missing' || lower === 'unknown') {
    return lower;
  }
  return undefined;
}

/**
 * Menurunkan status ketersediaan kuota Gemini 4 Argon dari data `quotas` dan `tags`:
 * 1. Jika data `quotas` tersedia (dari Cockpit Tools `fetchAvailableModels` / `quota.models`):
 *    - Ada entri Argon (`argon:weekly` / `gemini-argon-wtu-weekly` / `Gemini 4 Argon`) dengan angka % -> 'available'
 *    - Ada entri Argon dengan `remaining_pct === null` (`—`), ATAU ada model lain tapi tanpa Argon -> 'missing'
 * 2. Jika tidak ada `quotas`, cek `tags` manual dari Cockpit Tools:
 *    - `no argon`, `no-argon`, `no_argon`, `non argon`, `non-argon`, `tanpa argon`, `limited` -> 'missing'
 *    - `argon`, `ada argon`, `full model`, `full` -> 'available'
 * 3. Selain itu -> 'unknown'
 */
export function deriveArgonStatus(
  quotas: CockpitQuotaItem[],
  tags: string[],
): CockpitArgonStatus {
  if (Array.isArray(quotas) && quotas.length > 0) {
    const argonItems = quotas.filter((q) => isArgonModelName(q.model));
    if (argonItems.some((q) => typeof q.remaining_pct === 'number' && Number.isFinite(q.remaining_pct))) {
      return 'available';
    }
    return 'missing';
  }

  const lowered = tags.map((t) => t.toLowerCase());
  if (
    lowered.some(
      (t) =>
        t === 'no argon' ||
        t === 'no-argon' ||
        t === 'no_argon' ||
        t === 'non argon' ||
        t === 'non-argon' ||
        t === 'tanpa argon' ||
        t === 'limited' ||
        t === 'model terbatas',
    )
  ) {
    return 'missing';
  }
  if (
    lowered.some(
      (t) => t === 'argon' || t === 'ada argon' || t === 'full model' || t === 'full',
    )
  ) {
    return 'available';
  }

  return 'unknown';
}

/**
 * Akun prioritas adalah akun aktif (`bisa` / `untagged`) yang TIDAK ditandai `missing` (No Argon).
 * Hanya akun prioritas yang memicu Konflik Family Ganda (BR-02).
 */
export function isPriorityCockpitAccount(
  eligibilityStatus: CockpitEligibilityStatus,
  argonStatus: CockpitArgonStatus = 'unknown',
): boolean {
  return isActiveCockpitEligibility(eligibilityStatus) && argonStatus !== 'missing';
}

function sanitizeQuotas(raw: unknown): CockpitQuotaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CockpitQuotaItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const rawModel =
      typeof rec.model === 'string' && rec.model.trim()
        ? rec.model.trim()
        : typeof rec.display_name === 'string' && rec.display_name.trim()
          ? rec.display_name.trim()
          : typeof rec.name === 'string' && rec.name.trim()
            ? rec.name.trim()
            : '';
    if (!rawModel) continue;

    const rawPct =
      typeof rec.remaining_pct === 'number' && Number.isFinite(rec.remaining_pct)
        ? rec.remaining_pct
        : typeof rec.percentage === 'number' && Number.isFinite(rec.percentage)
          ? rec.percentage
          : null;
    const pct = rawPct !== null ? Math.max(0, Math.min(100, Math.round(rawPct))) : null;

    const rawReset =
      typeof rec.reset_at === 'string' && rec.reset_at.trim()
        ? rec.reset_at
        : typeof rec.reset_time === 'string' && rec.reset_time.trim()
          ? rec.reset_time
          : '';
    let resetAt: string | null = null;
    if (rawReset) {
      const parsed = new Date(rawReset);
      if (!Number.isNaN(parsed.getTime())) resetAt = parsed.toISOString();
    }
    out.push({ model: rawModel.slice(0, 60), remaining_pct: pct, reset_at: resetAt });
    if (out.length >= 20) break;
  }
  return out;
}

function parsePlanTier(raw: unknown): CockpitPlanTier | undefined {
  if (typeof raw !== 'string') return undefined;
  const upper = raw.trim().toUpperCase();
  if (upper === 'PRO' || upper === 'ULTRA') return 'PRO';
  if (upper === 'FREE' || upper === 'AUTO_FAMILY') {
    return upper;
  }
  return undefined;
}

/**
 * Parses and sanitizes Cockpit Tools export JSON directly in the browser.
 * Enforces BR-05 (strict allowlist): refresh_token and any other sensitive fields
 * are stripped immediately and never leave the browser.
 */
export function parseCockpitExportText(rawText: string): ParsedCockpitSnapshot {
  const byteSize = new TextEncoder().encode(rawText).byteLength;
  if (byteSize > MAX_COCKPIT_IMPORT_BYTES) {
    throw new CockpitParseError('TOO_LARGE', 'Ukuran berkas melebihi batas maksimal 5 MB.');
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new CockpitParseError(
      'EMPTY_DATA',
      'Tidak ada data akun yang ditemukan di dalam berkas ini.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new CockpitParseError(
      'INVALID_FORMAT',
      'Berkas tidak dapat dibaca. Pastikan Anda memilih berkas ekspor yang valid dari Cockpit Tools.',
    );
  }

  let rawList: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).accounts)) {
    rawList = (parsed as Record<string, unknown>).accounts as unknown[];
  }

  if (!rawList) {
    throw new CockpitParseError(
      'INVALID_FORMAT',
      'Berkas tidak dapat dibaca. Pastikan Anda memilih berkas ekspor yang valid dari Cockpit Tools.',
    );
  }

  if (rawList.length === 0) {
    throw new CockpitParseError(
      'EMPTY_DATA',
      'Tidak ada data akun yang ditemukan di dalam berkas ini.',
    );
  }

  const skipped: Array<{ index: number; reason: string }> = [];
  const deduped = new Map<string, CockpitImportAccountInput>();
  let strippedSecretFieldsCount = 0;
  let hasCurrent = false;

  for (let i = 0; i < rawList.length; i += 1) {
    const item = rawList[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped.push({ index: i, reason: 'Format baris tidak valid' });
      continue;
    }

    const rec = item as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        strippedSecretFieldsCount += 1;
      }
    }

    const email = typeof rec.email === 'string' ? normalizeEmail(rec.email) : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      skipped.push({ index: i, reason: 'Format email tidak valid' });
      continue;
    }

    const tags = normalizeTags(rec.tags);
    const eligibility_status = deriveEligibilityStatus(tags);
    const is_current = rec.is_current === true && !hasCurrent;
    if (is_current) hasCurrent = true;

    let switch_time: string | null = null;
    if (typeof rec.switch_time === 'string' && rec.switch_time.trim()) {
      const d = new Date(rec.switch_time);
      if (!Number.isNaN(d.getTime())) switch_time = d.toISOString();
    }

    const notes =
      typeof rec.notes === 'string' && rec.notes.trim() ? rec.notes.trim().slice(0, 500) : null;

    // Support both flat `quotas` array and Cockpit Tools native `quota: { models, subscription_tier, credits }`
    const nativeQuota =
      rec.quota && typeof rec.quota === 'object' && !Array.isArray(rec.quota)
        ? (rec.quota as Record<string, unknown>)
        : null;

    const quotas = Array.isArray(rec.quotas)
      ? sanitizeQuotas(rec.quotas)
      : nativeQuota && Array.isArray(nativeQuota.models)
        ? sanitizeQuotas(nativeQuota.models)
        : [];

    const explicitArgon = parseArgonStatus(rec.argon_status);
    const argon_status = explicitArgon ?? deriveArgonStatus(quotas, tags);

    let available_ai_credits: number | null =
      typeof rec.available_ai_credits === 'number' && Number.isFinite(rec.available_ai_credits)
        ? rec.available_ai_credits
        : null;
    if (available_ai_credits === null && nativeQuota && Array.isArray(nativeQuota.credits)) {
      const sum = nativeQuota.credits.reduce((acc: number, c: unknown) => {
        if (!c || typeof c !== 'object') return acc;
        const amt = Number((c as Record<string, unknown>).credit_amount);
        return Number.isFinite(amt) ? acc + amt : acc;
      }, 0);
      if (nativeQuota.credits.length > 0 && Number.isFinite(sum)) {
        available_ai_credits = sum;
      }
    }

    const plan_tier =
      parsePlanTier(rec.plan_tier) ??
      (nativeQuota ? parsePlanTier(nativeQuota.subscription_tier) : undefined);

    deduped.set(email, {
      email,
      tags,
      eligibility_status,
      argon_status,
      plan_tier,
      is_current,
      switch_time,
      quotas,
      available_ai_credits,
      notes,
    });
  }

  const accounts = Array.from(deduped.values());
  if (accounts.length === 0) {
    throw new CockpitParseError(
      'EMPTY_DATA',
      'Tidak ada data akun yang ditemukan di dalam berkas ini.',
    );
  }

  return {
    accounts,
    skipped,
    strippedSecretFieldsCount,
  };
}
