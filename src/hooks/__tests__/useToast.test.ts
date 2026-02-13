import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('addToast adds a toast with correct properties', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Hello!', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Hello!',
      type: 'success',
    });
    expect(result.current.toasts[0].id).toBeDefined();
  });

  it('addToast defaults to info type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Info message');
    });

    expect(result.current.toasts[0].type).toBe('info');
  });

  it('addToast returns the toast id', () => {
    const { result } = renderHook(() => useToast());

    let id: number;
    act(() => {
      id = result.current.addToast('Test');
    });

    expect(id!).toBe(result.current.toasts[0].id);
  });

  it('removeToast removes the correct toast', () => {
    const { result } = renderHook(() => useToast());

    let id1: number, id2: number;
    act(() => {
      id1 = result.current.addToast('First', 'info');
      id2 = result.current.addToast('Second', 'error');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.removeToast(id1!);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBe(id2!);
  });

  it('auto-dismisses toast after specified duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Auto-dismiss', 'warning', 2000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('uses default 4000ms duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast('Default duration');
    });

    // Still present at 3999ms
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Gone at 4000ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports all toast types', () => {
    const { result } = renderHook(() => useToast());
    const types = ['success', 'error', 'warning', 'info'] as const;

    act(() => {
      types.forEach((type) => result.current.addToast(`${type} msg`, type));
    });

    expect(result.current.toasts).toHaveLength(4);
    types.forEach((type, i) => {
      expect(result.current.toasts[i].type).toBe(type);
    });
  });
});
