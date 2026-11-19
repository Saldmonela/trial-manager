import { ApiError, checkDb, endpoint, readBody, requireAdmin } from '../_shared/api.ts';
import { serviceClient } from '../_shared/supabase.ts';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PLAN_TIERS = new Set(['AUTO_FAMILY', 'PRO', 'FREE']);

type EligibilityStatus = 'bisa' | 'ban' | 'need_verif' | 'untagged';
type ArgonStatus = 'available' | 'missing' | 'unknown';

interface SanitizedQuota {
  model: string;
  remaining_pct: number | null;
  reset_at: string | null;
}

interface SanitizedAccount {
  email: string;
  plan_tier?: 'AUTO_FAMILY' | 'PRO' | 'FREE';
  eligibility_status: EligibilityStatus;
  argon_status: ArgonStatus;
  raw_tags: string[];
  is_current: boolean;
  switch_time: string | null;
  quotas: SanitizedQuota[];
  available_ai_credits: number | null;
  notes: string | null;
}

function normalizeTags(raw: unknown): string[] {
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

function deriveEligibility(tags: string[]): EligibilityStatus {
  const lowered = tags.map((t) => t.toLowerCase());
  if (lowered.some((t) => t === 'ban' || t === 'banned')) return 'ban';
  if (lowered.some((t) => t === 'need verif' || t === 'need_verif' || t === 'need-verif')) return 'need_verif';
  if (lowered.some((t) => t === 'bisa')) return 'bisa';
  return 'untagged';
}

function isArgonModelName(modelName: string): boolean {
  const lower = modelName.trim().toLowerCase();
  return lower.includes('argon') || lower === 'argon:weekly' || lower === 'gemini-argon-wtu-weekly';
}

function parseArgonStatus(raw: unknown): ArgonStatus | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === 'available' || lower === 'missing' || lower === 'unknown') {
    return lower;
  }
  return undefined;
}

function deriveArgonStatus(quotas: SanitizedQuota[], tags: string[]): ArgonStatus {
  if (quotas.length > 0) {
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
  if (lowered.some((t) => t === 'argon' || t === 'ada argon' || t === 'full model' || t === 'full')) {
    return 'available';
  }
  return 'unknown';
}

function sanitizeQuotas(raw: unknown): SanitizedQuota[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedQuota[] = [];
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
    const model = rawModel.slice(0, 60);
    let pct: number | null = null;
    const rawPct =
      typeof rec.remaining_pct === 'number' && Number.isFinite(rec.remaining_pct)
        ? rec.remaining_pct
        : typeof rec.percentage === 'number' && Number.isFinite(rec.percentage)
          ? rec.percentage
          : null;
    if (rawPct !== null) {
      pct = Math.max(0, Math.min(100, Math.round(rawPct)));
    }
    let resetAt: string | null = null;
    const rawReset =
      typeof rec.reset_at === 'string' && rec.reset_at.trim()
        ? rec.reset_at
        : typeof rec.reset_time === 'string' && rec.reset_time.trim()
          ? rec.reset_time
          : '';
    if (rawReset) {
      const parsed = new Date(rawReset);
      if (!Number.isNaN(parsed.getTime())) resetAt = parsed.toISOString();
    }
    out.push({ model, remaining_pct: pct, reset_at: resetAt });
    if (out.length >= 20) break;
  }
  return out;
}

function sanitizeIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

