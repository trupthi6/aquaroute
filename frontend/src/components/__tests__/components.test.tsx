import { act, fireEvent, render, screen } from "@testing-library/react";
import DemoPanel from "../DemoPanel";
import ForecastCurve from "../ForecastCurve";
import FreshnessBanner from "../FreshnessBanner";
import Legend from "../Legend";
import RiskBadge from "../RiskBadge";
import SegmentPanel from "../SegmentPanel";
import SummaryBar from "../SummaryBar";
import TopRisks from "../TopRisks";
import ViewToggle from "../ViewToggle";
import { detailFixture, riskFixture, scenarioFixture } from "../../test/fixtures";

describe("RiskBadge / Legend (text, not just colour)", () => {
  it("badge shows the class as text", () => {
    render(<RiskBadge riskClass="CRITICAL" prefix="Now:" />);
    expect(screen.getByText("Now: CRITICAL")).toBeInTheDocument();
  });
  it("legend lists all four classes by name", () => {
    render(<Legend />);
    for (const c of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) expect(screen.getByText(c)).toBeInTheDocument();
  });
});

describe("FreshnessBanner", () => {
  const base = { as_of: "2026-10-03T17:29:00+05:30", age_seconds: 60 };
  it("fresh is a polite status", () => {
    render(<FreshnessBanner freshness={{ ...base, state: "fresh" }} scenarioName="heavy_rain" simulatedNow="2026-10-03T17:30:00+05:30" />);
    expect(screen.getByRole("status")).toHaveTextContent("FRESH");
    expect(screen.getByRole("status")).toHaveTextContent("17:29");
  });
  it("stale is an alert and says so in words", () => {
    render(<FreshnessBanner freshness={{ as_of: "2026-10-03T16:00:00+05:30", age_seconds: 5400, state: "stale" }} scenarioName="heavy_rain" simulatedNow="2026-10-03T17:30:00+05:30" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("STALE");
    expect(alert).toHaveTextContent(/out of date/);
  });
});

describe("SegmentPanel", () => {
  it("shows risk, confidence, window, reasons and the 13-point curve", () => {
    const onClose = vi.fn();
    render(<SegmentPanel detail={detailFixture.properties} onClose={onClose} />);
    const p = detailFixture.properties;
    expect(screen.getByRole("heading", { name: p.name })).toBeInTheDocument();
    expect(screen.getByText(`${Math.round(p.confidence * 100)}%`)).toBeInTheDocument();
    p.top_factors.forEach((f) => expect(screen.getByText(f)).toBeInTheDocument());
    expect(screen.getAllByTestId("curve-point")).toHaveLength(13);
    expect(screen.getByText(/decision support/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close details"));
    expect(onClose).toHaveBeenCalled();
  });
  it("flags a verified blockage", () => {
    render(<SegmentPanel detail={{ ...detailFixture.properties, verified_block: true }} onClose={() => {}} />);
    expect(screen.getByText(/Responder-verified road blockage/)).toBeInTheDocument();
  });
});

describe("ForecastCurve", () => {
  it("has an accessible label", () => {
    render(<ForecastCurve points={detailFixture.properties.forecast_curve} />);
    expect(screen.getByRole("img", { name: /next 3 hours/i })).toBeInTheDocument();
  });
});

describe("SummaryBar / ViewToggle / TopRisks", () => {
  it("summary shows counts per level", () => {
    render(<SummaryBar counts={{ LOW: 5, MEDIUM: 20, HIGH: 13 }} view="peak" total={38} />);
    expect(screen.getByTestId("count-HIGH")).toHaveTextContent("13");
    expect(screen.getByText(/Worst case/)).toBeInTheDocument();
  });
  it("toggle reports the chosen view and exposes aria-pressed", () => {
    const onChange = vi.fn();
    render(<ViewToggle view="peak" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /Peak/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Now" }));
    expect(onChange).toHaveBeenCalledWith("now");
  });
  it("top list selects a road", () => {
    const onSelect = vi.fn();
    const items = riskFixture.features.slice(0, 3).map((f) => f.properties);
    render(<TopRisks items={items} view="now" selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(items[1].name) }));
    expect(onSelect).toHaveBeenCalledWith(items[1].segment_id);
  });
});

describe("DemoPanel", () => {
  it("switching scenario sends only the scenario", () => {
    const onApply = vi.fn();
    render(<DemoPanel scenario={scenarioFixture} busy={false} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("Rain scenario"), { target: { value: "extreme_rain" } });
    expect(onApply).toHaveBeenCalledWith({ scenario: "extreme_rain" });
  });
  it("stale toggle sends 90 minutes, and back to 1", () => {
    const onApply = vi.fn();
    const { rerender } = render(<DemoPanel scenario={scenarioFixture} busy={false} onApply={onApply} />);
    fireEvent.click(screen.getByLabelText("Simulate stale rain data"));
    expect(onApply).toHaveBeenLastCalledWith({ rain_data_age_min: 90 });
    rerender(<DemoPanel scenario={{ ...scenarioFixture, rain_data_age_min: 90 }} busy={false} onApply={onApply} />);
    fireEvent.click(screen.getByLabelText("Simulate stale rain data"));
    expect(onApply).toHaveBeenLastCalledWith({ rain_data_age_min: 1 });
  });
  it("dragging the slider sends ONE request after the drag settles (debounce)", () => {
    vi.useFakeTimers();
    const onApply = vi.fn();
    render(<DemoPanel scenario={scenarioFixture} busy={false} onApply={onApply} debounceMs={250} />);
    const slider = screen.getByLabelText("Simulated time offset in minutes");
    [220, 230, 240].forEach((v) => fireEvent.change(slider, { target: { value: String(v) } }));
    expect(onApply).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ now_offset_min: 240 });
    vi.useRealTimers();
  });
});
