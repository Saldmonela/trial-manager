// ─── Domain Types ────────────────────────────────────────────────
// Shared type definitions for the trial-manager application.
// Import from '@/types' or '../types' in any .ts/.tsx file.

/** A member within a family plan. */
export interface Member {
  id: string;
  name: string;
  email: string;
  family_id: string;
  added_at: string;
  /** Camel-case alias populated by useSupabaseData */
  addedAt?: string;
  storage_used?: number;
  storageUsed?: number;
  member_type?: 'pribadi' | 'pembeli';
  memberType?: 'pribadi' | 'pembeli';
  expiry_date?: string | null;
  expiryDate?: string | null;
}

export type ProductType = 'slot' | 'account_ready' | 'account_custom';

/** A family plan with owner credentials and member list. */
export interface Family {
  id: string;
  name: string;
  ownerEmail?: string;
  /** Passwords are fetched on demand and never populated by list queries. */
  ownerPassword?: string;
  expiryDate?: string | null;
  storageUsed?: number;
  createdAt?: string;
  credentialStatus?: 'available' | 'missing' | 'unreadable';
  credentialVersion?: 'v1' | 'legacy';
  soldAt?: string | null;
  sold_at?: string | null;
  user_id?: string;
  notes?: string;
  storage_used?: number;
  created_at?: string;
  price_monthly?: number;
  price_annual?: number;
  price_sale?: number;
  priceMonthly?: number; // Alias for camelCase usage
  priceAnnual?: number;  // Alias for camelCase usage
  priceSale?: number;    // Alias for camelCase usage
  currency?: string;
  productType?: ProductType;
  is_banned?: boolean;
  isBanned?: boolean;
  isPublic?: boolean;
  isActive?: boolean;
  members?: Member[]; // Optional members array from join
}

/** Input shape when creating / updating a family (before Supabase insert). */
export interface FamilyInput {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPassword?: string;
  expiryDate: string;
  storageUsed: number;
  notes?: string;
  createdAt?: string;
  members?: Member[];
  priceMonthly?: number;
  priceAnnual?: number;
  priceSale?: number;
  currency?: string;
  productType?: ProductType;
  is_banned?: boolean;
  isBanned?: boolean;
  isPublic?: boolean;
  isActive?: boolean;
}

/** Result of an async CRUD action. */
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
}

// ─── Toast Types ─────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Expiry Helpers ──────────────────────────────────────────────

export interface ExpiryStatus {
  text: string;
  color: string;
}

// ─── Hook Return Types ───────────────────────────────────────────

export interface UseSupabaseDataReturn {
  families: Family[];
  loading: boolean;
  refreshing?: boolean;
  error?: string | null;
  addFamily: (family: FamilyInput) => Promise<ActionResult>;
  updateFamily: (family: FamilyInput) => Promise<ActionResult>;
  deleteFamily: (familyId: string) => Promise<ActionResult>;
  addMember: (familyId: string, member: Omit<Member, 'family_id'>) => Promise<ActionResult>;
  updateMember: (familyId: string, memberId: string, updatedFields: Partial<Member>) => Promise<ActionResult>;
  removeMember: (familyId: string, memberId: string) => Promise<ActionResult>;
  cancelSale: (familyId: string) => Promise<ActionResult>;
  refetch: () => Promise<void>;
}

export interface UseToastReturn {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => number;
  removeToast: (id: number) => void;
}

// ─── Auth / RBAC Types ──────────────────────────────────────────

