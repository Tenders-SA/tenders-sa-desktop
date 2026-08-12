import type { TenderDetail } from "../../../services/api/endpoints/tenders";
import { describeJsonField } from "../tender-fields";

export function TenderIntelligenceOverview({
  tender,
}: {
  tender: TenderDetail;
}) {
  const summaries = (tender.documents ?? []).flatMap((document) => {
    const summary = document.summary?.trim();
    return summary ? [summary] : [];
  });
  const requirements = (tender.documents ?? [])
    .flatMap((document) => describeJsonField(document.keyPoints) ?? [])
    .filter(
      (requirement, index, all) =>
        all.findIndex(
          (candidate) => candidate.toLowerCase() === requirement.toLowerCase(),
        ) === index,
    );

  if (summaries.length === 0 && requirements.length === 0) return null;

  return (
    <section
      aria-labelledby="tender-intelligence-heading"
      className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            AI-generated tender intelligence
          </p>
          <h2
            id="tender-intelligence-heading"
            className="mt-0.5 text-base font-semibold text-card-foreground"
          >
            Understand the opportunity at a glance
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Verify against official documents
        </span>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {summaries.length > 0 && (
          <div className="px-5 py-4 lg:border-r lg:border-border">
            <h3 className="text-sm font-semibold text-primary">AI Summary</h3>
            <div className="mt-2 space-y-2">
              {summaries.map((summary, index) => (
                <p
                  key={`${index}-${summary}`}
                  className="text-sm leading-6 text-foreground"
                >
                  {summary}
                </p>
              ))}
            </div>
          </div>
        )}
        {requirements.length > 0 && (
          <div className="border-t border-border px-5 py-4 lg:border-t-0">
            <h3 className="text-sm font-semibold text-foreground">
              Key Requirements
            </h3>
            <ul className="mt-2 space-y-2">
              {requirements.map((requirement, index) => (
                <li
                  key={`${index}-${requirement}`}
                  className="flex gap-2.5 text-sm leading-5 text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning"
                  />
                  <span>{requirement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
