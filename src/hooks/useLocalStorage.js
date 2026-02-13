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

// Re-export for backward compatibility if needed, or just let components import from lib
// For now, we keep the hook focused on storage, but if components import these from here, we need to export them.
// Looking at imports in FamilyCard: import { ... } from '../../hooks/useLocalStorage';
// So we must re-export them.

export {
  generateId,
  MAX_FAMILY_SLOTS,
  MAX_STORAGE_GB,
  getSlotsUsed, getSlotsAvailable,
  isFamilyFull, getDaysRemaining, getExpiryStatus
} from '../lib/familyUtils';
