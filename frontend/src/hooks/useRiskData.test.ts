import { act, renderHook, waitFor } from "@testing-library/react";
import { riskFixture, scenarioFixture } from "../test/fixtures";
import { useRiskData } from "./useRiskData";

vi.mock("../api/client", () => ({ fetchRisk: vi.fn(), fetchScenario: vi.fn(), postScenario: vi.fn() }));
import * as api from "../api/client";

const mocked = vi.mocked(api);
const withScenario = (name: string) => ({ ...riskFixture, metadata: { ...riskFixture.metadata, scenario: name } });
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => vi.resetAllMocks());

describe("useRiskData", () => {
  it("loads risk and scenario", async () => {
    mocked.fetchRisk.mockResolvedValue(riskFixture);
    mocked.fetchScenario.mockResolvedValue(scenarioFixture);
    const { result } = renderHook(() => useRiskData(1e9));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.risk?.features).toHaveLength(38);
    expect(result.current.error).toBeNull();
  });

  it("keeps the last data and reports an error when the backend goes away", async () => {
    mocked.fetchRisk.mockResolvedValueOnce(riskFixture).mockRejectedValue(new Error("Cannot reach the AquaRoute API."));
    mocked.fetchScenario.mockResolvedValue(scenarioFixture);
    const { result } = renderHook(() => useRiskData(1e9));
    await waitFor(() => expect(result.current.risk).not.toBeNull());
    await act(() => result.current.reload());
    expect(result.current.error).toMatch(/Cannot reach/);
    expect(result.current.risk).not.toBeNull(); // last good data still shown
  });

  it("a slow OLD response can never overwrite a newer one (latest request wins)", async () => {
    const slow = deferred<typeof riskFixture>();
    mocked.fetchScenario.mockResolvedValue(scenarioFixture);
    mocked.fetchRisk.mockReturnValueOnce(slow.promise).mockResolvedValue(withScenario("NEW"));
    const { result } = renderHook(() => useRiskData(1e9));       // request #1 (slow, pending)
    await act(() => result.current.reload());                      // request #2 (fast)
    await waitFor(() => expect(result.current.risk?.metadata.scenario).toBe("NEW"));
    await act(async () => { slow.resolve(withScenario("OLD")); await Promise.resolve(); });
    expect(result.current.risk?.metadata.scenario).toBe("NEW");
  });

  it("applyScenario posts, then reloads", async () => {
    mocked.fetchRisk.mockResolvedValue(riskFixture);
    mocked.fetchScenario.mockResolvedValue(scenarioFixture);
    mocked.postScenario.mockResolvedValue(scenarioFixture);
    const { result } = renderHook(() => useRiskData(1e9));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = mocked.fetchRisk.mock.calls.length;
    await act(() => result.current.applyScenario({ scenario: "heavy_rain" }));
    expect(mocked.postScenario).toHaveBeenCalledWith({ scenario: "heavy_rain" });
    expect(mocked.fetchRisk.mock.calls.length).toBe(before + 1);
    expect(result.current.busy).toBe(false);
  });
});
