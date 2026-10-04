/**
 * RoutePanel.test.tsx – Unit tests for the Module 3 safe-routing panel.
 *
 * Covers:
 *   1. Panel renders with empty inputs and disabled Compute button.
 *   2. Enabling Compute once all four coordinate fields are filled.
 *   3. "Load demo trip" populates the coordinate fields.
 *   4. Submitting a valid route shows the SAFER_ROUTE result and comparison table.
 *   5. An API error is shown as an alert.
 *   6. "Clear" hides the result and resets fields.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoutePanel from "../components/RoutePanel";
import * as api from "../api/client";
import { demoTripFixture, routeFixture } from "../test/fixtures";

vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  postRoute: vi.fn(),
  fetchDemoTrip: vi.fn(),
}));
const mocked = vi.mocked(api);

const noop = () => {};

beforeEach(() => {
  vi.resetAllMocks();
});

function fillCoords(oLat: string, oLon: string, dLat: string, dLon: string) {
  fireEvent.change(screen.getByLabelText("Origin latitude"),      { target: { value: oLat } });
  fireEvent.change(screen.getByLabelText("Origin longitude"),     { target: { value: oLon } });
  fireEvent.change(screen.getByLabelText("Destination latitude"), { target: { value: dLat } });
  fireEvent.change(screen.getByLabelText("Destination longitude"),{ target: { value: dLon } });
}

describe("RoutePanel", () => {
  it("renders with empty coords and Compute button disabled", () => {
    render(<RoutePanel view="peak" onRouteResult={noop} />);
    expect(screen.getByLabelText("Safe route planner")).toBeInTheDocument();
    expect(screen.getByLabelText("Compute safe route")).toBeDisabled();
    expect(screen.queryByLabelText("Route result")).not.toBeInTheDocument();
  });

  it("enables Compute when all four coordinate fields are filled", () => {
    render(<RoutePanel view="peak" onRouteResult={noop} />);
    expect(screen.getByLabelText("Compute safe route")).toBeDisabled();
    fillCoords("12.915", "77.6725", "12.9215", "77.6465");
    expect(screen.getByLabelText("Compute safe route")).not.toBeDisabled();
  });

  it("Load demo trip fills the coordinate fields", async () => {
    mocked.fetchDemoTrip.mockResolvedValue(demoTripFixture);
    render(<RoutePanel view="peak" onRouteResult={noop} />);
    fireEvent.click(screen.getByLabelText("Load demo trip coordinates"));
    await waitFor(() =>
      expect(screen.getByLabelText("Origin latitude")).toHaveValue(demoTripFixture.origin.lat)
    );
    expect(screen.getByLabelText("Origin longitude")).toHaveValue(demoTripFixture.origin.lon);
    expect(screen.getByLabelText("Destination latitude")).toHaveValue(demoTripFixture.destination.lat);
    expect(screen.getByLabelText("Destination longitude")).toHaveValue(demoTripFixture.destination.lon);
    expect(mocked.fetchDemoTrip).toHaveBeenCalledWith("peak");
  });

  it("computing a SAFER_ROUTE shows recommendation, table and reasons", async () => {
    mocked.postRoute.mockResolvedValue(routeFixture);
    const onResult = vi.fn();
    render(<RoutePanel view="peak" onRouteResult={onResult} />);
    fillCoords("12.915", "77.6725", "12.9215", "77.6465");
    fireEvent.click(screen.getByLabelText("Compute safe route"));
    expect(await screen.findByLabelText("Route recommendation")).toHaveTextContent("Safer route available");
    expect(screen.getByLabelText("Route result")).toBeInTheDocument();
    expect(screen.getByLabelText("Route comparison")).toBeInTheDocument();
    expect(screen.getByLabelText("Route reasons")).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledWith(routeFixture);
  });

  it("shows an error alert when postRoute rejects", async () => {
    mocked.postRoute.mockRejectedValue(new api.ApiError("Outside pilot area", 422));
    render(<RoutePanel view="peak" onRouteResult={noop} />);
    fillCoords("90", "180", "12.9215", "77.6465");
    fireEvent.click(screen.getByLabelText("Compute safe route"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Outside pilot area");
    expect(screen.queryByLabelText("Route result")).not.toBeInTheDocument();
  });

  it("Clear removes the result and resets coords", async () => {
    mocked.postRoute.mockResolvedValue(routeFixture);
    render(<RoutePanel view="peak" onRouteResult={noop} />);
    fillCoords("12.915", "77.6725", "12.9215", "77.6465");
    fireEvent.click(screen.getByLabelText("Compute safe route"));
    await screen.findByLabelText("Route result");

    fireEvent.click(screen.getByLabelText("Clear route"));
    await waitFor(() => expect(screen.queryByLabelText("Route result")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Origin latitude")).toHaveValue(null);
  });
});
