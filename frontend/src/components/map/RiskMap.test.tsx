import { fireEvent, render } from "@testing-library/react";
import RiskMap from "./RiskMap";
import { CLASS_STYLE, classFor } from "../../lib/risk";
import { riskFixture } from "../../test/fixtures";

// Real Leaflet + react-leaflet rendering in jsdom (tiles are just <img> tags; nothing is fetched).
const lines = (c: HTMLElement) => Array.from(c.querySelectorAll("path.leaflet-interactive"));

describe("RiskMap (real Leaflet)", () => {
  it("draws one line per road segment", () => {
    const { container } = render(<RiskMap data={riskFixture} view="peak" selectedId={null} onSelect={() => {}} />);
    expect(lines(container)).toHaveLength(38);
  });

  it("colours and patterns each line by its class, and switches with the Now/Peak view", () => {
    const strokes = (view: "now" | "peak") => {
      const { container, unmount } = render(<RiskMap data={riskFixture} view={view} selectedId={null} onSelect={() => {}} />);
      const out = lines(container).map((p) => p.getAttribute("stroke"));
      unmount();
      return out;
    };
    const expected = (view: "now" | "peak") => riskFixture.features.map((f) => CLASS_STYLE[classFor(f.properties, view)].color);
    expect(strokes("peak")).toEqual(expected("peak"));
    expect(strokes("now")).toEqual(expected("now"));
    expect(strokes("now")).not.toEqual(strokes("peak")); // the fixture has roads that are LOW now but worse at peak
  });

  it("uses a dash pattern for MEDIUM (not colour alone)", () => {
    const { container } = render(<RiskMap data={riskFixture} view="peak" selectedId={null} onSelect={() => {}} />);
    const med = lines(container).filter((p) => p.getAttribute("stroke") === CLASS_STYLE.MEDIUM.color);
    expect(med.length).toBeGreaterThan(0);
    med.forEach((p) => expect(p.getAttribute("stroke-dasharray")).toBe(CLASS_STYLE.MEDIUM.dashArray));
  });

  it("clicking a line selects that segment", () => {
    const onSelect = vi.fn();
    const { container } = render(<RiskMap data={riskFixture} view="peak" selectedId={null} onSelect={onSelect} />);
    fireEvent.click(lines(container)[7]); // 8th feature = R-008
    expect(onSelect).toHaveBeenCalledWith(riskFixture.features[7].id);
  });

  it("draws a white halo under the selected segment", () => {
    const { container } = render(<RiskMap data={riskFixture} view="peak" selectedId="R-008" onSelect={() => {}} />);
    const halo = Array.from(container.querySelectorAll("path")).filter((p) => p.getAttribute("stroke") === "#fff");
    expect(halo).toHaveLength(1);
  });
});
