/**
 * Shared API envelope/types for the Home-ai LAN contract (verified against
 * Home-ai warm-glass-v2, 2026-10-09). ServerMember mirrors sanitizeMember in
 * Home-ai's src/lib/server-auth.ts:307-313 — the PocketBase row minus `pin`,
 * plus pbId. NOTE: identity keys on the exact full display `name` string.
 */
export interface ServerMember {
  id: string | number;
  pbId?: string;
  name: string;
  role: string; // "parent" | "child" | "pet" (loose string server-side)
  emoji: string;
  color: string;
  avatarSize?: "xs" | "sm" | "md" | "base" | "lg";
  glow?: boolean;
  /** PocketBase record creation timestamp (live rows) — the Family editor
   *  derives the roster's "Mon YYYY" joined subtitle from it. */
  created?: string;
  age?: number; // may be absent → treat as PIN-required; server decides
  phone?: string;
  email?: string;
}

/** /api/db/{collection} list envelope (GET) — `{ items: Row[] }`. */
export interface DbListEnvelope<T = Record<string, unknown>> {
  items: T[];
}

/** Gateway error shape (502 db_error; 400s invalid_filter/invalid_sort; 403 adult_only/command_only). */
export interface DbErrorBody {
  error?: string;
  detail?: string;
  data?: unknown;
}

/** Command-route 202 "durable queued" marker. */
export interface QueuedBody {
  queued: true;
  operationId?: string;
  reason?: string;
  retryable?: boolean;
}
