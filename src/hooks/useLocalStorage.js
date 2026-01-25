import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Max slots: 1 owner + 5 members = 6 total
export const MAX_FAMILY_SLOTS = 6;
export const MAX_STORAGE_GB = 2048; // 2TB

export function getSlotsUsed(family) {
  // Owner counts as 1 + number of members
  return 1 + (family.members?.length || 0);
}

export function getSlotsAvailable(family) {
  return MAX_FAMILY_SLOTS - getSlotsUsed(family);
}

export function isFamilyFull(family) {
  return getSlotsUsed(family) >= MAX_FAMILY_SLOTS;
}

// Calculate days remaining until expiry
export function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Get expiry status color
export function getExpiryStatus(daysRemaining) {
  if (daysRemaining === null) return { color: 'slate', text: 'No expiry set' };
  if (daysRemaining <= 0) return { color: 'red', text: 'Expired!' };
  if (daysRemaining <= 3) return { color: 'red', text: `${daysRemaining} days left` };
  if (daysRemaining <= 7) return { color: 'orange', text: `${daysRemaining} days left` };
  if (daysRemaining <= 14) return { color: 'yellow', text: `${daysRemaining} days left` };
  return { color: 'emerald', text: `${daysRemaining} days left` };
}
