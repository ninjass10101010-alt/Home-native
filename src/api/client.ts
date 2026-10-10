import { getBaseUrl } from "./config";
import { getSessionCookie } from "./session";

/**
 * The LAN honest-error contract (from Home-ai warm-glass-v2 middleware/routes):
 * body fields carry truth (ok/degraded/reconciled), HTTP status is secondary.
 * ApiError normalizes transport + status failures only; callers inspect body.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  queued: boolean;
  /** Parsed response body when the server answered with one (502 partials can
   *  still carry live data — e.g. google-calendar events on a partial sync). */
  body?: unknown;
  constructor(args: {
    message: string;
    status: number;
    code: string;
    retryable?: boolean;
    queued?: boolean;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.retryable = args.retryable ?? false;
    this.queued = args.queued ?? false;
    this.body = args.body;
  }
}

export interface ApiInit {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Called with the raw Response before body parsing (cookie capture etc.). */
  onResponse?: (res: Response) => void;
}

/** Injectable for tests. */
export let fetchImpl: typeof fetch = (...args) => fetch(...args);
export function _setFetchImpl(f: typeof fetch) {
  fetchImpl = f;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Minimal typed fetch wrapper for the Home-ai API:
 * - Cookie: consuela_session=<v> injected when a session is loaded
 * - JSON body + Content-Type when body present
 * - AbortController timeout (default 20s)
 * - res.ok === false → throw ApiError{status, code: body?.error ?? "http_error",
 *   retryable: status>=500 || body?.retryable === true, queued: body?.queued === true}
 * - res.ok true → parsed body returned UNTOUCHED (ok/degraded/reconciled are
 *   the caller's to read — status and payload truth diverge by contract)
 * - fetch rejection (LAN down) → ApiError{status:0, code:"unreachable", retryable:true}
 */
export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...init.headers };
  const cookie = getSessionCookie();
  if (cookie) headers["Cookie"] = `consuela_session=${cookie}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetchImpl(`${getBaseUrl()}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError({
        message: "Couldn't reach Consuela — check the connection",
        status: 0,
        code: "unreachable",
        retryable: true,
      });
    }

    init.onResponse?.(res);

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON payload (e.g. /api/photos/file binary) — leave null
    }

    if (!res.ok) {
      throw new ApiError({
        message: body?.error ?? `http_${res.status}`,
        status: res.status,
        code: typeof body?.error === "string" ? body.error : `http_${res.status}`,
        retryable: res.status >= 500 || body?.retryable === true,
        queued: body?.queued === true,
        body,
      });
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}
