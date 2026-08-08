import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import type { ApplicationsEndpoint } from "../../services/api/endpoints/applications";
import type { DocumentsEndpoint } from "../../services/api/endpoints/documents";
import { ClosingLabel } from "../tenders/ClosingLabel";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

/**
 * The statuses the parent counts as an active application. Mirrors the
 * status list the web application's own summary used to query with.
 */
const ACTIVE_STATUSES = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW"]);

/** The server's seven-day deadline window, mirrored client-side. */
const CLOSING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deadlines and pipeline value (brief §6.1).
 *
 * Data comes from `/api/v1/applications` plus `/api/v1/documents/stats` —
 * the same live routes the web dashboard feeds from. The dedicated
 * `/api/v1/dashboard/summary` route answers `{}` on the running site
 * (see `docs/specifications/dashboard-live-data.md`), so the closing-window
 * filter the summary used to apply server-side is applied here instead.
 * The window is still seven days, so the desktop and the web app agree.
 */
export function DeadlinePanel({
  applications,
  documents,
}: {
  applications: ApplicationsEndpoint;
  documents: DocumentsEndpoint;
}) {
  const state = useAsync(
    async (signal) => {
      const [apps, stats] = await Promise.all([
        applications.list({ limit: 50 }, signal),
        documents.getStats(signal),
      ]);
      return { apps: apps.applications, stats };
    },
    [applications, documents],
  );

  return (
    <Panel title="Closing this week">
      <AsyncSection
        state={state}
        subject="your deadlines"
        onRetry={state.reload}
      >
        {({ apps, stats }) => {
          const active = apps.filter(
            (application) =>
              !application.isArchived &&
              ACTIVE_STATUSES.has(application.status),
          );

          const now = Date.now();
          const closing = active
            .filter((application) => {
              const when = application.tender?.closingDate;
              if (!when) return false;
              const at = new Date(when).getTime();
              return at >= now && at <= now + CLOSING_WINDOW_MS;
            })
            .sort(
              (a, b) =>
                new Date(a.tender.closingDate as string).getTime() -
                new Date(b.tender.closingDate as string).getTime(),
            );

          const pipelineTotal = active.reduce(
            (sum, application) =>
              sum + (application.tender?.estimatedValue ?? 0),
            0,
          );

          return (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label={closing.length === 1 ? "Application" : "Applications"}
                  value={String(closing.length)}
                />
                <Stat
                  label="Documents on file"
                  value={String(stats?.totalDocuments ?? 0)}
                />
                <Stat
                  label="Pipeline value"
                  value={pipelineTotal > 0 ? ZAR.format(pipelineTotal) : "—"}
                />
              </div>

              {closing.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing closes in the next seven days.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {closing.slice(0, 3).map((application) => (
                    <li
                      key={application.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {application.tender?.title ?? "Unknown tender"}
                      </span>
                      <span className="shrink-0 text-sm">
                        <ClosingLabel
                          closingDate={application.tender.closingDate as string}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </AsyncSection>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-card-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
