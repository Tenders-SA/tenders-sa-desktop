import type { TenderDetail } from "../../../services/api/endpoints/tenders";
import { analysisPoints, type AnalysisPoint } from "./analysis-presentation";

export function TenderAnalysisWorkbench({ tender }: { tender: TenderDetail }) {
  const points = analysisPoints(tender);
  const compliance = points.filter((point) => point.priority <= 1);
  const remaining = points.filter((point) => point.priority > 1);
  const documents = tender.documents ?? [];
  const analysedDocuments = documents.filter(
    (document) => (document.analyses?.length ?? 0) > 0,
  ).length;
  const totalDocuments = tender.documentStats?.total ?? documents.length;

  if (points.length === 0) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-card-foreground">
          AI-Analyzed Compliance Requirements
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tender.documentStats?.pending
            ? "Tender documents are still being analysed. Requirements may appear progressively."
            : "No analysed document requirements are available yet. Verify the official tender documents before applying."}
        </p>
      </section>
    );
  }

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <main className="min-w-0 space-y-5">
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <header className="border-b border-primary/20 bg-primary/5 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Bid-critical review
                </p>
                <h2 className="mt-1 text-xl font-semibold text-card-foreground">
                  AI-Analyzed Compliance Requirements
                </h2>
              </div>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {compliance.length} actionable points
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Consolidated from {analysedDocuments} of {totalDocuments} tender
              documents. Verify every item against the official source before
              submission.
            </p>
          </header>
          <PointGroups points={compliance} />
        </section>

        {remaining.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-card-foreground">
              Full document analysis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Evaluation, technical, financial, dates and contact intelligence.
            </p>
            <PointGroups points={remaining} />
          </section>
        )}
      </main>

      <aside className="h-fit rounded-xl border border-border bg-card p-4 xl:sticky xl:top-4">
        <h2 className="text-sm font-semibold text-card-foreground">
          Preparation coverage
        </h2>
        <div className="mt-3 text-3xl font-semibold text-primary">
          {totalDocuments
            ? Math.round((analysedDocuments / totalDocuments) * 100)
            : 0}
          %
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {analysedDocuments < totalDocuments
            ? "Analysis is partial. Use the available findings, but review every unprocessed document."
            : "All currently listed documents have analysis records."}
        </p>
        <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Next: start or continue the application below to compare these
          requirements with your company evidence.
        </p>
      </aside>
    </div>
  );
}

function PointGroups({ points }: { points: AnalysisPoint[] }) {
  const groups = new Map<string, AnalysisPoint[]>();
  for (const point of points) {
    const group = groups.get(point.label) ?? [];
    group.push(point);
    groups.set(point.label, group);
  }
  if (points.length === 0) {
    return (
      <p className="p-5 text-sm text-muted-foreground">
        No meaningful points were extracted in this section. Review the official
        documents.
      </p>
    );
  }
  return (
    <div className="divide-y divide-border">
      {[...groups].map(([label, entries]) => (
        <section key={label} className="px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              {label}
            </h3>
            <span className="text-xs text-muted-foreground">
              {entries.length}
            </span>
          </div>
          <SourceGroups entries={entries} />
        </section>
      ))}
    </div>
  );
}

function SourceGroups({ entries }: { entries: AnalysisPoint[] }) {
  const sources = new Map<string, AnalysisPoint[]>();
  for (const entry of entries) {
    const source = entry.source ?? "Tender record";
    const sourceEntries = sources.get(source) ?? [];
    sourceEntries.push(entry);
    sources.set(source, sourceEntries);
  }

  return (
    <div className="mt-3 space-y-3">
      {[...sources].map(([source, sourceEntries]) => (
        <article
          key={source}
          className="overflow-hidden rounded-lg border border-border bg-background"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Source document
              </p>
              <h4
                className="truncate text-sm font-medium text-foreground"
                title={source}
              >
                {source}
              </h4>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {sourceEntries.length}{" "}
              {sourceEntries.length === 1 ? "point" : "points"}
            </span>
          </header>
          <ul className="divide-y divide-border/70 px-4">
            {sourceEntries.map((point, index) => (
              <li
                key={`${point.category}-${index}`}
                className="flex gap-3 py-2.5 text-sm leading-6 text-foreground"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                />
                <span>{point.content}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
