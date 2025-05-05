// Simple in-memory cache with TTL
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function setCache<T>(key: string, value: T, ttlSeconds: number): void {
  const expiry = Date.now() + ttlSeconds * 1000;
  cache.set(key, { value, expiry });
  // Optional: Clean up expired entries periodically or on size limit
  // For simplicity, we'll let expired entries be overwritten or checked on get
}

export function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.value as T;
  }
  // Entry doesn't exist or has expired
  if (entry) {
    cache.delete(key); // Clean up expired entry
  }
  return undefined;
}

// Function to clear the entire cache (e.g., for testing or specific events)
export function clearCache(): void {
  cache.clear();
}

// Function to delete a specific cache entry
export function deleteCacheEntry(key: string): void {
  cache.delete(key);
}