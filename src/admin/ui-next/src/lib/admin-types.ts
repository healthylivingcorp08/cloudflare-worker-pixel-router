// src/admin/ui-next/src/lib/admin-types.ts

// Minimal KVNamespace definition to satisfy type checking within ui-next build
export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<string | Record<string, unknown> | ArrayBuffer | ReadableStream | null>;
  getWithMetadata<Metadata = unknown>(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<{ value: string | Record<string, unknown> | ArrayBuffer | ReadableStream | null; metadata: Metadata | null }>;
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list<Metadata = unknown>(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number; metadata?: Metadata }[]; list_complete: boolean; cursor?: string }>;
}

// --- Types copied from ../../types.ts ---

// Simple Key-Value Pair structure used in Admin UI
export interface KVPair {
    key: string;
    value: unknown; // Use unknown for flexibility, components can refine if needed
}

// --- Admin API Types ---
export interface KvListResponse {
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
}

export interface KvWriteRequest {
    key: string;
    value: string; // Assuming value is stringified JSON for the API
    expirationTtl?: number; // Optional TTL in seconds
    metadata?: any; // Optional metadata
}

export interface KvReadResponse {
    value: string | null; // Assuming value is stringified JSON from the API
    metadata?: any;
}

export interface KvDeleteRequest {
    keys: string[];
}

// Add any other types from ../../types.ts that ui-next might directly use
// For example, if it needs Env for context/auth, copy that interface too.
// export interface Env { ... }