export type UserRole = 'public' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthContextValue {
  session: any | null;
  user: any | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Login email/password — hanya dipakai form testing yang dirender di dev build. */
  signInWithPassword: (email: string, password: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
}

// ─── Cloud Storage (Connected Accounts) ──────────────────────────
// Modul multi-cloud storage v1: hubungkan akun Google Drive & sync kuota asli.

export type StorageProvider = 'google_drive' | 's3';
export type ConnectedAccountStatus = 'connected' | 'disconnected';

/**
 * Satu akun cloud terhubung milik user. Bentuk camelCase yang aman untuk client —
 * TIDAK pernah memuat field token (kolom token di-REVOKE dari client di DB).
 */
export interface ConnectedAccount {
  id: string;
  provider: StorageProvider;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: ConnectedAccountStatus;
  /** null = unlimited (Google tidak mengirim `limit`) */
  totalBytes: number | null;
  usedBytes: number;
  availableBytes: number | null;
  trashBytes: number;
  lastSyncedAt: string | null;
  createdAt?: string;
}

/** Ringkasan kuota gabungan dari semua akun terhubung. */
export interface StorageAggregate {
  /** Jumlah total dari akun yang berhingga saja (akun unlimited dikecualikan). */
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  accountCount: number;
  hasUnlimited: boolean;
}

export type LowStorageTier = '5GB' | '15GB';

export interface ExpiredFamilySummary {
  id: string;
  name: string;
}

export interface SyncAccountResult {
  id: string;
  ok: boolean;
  email?: string | null;
  lowStorageTier?: LowStorageTier | null;
  expiredFamilies?: ExpiredFamilySummary[];
  code?: string;
  error?: string;
}

export interface SyncQuotaData {
  results: SyncAccountResult[];
}

export interface JustConnectedDrive {
  accountId: string;
  intent: string | null;
  createdFamily?: { id: string; name: string } | null;
  lowStorageTier?: LowStorageTier | null;
  expiredFamilies?: ExpiredFamilySummary[];
}

export interface UseConnectedAccountsReturn {
  accounts: ConnectedAccount[];
  aggregate: StorageAggregate;
  loading: boolean;
  error: string | null;
  justConnected?: JustConnectedDrive | null;
  clearJustConnected?: () => void;
  connectGoogleDrive: (path?: '/admin' | '/storage' | '/connect', loginHint?: string, intent?: string, passcode?: string) => Promise<ActionResult>;
  syncQuota: (id: string) => Promise<ActionResult<SyncQuotaData>>;
  syncAll: () => Promise<ActionResult<SyncQuotaData>>;
  disconnect: (id: string) => Promise<ActionResult>;
  refetch: () => Promise<void>;
}

// ─── Cockpit Accounts & Family Placement Types ──────────────────

export type CockpitPlanTier = 'AUTO_FAMILY' | 'PRO' | 'FREE';
export type CockpitResolvedTier = 'PRO' | 'FREE';
export type CockpitEligibilityStatus = 'bisa' | 'ban' | 'need_verif' | 'untagged';
export type CockpitArgonStatus = 'available' | 'missing' | 'unknown';

export interface CockpitQuotaItem {
  model: string;
  remaining_pct: number | null;
  reset_at: string | null;
}

export interface CockpitAccount {
  id: string;
  userId?: string;
  email: string;
  planTier: CockpitPlanTier;
  eligibilityStatus: CockpitEligibilityStatus;
  argonStatus: CockpitArgonStatus;
  rawTags: string[];
  isCurrent: boolean;
  switchTime: string | null;
  quotas: CockpitQuotaItem[];
  availableAiCredits: number | null;
  notes: string | null;
  lastSyncedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CockpitImportAccountInput {
  email: string;
  tags: string[];
  eligibility_status: CockpitEligibilityStatus;
  argon_status?: CockpitArgonStatus;
  plan_tier?: CockpitPlanTier;
  is_current?: boolean;
  switch_time?: string | null;
  quotas?: CockpitQuotaItem[];
  available_ai_credits?: number | null;
  notes?: string | null;
}

export interface CockpitImportResult {
  imported: number;
  created: number;
  updated: number;
  skipped: Array<{ index: number; reason: string }>;
  synced_at: string;
}

export interface CockpitFamilyMatch {
  familyId: string;
  familyName: string;
  ownerEmail: string;
  role: 'owner' | 'member';
  isActiveFamily: boolean;
  isBanned: boolean;
  expiryDate: string | null;
  daysRemaining: number | null;
}

export interface CockpitConflictGroup {
  familyId: string;
  familyName: string;
  ownerEmail: string;
  emails: string[];
  count: number;
}

export interface CockpitAccountView {
  account: CockpitAccount;
  isActiveEligibility: boolean;
  isArgonPriority: boolean;
  argonQuotaPct: number | null;
  matches: CockpitFamilyMatch[];
  primaryMatch: CockpitFamilyMatch | null;
  resolvedTier: CockpitResolvedTier;
  tierSource: 'family' | 'manual' | 'unassigned';
  hasConflict: boolean;
  conflictFamilyNames: string[];
  isStale: boolean;
  isFreeCandidate: boolean;
  isNearExpiryWithQuota: boolean;
  highestQuotaPct: number | null;
}

export interface RecommendedFamily {
  family: Family;
  slotsUsed: number;
  slotsAvailable: number;
  hasLiveDrive: boolean;
  isUnlimitedDrive: boolean;
  availableBytes: number;
  totalBytes: number | null;
  isStorageLega: boolean;
  storageLabel: string;
  daysRemaining: number | null;
}

export interface CockpitAssignResult {
  member_id: string;
  family_id: string;
  email: string;
  added_at: string;
}

