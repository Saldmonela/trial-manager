/**
 * Family-related utility functions.
 * Extracted from useLocalStorage.js to keep hooks focused.
 */

export const MAX_FAMILY_SLOTS = 5;
export const MAX_STORAGE_GB = 2048;

export function generateId() {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);
}

export function getSlotsUsed(family) {
  return family.members?.length || 0;
}

export function getSlotsAvailable(family) {
  return Math.max(0, MAX_FAMILY_SLOTS - getSlotsUsed(family));
}

export function isFamilyFull(family) {
  return getSlotsUsed(family) >= MAX_FAMILY_SLOTS;
}

export function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return { text: 'No expiry set', color: 'gray' };
  if (daysRemaining < 0) return { text: 'EXPIRED', color: 'gray' };
  if (daysRemaining <= 3) return { text: `${daysRemaining} DAYS LEFT`, color: 'red' };
  if (daysRemaining <= 7) return { text: `${daysRemaining} DAYS LEFT`, color: 'yellow' }; 
  return { text: `${daysRemaining} DAYS LEFT`, color: 'green' };
}
