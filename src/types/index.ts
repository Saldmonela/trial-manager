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
}

export type ProductType = 'slot' | 'account_ready' | 'account_custom';

/** A family plan with owner credentials and member list. */
export interface Family {
  id: string;
  name: string;
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
  members?: Member[]; // Optional members array from join
}

/** Input shape when creating / updating a family (before Supabase insert). */
export interface FamilyInput {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPassword: string;
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
}

/** Result of an async CRUD action. */
export interface ActionResult {
  success: boolean;
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
  addFamily: (family: FamilyInput) => Promise<ActionResult>;
  updateFamily: (family: FamilyInput) => Promise<ActionResult>;
  deleteFamily: (familyId: string) => Promise<ActionResult>;
  addMember: (familyId: string, member: Omit<Member, 'family_id'>) => Promise<ActionResult>;
  removeMember: (familyId: string, memberId: string) => Promise<ActionResult>;
  cancelSale: (familyId: string) => Promise<ActionResult>;
  refetch: () => Promise<void>;
}

export interface PublicFamily {
  id: string;
  familyName: string;
  serviceName?: string;
  expiryDate: string | null;
  storageUsed: number;
  slotsAvailable: number;
  priceMonthly?: number;
  priceAnnual?: number;
  priceSale?: number;
  currency?: string;
  createdAt?: string;
  productType?: ProductType;
  soldAt?: string | null;
  hasPendingOrder?: boolean;
  is_banned?: boolean;
  isBanned?: boolean;
}

export interface UsePublicFamiliesReturn {
  families: PublicFamily[];
  loading: boolean;
  error?: string | null;
  refetch: () => Promise<void>;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface JoinRequest {
  id: string;
  familyId: string;
  name: string;
  email: string;
  note: string;
  status: JoinRequestStatus;
  createdAt: string;
  familyName?: string;
  priceMonthly?: number;
  priceAnnual?: number;
  priceSale?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'annual';
  productType?: ProductType;
}

export interface JoinRequestInput {
  familyId?: string;
  name: string;
  email: string;
  note?: string;
  billingCycle: 'monthly' | 'annual';
  productType?: ProductType;
}

export interface UseJoinRequestsReturn {
  joinRequests: JoinRequest[];
  loading: boolean;
  refetch: () => Promise<void>;
  updateStatus: (requestId: string, status: JoinRequestStatus) => Promise<ActionResult>;
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
  signOut: () => Promise<void>;
}
