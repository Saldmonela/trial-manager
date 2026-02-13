/**
 * Debounce a function call by a specified delay.
 * Useful for search inputs, window resize handlers, and high-frequency data updates.
 * 
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns - The debounced function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
