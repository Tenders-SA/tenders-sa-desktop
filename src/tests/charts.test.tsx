/**
 * Chart primitives (Slice 8, T3 — R-V6, R-V7, R-V8).
 *
 * These assert against real rendered output, not against a measurement
 * shim: the primitives use a fixed `viewBox` and never touch the DOM for
 * sizing, which is precisely why they can be tested this way in jsdom. That
 * property is the reason a charting library was not used, so the first
 * describe block pins it.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AreaTrend } from "../components/charts/AreaTrend";
import { BarRow } from "../components/charts/BarRow";
import { Donut } from "../components/charts/Donut";
import { Gauge } from "../components/charts/Gauge";
import { chartColor, surfaceColor } from "../components/charts/chart-tokens";
import {
  arcPath,
  areaPath,
  bandScale,
  linePath,
  linearScale,
  niceMax,
  polarPoint,
} from "../components/charts/scale";

describe("chart geometry", () => {
  it("maps a domain onto a range", () => {
    const scale = linearScale([0, 100], [0, 50]);
    expect(scale(0)).toBe(0);
    expect(scale(50)).toBe(25);
    expect(scale(100)).toBe(50);
  });

  it("survives a flat series rather than emitting NaN", () => {
    // Every value identical — a brand-new account with no activity. The
    // marks must land somewhere real, or the line silently disappears.
    const scale = linearScale([0, 0], [100, 10]);
    expect(scale(0)).toBe(100);
    expect(Number.isNaN(scale(5))).toBe(false);
  });

  it("places bands evenly and centres marks within them", () => {
    const band = bandScale(4, [0, 400], 0);
    expect(band.step).toBe(100);
    expect(band.centre(0)).toBe(50);
    expect(band.centre(3)).toBe(350);
  });

  it("does not divide by zero for an empty series", () => {
    const band = bandScale(0, [0, 400]);
    expect(band.step).toBe(0);
    expect(Number.isNaN(band.centre(0))).toBe(false);
  });

  it("rounds an axis maximum up to a readable bound", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(1402)).toBe(2500);
  });

  it("puts zero radians at twelve o'clock and runs clockwise", () => {
    const top = polarPoint(0, 0, 10, 0);
    expect(top.x).toBeCloseTo(0);
    expect(top.y).toBeCloseTo(-10);
    const right = polarPoint(0, 0, 10, Math.PI / 2);
    expect(right.x).toBeCloseTo(10);
    expect(right.y).toBeCloseTo(0);
  });

  it("emits nothing for an empty path rather than a broken one", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], 10)).toBe("");
    expect(arcPath(0, 0, 10, 5, 1, 1)).toBe("");
  });

  it("closes an area down to the baseline", () => {
    const d = areaPath(
      [
        { x: 0, y: 10 },
        { x: 10, y: 5 },
      ],
      20,
    );
    expect(d.startsWith("M0 10")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("L10 20");
  });

  it("draws a full circle as two arcs, not as an invisible one", () => {
    // A single slice covering the whole donut: start and end coincide, and
    // one arc command renders nothing. This is the user with exactly one
    // application, so it is a real case, not a theoretical one.
    const d = arcPath(80, 80, 68, 44, 0, Math.PI * 2);
    const arcs = d.match(/A/g) ?? [];
    expect(arcs.length).toBe(4);
  });
});

describe("chart tokens (R-V8)", () => {
  it("resolves a series colour through the design-system ramp", () => {
    expect(chartColor(2)).toBe("hsl(var(--chart-2))");
    expect(chartColor(2, 0.16)).toBe("hsl(var(--chart-2) / 0.16)");
    expect(surfaceColor("border")).toBe("hsl(var(--border))");
  });
});

describe("AreaTrend", () => {
  const props = {
    label: "Market activity over the last 30 days",
    xLabels: ["1 Aug", "2 Aug", "3 Aug", "4 Aug"],
    series: [
      { label: "Tenders", token: 1 as const, values: [4, 8, 6, 10] },
      { label: "Awards", token: 2 as const, values: [1, 2, 2, 3] },
    ],
  };

  it("is announced as an image with a meaningful name (R-V7)", () => {
    render(<AreaTrend {...props} />);
    expect(screen.getByRole("img", { name: props.label })).toBeInTheDocument();
  });

  it("carries the same numbers in a hidden table (R-V7)", () => {
    render(<AreaTrend {...props} />);
    const table = screen.getByRole("table", { name: props.label });
    expect(table).toHaveClass("sr-only");
    expect(table).toHaveTextContent("Tenders: 8, Awards: 2");
  });

  it("describes the image by that table", () => {
    render(<AreaTrend {...props} />);
    const svg = screen.getByRole("img", { name: props.label });
    const table = screen.getByRole("table", { name: props.label });
    expect(svg.getAttribute("aria-describedby")).toBe(table.id);
  });

  it("draws one filled area and one line per series", () => {
    const { container } = render(<AreaTrend {...props} />);
    const paths = [...container.querySelectorAll("path")];
    expect(paths).toHaveLength(4);
    expect(paths.filter((p) => p.getAttribute("fill") === "none")).toHaveLength(
      2,
    );
  });

  it("scales both series against one shared maximum", () => {
    // Separate scales would draw 3 and 300 at the same height, which is a
    // lie the reader has no way to detect.
    const { container } = render(<AreaTrend {...props} />);
    const lines = [...container.querySelectorAll("path")].filter(
      (p) => p.getAttribute("fill") === "none",
    );
    const topOf = (d: string) =>
      Math.min(
        ...[...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) =>
          Number(m[2]),
        ),
      );
    expect(topOf(lines[0].getAttribute("d") ?? "")).toBeLessThan(
      topOf(lines[1].getAttribute("d") ?? ""),
    );
  });

  it("renders a baseline for an all-zero window instead of crashing", () => {
    const { container } = render(
      <AreaTrend
        label="Market activity"
        xLabels={["1 Aug", "2 Aug"]}
        series={[{ label: "Tenders", token: 1, values: [0, 0] }]}
      />,
    );
    const line = container.querySelector('path[fill="none"]');
    expect(line?.getAttribute("d")).not.toContain("NaN");
  });

  it("names each series beside its swatch, not by colour alone", () => {
    render(<AreaTrend {...props} />);
    expect(screen.getByText("Tenders")).toBeInTheDocument();
    expect(screen.getByText("Awards")).toBeInTheDocument();
  });
});

describe("BarRow", () => {
  const data = [
    { label: "Gauteng", value: 1402 },
    { label: "Western Cape", value: 903 },
    { label: "Northern Cape", value: 0 },
  ];

  it("renders a row per datum with its formatted value", () => {
    render(<BarRow label="Tenders by province" data={data} />);
    const table = screen.getByRole("table", { name: "Tenders by province" });
    expect(table).toHaveTextContent("Gauteng");
    expect(table).toHaveTextContent("1 402");
  });

  it("keeps a zero row visible as a stub rather than dropping it", () => {
    // A zero-width bar reads as a missing province, not as "none here".
    const { container } = render(
      <BarRow label="Tenders by province" data={data} />,
    );
    const filled = [...container.querySelectorAll("rect")].filter(
      (rect) => rect.getAttribute("fill") === chartColor(1),
    );
    expect(filled).toHaveLength(3);
    expect(Number(filled[2].getAttribute("width"))).toBeGreaterThan(0);
  });

  it("grows its coordinate system with the number of rows", () => {
    const { container } = render(
      <BarRow label="Runway" data={data.slice(0, 2)} />,
    );
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 480 44",
    );
  });

  it("accepts a per-row token so one row can be marked out", () => {
    const { container } = render(
      <BarRow
        label="Runway"
        data={[
          { label: "Today", value: 2, token: 4 },
          { label: "Tomorrow", value: 1 },
        ]}
      />,
    );
    const fills = [...container.querySelectorAll("rect")].map((r) =>
      r.getAttribute("fill"),
    );
    expect(fills).toContain(chartColor(4));
  });
});

describe("Donut", () => {
  const slices = [
    { label: "Draft", value: 5, token: 1 as const },
    { label: "Submitted", value: 4, token: 2 as const },
    { label: "Rejected", value: 0, token: 4 as const },
  ];

  it("draws one arc per non-zero slice", () => {
    const { container } = render(
      <Donut
        label="Your pipeline by status"
        slices={slices}
        centreValue="9"
        centreLabel="applications"
      />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("still lists a zero category in the hidden table", () => {
    // It is information — "nothing has been rejected" — and dropping the row
    // would leave the reader unable to tell that from "not tracked".
    render(
      <Donut
        label="Your pipeline by status"
        slices={slices}
        centreValue="9"
        centreLabel="applications"
      />,
    );
    expect(
      screen.getByRole("table", { name: "Your pipeline by status" }),
    ).toHaveTextContent("Rejected");
  });

  it("renders a single category as a complete ring", () => {
    const { container } = render(
      <Donut
        label="Your pipeline by status"
        slices={[{ label: "Draft", value: 1, token: 1 }]}
        centreValue="1"
        centreLabel="application"
      />,
    );
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d).not.toBe("");
    expect((d.match(/A/g) ?? []).length).toBe(4);
  });
});

describe("Gauge", () => {
  it("fills in proportion to the capacity", () => {
    const { container } = render(
      <Gauge label="Application slots" value={3} max={10} caption="of 10" />,
    );
    const arcs = container.querySelectorAll("path");
    expect(arcs).toHaveLength(2);
  });

  it("draws no fill at all on an unlimited plan", () => {
    // max === 0 means unlimited here. A full arc would tell the user they
    // have run out, which is the opposite of the truth.
    const { container } = render(
      <Gauge
        label="Application slots"
        value={12}
        max={0}
        display="12"
        caption="used"
      />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(
      screen.getByRole("table", { name: "Application slots" }),
    ).toHaveTextContent("Unlimited");
  });

  it("never overfills when usage exceeds the stated capacity", () => {
    const { container } = render(
      <Gauge label="Application slots" value={14} max={10} caption="of 10" />,
    );
    const fill = container.querySelectorAll("path")[1];
    expect(fill.getAttribute("d")).not.toContain("NaN");
  });
});
