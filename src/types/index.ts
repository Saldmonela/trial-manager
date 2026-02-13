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

/** A family plan with owner credentials and member list. */
export interface Family {
  id: string;
  name: string;
  notes?: string;
  members: Member[];

  // Camel-case (used in UI / hook return)
  ownerEmail: string;
  ownerPassword: string;
  expiryDate: string;
  storageUsed: number;
  createdAt: string;

  // Snake-case (raw from Supabase)
  user_id?: string;
  owner_email?: string;
  owner_password?: string;
  expiry_date?: string;
  storage_used?: number;
  created_at?: string;
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
  refetch: () => Promise<void>;
}

export interface UseToastReturn {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => number;
  removeToast: (id: number) => void;
}
