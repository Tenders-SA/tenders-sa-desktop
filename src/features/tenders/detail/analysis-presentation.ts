import type { TenderDetail } from "../../../services/api/endpoints/tenders";

export interface AnalysisPoint {
  category: string;
  label: string;
  content: string;
  source?: string;
  priority: number;
}

const fields = [
  ["complianceRequirements", "Compliance & regulatory", 0],
  ["submissionGuidelines", "Submission requirements", 1],
  ["evaluationCriteria", "Evaluation criteria", 2],
  ["technicalSpecifications", "Technical requirements", 3],
  ["financialRequirements", "Financial requirements", 4],
  ["importantDates", "Important dates", 7],
  ["contactInformation", "Contacts", 8],
] as const;

export function analysisPoints(tender: TenderDetail): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];
  for (const document of tender.documents ?? []) {
    const source = document.fileName ?? undefined;
    for (const analysis of document.analyses ?? []) {
      for (const [category, label, priority] of fields) {
        add(points, category, label, analysis[category], source, priority);
      }
    }
  }
  const seen = new Set<string>();
  return points
    .filter((point) => {
      const key = point.content
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (
        key.length < 8 ||
        seen.has(key) ||
        /insufficient searchable text|not specified|none provided/i.test(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

function add(
  points: AnalysisPoint[],
  category: string,
  label: string,
  value: unknown,
  source: string | undefined,
  priority: number,
) {
  if (typeof value !== "string" || !value.trim()) return;
  for (const content of value.split(/\r?\n|(?<=[.;])\s+(?=[A-Z0-9])/)) {
    const clean = content.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (clean)
      points.push({ category, label, content: clean, source, priority });
  }
}