Deno.serve(endpoint(async (req) => {
  const user = await requireAdmin(req);
  const body = await readBody(req, MAX_IMPORT_BYTES);

  if (!Array.isArray(body.accounts)) {
    throw new ApiError('INVALID_BODY', 'Daftar akun tidak ditemukan di dalam permintaan.', 422);
  }

  const skipped: Array<{ index: number; reason: string }> = [];
  const deduped = new Map<string, SanitizedAccount>();
  let hasCurrent = false;

  // Strict allowlist sanitization (BR-05): token/password/cookie fields are never read or persisted.
  for (let i = 0; i < body.accounts.length; i += 1) {
    const rawItem = body.accounts[i];
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      skipped.push({ index: i, reason: 'Format item tidak valid' });
      continue;
    }
    const rec = rawItem as Record<string, unknown>;
    const rawEmail = typeof rec.email === 'string' ? rec.email.trim().toLowerCase() : '';
    if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
      skipped.push({ index: i, reason: 'Format email tidak valid' });
      continue;
    }

    const rawTags = normalizeTags(rec.tags);
    const eligibilityStatus = deriveEligibility(rawTags);

    let planTier: 'AUTO_FAMILY' | 'PRO' | 'FREE' | undefined;
    if (typeof rec.plan_tier === 'string') {
      const upper = rec.plan_tier.trim().toUpperCase();
      if (VALID_PLAN_TIERS.has(upper)) {
        planTier = upper as 'AUTO_FAMILY' | 'PRO' | 'FREE';
      }
    }

    const isCurrent = rec.is_current === true && !hasCurrent;
    if (isCurrent) hasCurrent = true;

    const credits =
      typeof rec.available_ai_credits === 'number' && Number.isFinite(rec.available_ai_credits)
        ? rec.available_ai_credits
        : null;

    const notes =
      typeof rec.notes === 'string' && rec.notes.trim()
        ? rec.notes.trim().slice(0, 500)
        : null;

    const nativeQuota =
      rec.quota && typeof rec.quota === 'object' && !Array.isArray(rec.quota)
        ? (rec.quota as Record<string, unknown>)
        : null;
    const quotas = Array.isArray(rec.quotas)
      ? sanitizeQuotas(rec.quotas)
      : nativeQuota && Array.isArray(nativeQuota.models)
        ? sanitizeQuotas(nativeQuota.models)
        : [];
    const argonStatus = parseArgonStatus(rec.argon_status) ?? deriveArgonStatus(quotas, rawTags);

    deduped.set(rawEmail, {
      email: rawEmail,
      plan_tier: planTier,
      eligibility_status: eligibilityStatus,
      argon_status: argonStatus,
      raw_tags: rawTags,
      is_current: isCurrent,
      switch_time: sanitizeIso(rec.switch_time),
      quotas,
      available_ai_credits: credits,
      notes,
    });
  }

  if (deduped.size === 0) {
    throw new ApiError('EMPTY_IMPORT', 'Tidak ada data akun yang valid di dalam berkas ini.', 422);
  }

  const db = serviceClient();
  const emails = Array.from(deduped.keys());
  const { data: existingRows, error: existingError } = await db
    .from('cockpit_accounts')
    .select('email, plan_tier, argon_status, notes')
    .eq('user_id', user.id)
    .in('email', emails);
  checkDb(existingError);

  const existingByEmail = new Map<
    string,
    { plan_tier: string; argon_status?: string; notes: string | null }
  >();
  for (const row of existingRows || []) {
    existingByEmail.set(row.email, {
      plan_tier: row.plan_tier,
      argon_status: row.argon_status,
      notes: row.notes,
    });
  }

  const syncedAt = new Date().toISOString();
  let created = 0;
  let updated = 0;

  const upsertRows = emails.map((email) => {
    const item = deduped.get(email)!;
    const prev = existingByEmail.get(email);
    if (prev) updated += 1;
    else created += 1;

    // Preserve existing manual PRO/FREE override if incoming export omits plan_tier.
    const resolvedPlanTier =
      item.plan_tier && item.plan_tier !== 'AUTO_FAMILY'
        ? item.plan_tier
        : (prev?.plan_tier || 'AUTO_FAMILY');

    // Preserve existing manual argon_status if incoming snapshot has no quota/tag signal.
    const resolvedArgonStatus: ArgonStatus =
      item.argon_status !== 'unknown'
        ? item.argon_status
        : (parseArgonStatus(prev?.argon_status) ?? 'unknown');

    return {
      user_id: user.id,
      email: item.email,
      plan_tier: resolvedPlanTier,
      eligibility_status: item.eligibility_status,
      argon_status: resolvedArgonStatus,
      raw_tags: item.raw_tags,
      is_current: item.is_current,
      switch_time: item.switch_time,
      quotas: item.quotas,
      available_ai_credits: item.available_ai_credits,
      notes: item.notes ?? prev?.notes ?? null,
      last_synced_at: syncedAt,
    };
  });

  const { error: upsertError } = await db
    .from('cockpit_accounts')
    .upsert(upsertRows, { onConflict: 'user_id,email' });
  checkDb(upsertError);

  return {
    imported: upsertRows.length,
    created,
    updated,
    skipped,
    synced_at: syncedAt,
  };
}));
