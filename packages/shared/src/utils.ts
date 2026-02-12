/**
 * Shared utility functions
 */

/**
 * Create a type-safe nullish coalescing
 */
export function coalesce<T>(...values: (T | null | undefined)[]): T | undefined {
  return values.find((v) => v != null) as T | undefined;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
