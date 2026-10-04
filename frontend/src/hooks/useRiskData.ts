import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRisk, fetchScenario, postScenario } from "../api/client";
import type { RiskCollection, ScenarioState, ScenarioUpdate } from "../api/types";

/**
 * Loads risk + scenario, polls periodically, and applies demo-scenario changes.
 * Latest-request-wins: a slow, older response can never overwrite newer data.
 */
export function useRiskData(pollMs = 30_000) {
  const [risk, setRisk] = useState<RiskCollection | null>(null);
  const [scenario, setScenario] = useState<ScenarioState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const [r, s] = await Promise.all([fetchRisk(), fetchScenario()]);
      if (id !== latest.current) return; // superseded
      setRisk(r);
      setScenario(s);
      setError(null);
    } catch (e) {
      if (id !== latest.current) return;
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  const applyScenario = useCallback(
    async (body: ScenarioUpdate) => {
      setBusy(true);
      try {
        await postScenario(body);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { risk, scenario, error, loading, busy, applyScenario, reload: load };
}
