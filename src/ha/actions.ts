import { api, ApiError } from "../api/client";

export interface HACallServiceInput {
  domain: string;
  service: string;
  entity_id?: string;
  service_data?: Record<string, unknown>;
}

export interface HATriggerAlarmInput {
  action: string;
  pin: string;
  entity_id?: string;
}

export interface HACallServiceResult {
  success: boolean;
  result?: unknown;
}

export interface HAAlarmResult {
  success: boolean;
}

export type HAErrorKind = "forbidden" | "unauthorized" | "offline" | "server" | "unknown";

/**
 * Classify a caught error for honest toast messaging. Status carries the truth
 * (body is secondary per the LAN contract).
 */
export function classifyHAError(err: unknown): HAErrorKind {
  if (err instanceof ApiError) {
    if (err.status === 403) return "forbidden";
    if (err.status === 401) return "unauthorized";
    if (err.status === 0 || err.code === "unreachable") return "offline";
    if (err.status >= 500) return "server";
  }
  if (err && typeof err === "object" && "status" in (err as any) && (err as any).status === 0) return "offline";
  return "unknown";
}

export function haErrorToastMessage(err: unknown): string {
  const kind = classifyHAError(err);
  switch (kind) {
    case "forbidden":
      return "Sign in as a parent to control the house.";
    case "unauthorized":
      return "Sign in as a parent to control the house.";
    case "offline":
      return "Couldn't reach Consuela — check the connection.";
    case "server":
      return "Home Assistant is offline — changes won't apply.";
    default:
      return err instanceof Error ? err.message : String(err);
  }
}

/** POST /api/ha/call-service (parent-only). Throws ApiError on failure. */
export async function callHAService(input: HACallServiceInput): Promise<HACallServiceResult> {
  const { domain, service, entity_id, service_data } = input;
  const serviceData = service_data ? { entity_id, ...service_data } : { entity_id };
  return api<HACallServiceResult>("/api/ha/call-service", {
    method: "POST",
    body: {
      domain,
      service,
      entity_id,
      service_data: service_data ?? {},
      serviceData,
    },
  });
}

/** POST /api/ha/alarm (PIN-verified). Throws ApiError on failure. */
export async function triggerHAAlarm(input: HATriggerAlarmInput): Promise<HAAlarmResult> {
  const { action, pin, entity_id } = input;
  return api<HAAlarmResult>("/api/ha/alarm", {
    method: "POST",
    body: { action, pin, entity_id },
  });
}

export { ApiError };
