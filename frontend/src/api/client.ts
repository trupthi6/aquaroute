import type { RiskCollection, RiskDetailProperties, RiskFeature, ScenarioState, ScenarioUpdate } from "./types";

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
  return (await res.json()) as T;
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
