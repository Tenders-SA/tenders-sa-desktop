import { describe, expect, it } from "vitest";
import type { RadarExtendedProfile } from "../services/api/endpoints/company";
import type {
  RadarScenarioResult,
  RecommendedTender,
} from "../services/api/endpoints/recommendations";
import {
  applyRadarScenario,
  capRadarMatches,
  classifyRadarScore,
  countRadarBands,
  filterRadarMatches,
  findTopRadarGap,
  normalizeRadarMatches,
  projectRadarProfile,
  revealRadarMatches,
  sortRadarMatches,
  type RadarWorkspaceMatch,
} from "../features/radar/radar-workspace-model";

function recommendation(
  id: string,
  score: number,
  overrides: Partial<RecommendedTender> = {},
): RecommendedTender {
  return {
    id,
    tenderId: `t-${id}`,
    tender: {
      id: `t-${id}`,
      title: `Tender ${id}`,
      referenceNumber: null,
      description: null,
      closingDate: null,
      estimatedValue: null,
      province: null,
      sourceOrganization: null,
      status: "ACTIVE",
    },
    score,
    baseScore: null,
    reasoning: null,
    factors: null,
    improvementAreas: null,
    calculatedAt: "2026-08-14T00:00:00.000Z",
    matchCategory: "potential",
    ...overrides,
  };
}

function match(id: string, score: number): RadarWorkspaceMatch {
  return normalizeRadarMatches([recommendation(id, score)])[0];
}

describe("Radar workspace model", () => {
  it.each([
    [29, "not_fit"],
    [30, "near_miss"],
    [49, "near_miss"],
    [50, "potential"],
    [69, "potential"],
    [70, "highly_qualified"],
  ] as const)("classifies %s as %s", (score, band) => {
    expect(classifyRadarScore(score)).toBe(band);
  });

  it.each([
    ["free", 0],
    ["starter", 10],
    ["professional", 50],
    ["enterprise", 50],
  ] as const)("caps %s at %s", (access, expected) => {
    const matches = Array.from({ length: 60 }, (_, index) =>
      match(String(index), 80),
    );
    expect(capRadarMatches(matches, access)).toHaveLength(expected);
  });

  it("normalizes saved state, AI gaps and counts after the cap", () => {
    const matches = normalizeRadarMatches(
      [
        recommendation("a", 75, {
          aiRecommendation: {
            improvementAreas: { gaps: ["CIDB"], actions: ["Upgrade"] },
          },
        }),
        recommendation("b", 55),
        recommendation("c", 35),
      ],
      ["t-a"],
    );
    expect(matches[0]).toMatchObject({
      isSaved: true,
      gaps: ["CIDB"],
      actions: ["Upgrade"],
    });
    expect(countRadarBands(matches)).toEqual({
      all: 3,
      highly_qualified: 1,
      potential: 1,
      near_miss: 1,
    });
  });

  it("uses exactly the six weighted profile signals", () => {
    const extended: RadarExtendedProfile = {
      company: {
        id: "c1",
        name: "Acme",
        registrationNumber: "2020/1",
        bbbeeLevel: 2,
        industryCodes: [],
        annualTurnover: null,
      },
      profile: { cidbGrading: "6CE", companyType: "PRIVATE_COMPANY" },
    };
    const projection = projectRadarProfile(extended);
    expect(projection.signals.map((signal) => signal.weight)).toEqual([
      20, 20, 20, 20, 10, 10,
    ]);
    expect(projection.score).toBe(70);
  });

  it("normalizes gaps case-insensitively and breaks ties by first appearance", () => {
    const first = { ...match("a", 70), gaps: [" CIDB grade ", "B-BBEE"] };
    const second = { ...match("b", 60), gaps: ["cidb GRADE", "b-bbee"] };
    expect(findTopRadarGap([first, second])).toBe("CIDB grade");
    expect(
      findTopRadarGap([{ ...match("c", 50), gaps: ["", "  "] }]),
    ).toBeNull();
  });

  it("combines honest date filters and does not treat invalid dates as current", () => {
    const recent = {
      ...match("recent", 70),
      closingDate: "2026-08-20T00:00:00.000Z",
      calculatedAt: "2026-08-12T00:00:00.000Z",
    };
    const invalid = {
      ...match("invalid", 70),
      closingDate: "not-a-date",
      calculatedAt: "not-a-date",
    };
    expect(
      filterRadarMatches(
        [invalid, recent],
        { band: "highly_qualified", closingSoon: true, newThisWeek: true },
        new Date("2026-08-14T00:00:00.000Z"),
      ).map((item) => item.matchingScoreId),
    ).toEqual(["recent"]);
  });

  it("sorts unknown dates and values last without mutating base order", () => {
    const unknown = match("unknown", 50);
    const known = {
      ...match("known", 60),
      closingDate: "2026-08-20T00:00:00.000Z",
      estimatedValue: 100,
    };
    const source = [unknown, known];
    expect(sortRadarMatches(source, "closing_soon")[0].matchingScoreId).toBe(
      "known",
    );
    expect(sortRadarMatches(source, "highest_value")[0].matchingScoreId).toBe(
      "known",
    );
    expect(source[0]).toBe(unknown);
  });

  it("reveals locally and applies a scenario without mutating base scores", () => {
    const base = [match("a", 50), match("b", 70)];
    const scenario: RadarScenarioResult = {
      scenarioType: "cidb",
      scannedCount: 1,
      current: { highlyQualified: 0, potential: 1, nearMiss: 0, total: 1 },
      scenario: { highlyQualified: 1, potential: 0, nearMiss: 0, total: 1 },
      delta: { averageDelta: 22, improvedCount: 1, topMovers: [] },
      rows: [
        {
          id: "a",
          title: "Tender a",
          currentScore: 50,
          scenarioScore: 72,
          delta: 22,
        },
      ],
    };
    const overlay = applyRadarScenario(base, scenario);
    expect(sortRadarMatches(overlay, "best_match")[0].matchingScoreId).toBe(
      "a",
    );
    expect(overlay[0]).toMatchObject({
      score: 50,
      scenarioScore: 72,
      scenarioDelta: 22,
    });
    expect(base[0].scenarioScore).toBeUndefined();
    expect(
      revealRadarMatches(
        Array.from({ length: 20 }, (_, index) => match(String(index), 50)),
        15,
      ),
    ).toHaveLength(15);
  });
});
