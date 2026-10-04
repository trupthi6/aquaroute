import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { detailFixture, riskFixture, scenarioFixture } from "./test/fixtures";

// Leaflet needs a real layout engine, so the map is replaced by a stub that exposes its props.
vi.mock("./components/map/RiskMap", () => ({
  default: ({ data, view, onSelect }: any) => (
    <div data-testid="map" data-view={view}>
      {data.features.slice(0, 3).map((f: any) => (
        <button key={f.id} onClick={() => onSelect(f.id)}>map-{f.id}</button>
      ))}
    </div>
  ),
}));
vi.mock("./api/client", async (orig) => ({
  ...(await orig<typeof import("./api/client")>()),
  fetchRisk: vi.fn(), fetchScenario: vi.fn(), fetchDetail: vi.fn(), postScenario: vi.fn(),
}));
import * as api from "./api/client";
const mocked = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.fetchRisk.mockResolvedValue(riskFixture);
  mocked.fetchScenario.mockResolvedValue(scenarioFixture);
  mocked.fetchDetail.mockResolvedValue(detailFixture);
  mocked.postScenario.mockResolvedValue(scenarioFixture);
});

describe("App", () => {
  it("shows freshness banner, summary, demo controls and the map once loaded", async () => {
    render(<App />);
    expect(screen.getByText(/Loading flood risk/)).toBeInTheDocument();
    expect(await screen.findByTestId("map")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("FRESH");
    expect(screen.getByLabelText("Demo controls")).toBeInTheDocument();
    expect(screen.getByTestId("count-HIGH")).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE DATA/)).toBeInTheDocument();
  });

  it("defaults to the Peak view (early warning) and toggles to Now", async () => {
    render(<App />);
    const map = await screen.findByTestId("map");
    expect(map).toHaveAttribute("data-view", "peak");
    fireEvent.click(screen.getByRole("button", { name: "Now" }));
    expect(screen.getByTestId("map")).toHaveAttribute("data-view", "now");
  });

  it("clicking a road opens its detail panel; closing removes it", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText(`map-${riskFixture.features[0].id}`));
    expect(await screen.findByLabelText("Selected road details")).toBeInTheDocument();
    expect(mocked.fetchDetail).toHaveBeenCalledWith(riskFixture.features[0].id);
    fireEvent.click(screen.getByLabelText("Close details"));
    await waitFor(() => expect(screen.queryByLabelText("Selected road details")).not.toBeInTheDocument());
  });

  it("selecting from the accessible list works too", async () => {
    render(<App />);
    await screen.findByTestId("map");
    const list = screen.getByLabelText("Highest-risk roads");
    fireEvent.click(list.querySelector("button")!);
    expect(await screen.findByLabelText("Selected road details")).toBeInTheDocument();
  });

  it("shows a clear error banner when the backend is unreachable", async () => {
    mocked.fetchRisk.mockRejectedValue(new api.ApiError("Cannot reach the AquaRoute API. Is the backend running?", 0));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Cannot reach the AquaRoute API/);
    expect(screen.getByText(/No data available/)).toBeInTheDocument();
  });

  it("shows the STALE alert when the backend reports stale data", async () => {
    const stale = structuredClone(riskFixture);
    stale.features.forEach((f) => (f.properties.data_freshness = { as_of: "2026-10-03T16:00:00+05:30", age_seconds: 5400, state: "stale" }));
    mocked.fetchRisk.mockResolvedValue(stale);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("STALE");
  });
});
