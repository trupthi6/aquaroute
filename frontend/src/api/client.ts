import type { DemoTripResponse, RiskCollection, RiskDetailProperties, RiskFeature, RouteRequest, RouteResponse, ScenarioState, ScenarioUpdate } from "./types";

// Empty in dev (Vite proxies /api to FastAPI). Set VITE_API_BASE when hosted separately.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError("Cannot reach the AquaRoute API. Is the backend running?", 0);
  }
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(detail, res.status);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Cannot reach the AquaRoute API. Is the backend running?", 0);
  }
}

export const fetchRisk = () => request<RiskCollection>("/api/v1/risk");
export const fetchDetail = (id: string) =>
  request<RiskFeature<RiskDetailProperties>>(`/api/v1/risk/${encodeURIComponent(id)}`);
export const fetchScenario = () => request<ScenarioState>("/api/v1/scenario");
export const postScenario = (body: ScenarioUpdate) =>
  request<ScenarioState>("/api/v1/scenario", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export const postRoute = (body: RouteRequest) =>
  request<RouteResponse>("/api/v1/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export const fetchDemoTrip = (view: "peak" | "now" = "peak") =>
  request<DemoTripResponse>(`/api/v1/route/demo-trip?view=${view}`);

// Module 4: Smart SOS
export const evaluateAccident = (body: import("./types").AccidentEvaluationRequest) =>
  request<import("./types").AccidentEvaluationResponse>("/api/v1/sos/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const triggerSOS = (body: import("./types").SOSTriggerRequest) =>
  request<import("./types").SOSTriggerResponse>("/api/v1/sos/trigger", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const fetchHospitals = (lat = 12.928, lon = 77.655, limit = 4) =>
  request<import("./types").HospitalInfo[]>(`/api/v1/sos/hospitals?lat=${lat}&lon=${lon}&limit=${limit}`);

// Module 5: Offline Resilience
export const fetchOfflineStatus = () =>
  request<{ status: string; catchment: string; package_version: string }>("/api/v1/offline/status");

export const fetchOfflinePackage = () =>
  request<import("./types").OfflinePackage>("/api/v1/offline/package");
