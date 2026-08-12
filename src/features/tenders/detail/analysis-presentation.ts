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
  ["localContentRequirement", "Local content", 5],
  ["hdiRequirement", "HDI / subcontracting", 6],
  ["importantDates", "Important dates", 7],
  ["contactInformation", "Contacts", 8],
] as const;

const priorityBySection: Record<string, number> = {
  complianceRequirements: 0,
  returnable_documents: 0,
  eligibility: 0,
  bbbee: 0,
  health_safety: 0,
  submissionGuidelines: 1,
  evaluationCriteria: 2,
  technicalSpecifications: 3,
  financialRequirements: 4,
  pricing_schedule: 4,
  importantDates: 7,
  contactInformation: 8,
};

export function analysisPoints(tender: TenderDetail): AnalysisPoint[] {
  const points: AnalysisPoint[] = [];
  for (const document of tender.documents ?? []) {
    const source = document.fileName ?? undefined;
    for (const analysis of document.analyses ?? []) {
      for (const [category, label, priority] of fields) {
        add(points, category, label, analysis[category], source, priority);
      }
      for (const section of analysis.analysisSections ?? []) {
        const label = humanize(section.sectionType);
        add(
          points,
          section.sectionType,
          label,
          section.content,
          section.source?.documentName ?? source,
          priorityBySection[section.sectionType] ?? 6,
        );
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

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}
