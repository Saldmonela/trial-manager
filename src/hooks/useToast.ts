import { useState, useCallback, useEffect, useRef } from 'react';
import type { Toast, ToastType, UseToastReturn } from '../types';

let toastIdCounter = 0;

/**
 * Custom hook for managing toast notifications.
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => { const active = timers.current; return () => { for (const timer of active.values()) clearTimeout(timer); active.clear(); }; }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000): number => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    timers.current.set(id, timer);
    return id;
  }, []);

  const removeToast = useCallback((id: number): void => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
