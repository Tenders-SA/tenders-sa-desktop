import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseTokens, type Hsl } from "./helpers/contrast";

// Resolved from the project root: the jsdom test environment rewrites
// import.meta.url to an http URL, so a file URL cannot be used here.
const cssPath = resolve(process.cwd(), "src/styles/tokens.css");
const css = readFileSync(cssPath, "utf8");

/**
 * Declarations only. The single-theme assertions below must judge the
 * actual CSS, not the prose explaining it -- the file's own comments
 * name `prefers-color-scheme` precisely to say it is not used.
 */
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = parseTokens(css);

/** WCAG 2.2 AA thresholds. */
const AA_BODY_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

function token(name: string): Hsl {
  const value = tokens[name];
  if (!value) {
    throw new Error(`token --${name} is not defined in tokens.css`);
  }
  return value;
}

function ratio(fg: string, bg: string): number {
  return contrastRatio(token(fg), token(bg));
}

/** Every token the design system promises to define. */
const REQUIRED_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "sidebar-background",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-border",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "warning",
  "error",
  "info",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

/** Text-on-surface pairings: AA body text, 4.5:1. */
const TEXT_PAIRS: ReadonlyArray<[string, string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["sidebar-foreground", "sidebar-background"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  // Status colours used as text/iconography on both base surfaces.
  ["success", "background"],
  ["success", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["error", "background"],
  ["error", "card"],
  ["info", "background"],
  ["info", "card"],
  ["primary", "background"],
  ["accent", "background"],
  ["destructive", "background"],
];

/**
 * Non-text pairings that WCAG 2.2 SC 1.4.11 actually governs:
 * information required to identify a control or its state.
 */
const NON_TEXT_PAIRS: ReadonlyArray<[string, string]> = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
  ["ring", "card"],
  ["ring", "popover"],
  ["sidebar-primary", "sidebar-background"],
];

describe("design tokens", () => {
  it("defines every required token", () => {
    for (const name of REQUIRED_TOKENS) {
      expect(tokens[name], `--${name} must be defined`).toBeDefined();
    }
  });

  it("defines exactly one theme: no light-mode variant anywhere", () => {
    // REQ-17 is explicit that no light-theme token set is introduced.
    expect(cssWithoutComments).not.toMatch(/prefers-color-scheme/);
    expect(cssWithoutComments).not.toMatch(/\.dark\b/);
    expect(cssWithoutComments).not.toMatch(/\[data-theme/);
    // Exactly one selector block may declare tokens.
    const selectorBlocks = cssWithoutComments.match(/^[^\s@/*][^{]*\{/gm) ?? [];
    expect(selectorBlocks).toHaveLength(1);
    expect(selectorBlocks[0]).toMatch(/^:root\s*\{/);
  });

  describe.each(TEXT_PAIRS)("text: %s on %s", (fg, bg) => {
    it(`meets AA body contrast (>= ${AA_BODY_TEXT}:1)`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA_BODY_TEXT);
    });
  });

  describe.each(NON_TEXT_PAIRS)("non-text: %s on %s", (fg, bg) => {
    it(`meets AA non-text contrast (>= ${AA_NON_TEXT}:1)`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });

  it("keeps --border decorative-only and documents why", () => {
    // --border is deliberately below 3:1: it is a divider/card edge,
    // not information identifying a control, so SC 1.4.11 does not
    // apply. This test pins that as an intentional decision -- if
    // someone raises --border to control-boundary contrast, they must
    // come here and decide whether --input is what they actually
    // wanted.
    expect(ratio("border", "background")).toBeLessThan(AA_NON_TEXT);
    expect(css).toMatch(/DECORATIVE ONLY/);
    // The token that IS a control boundary must clear the bar.
    expect(ratio("input", "background")).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("keeps chart series distinguishable from the surfaces they sit on", () => {
    for (const series of [
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]) {
      expect(
        ratio(series, "background"),
        `--${series} on --background`,
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      expect(
        ratio(series, "card"),
        `--${series} on --card`,
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  it("tightens the corner radius relative to the web platform", () => {
    expect(css).toMatch(/--radius:\s*0\.375rem/);
  });
});

/**
 * The chart modules must reach the ramp through the tokens, not around it
 * (Slice 8, R-V8).
 *
 * The contrast guarantees above are properties of `--chart-1` … `--chart-5`.
 * A literal `#2a78d6` in a chart carries none of them, and nothing else in
 * the suite would notice — the chart would render, look plausible, and quietly
 * fail AA on a dark surface. So the sources are scanned.
 */
describe("chart sources use tokens, never literals", () => {
  const CHART_SOURCES = [
    "components/charts/scale.ts",
    "components/charts/chart-tokens.ts",
    "components/charts/ChartFrame.tsx",
    "components/charts/AreaTrend.tsx",
    "components/charts/BarRow.tsx",
    "components/charts/Donut.tsx",
    "components/charts/Gauge.tsx",
    "features/command-centre/PulseTotals.tsx",
    "features/command-centre/MarketPanel.tsx",
    "features/command-centre/PipelinePanel.tsx",
    "features/command-centre/RunwayPanel.tsx",
    "features/auth/BidPipelineDiagram.tsx",
    "features/auth/SignInBrandPanel.tsx",
    "features/auth/SignInStatusFooter.tsx",
  ];

  const srcRoot = resolve(process.cwd(), "src");

  /** Declarations only: a hex code quoted in prose is not a defect. */
  function code(path: string): string {
    return readFileSync(resolve(srcRoot, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it("scans every chart source it claims to", () => {
    // Guards the guard: a renamed file would otherwise make this vacuous.
    for (const path of CHART_SOURCES) {
      expect(() => code(path), path).not.toThrow();
    }
  });

  it("contains no hex, rgb() or hsl() literal", () => {
    for (const path of CHART_SOURCES) {
      const source = code(path);
      expect(source, `${path}: hex literal`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, `${path}: rgb()`).not.toMatch(/\brgba?\(/);
      // `hsl(var(--x))` is the sanctioned form; `hsl(160 70% 42%)` is not.
      expect(source, `${path}: raw hsl()`).not.toMatch(/\bhsla?\(\s*[\d.]/);
    }
  });

  it("contains no raw Tailwind palette class", () => {
    for (const path of CHART_SOURCES) {
      expect(code(path), path).not.toMatch(
        /(bg|text|border|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}/,
      );
    }
  });
});
