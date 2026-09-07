/**
 * Officer detail panel (TASK-1.7, design.md §UI, R-P10; TASK-1.8 R-P12).
 *
 * Headline current assignment (never a stale one), organisation name +
 * physical address, official contact points, related tenders, actions
 * toolbar. Data comes from the local index first and refreshes from the
 * server; masked server values carry an explicit marker. Fields with a
 * pending correction (R-P12) stay hidden until a later sync no longer
 * carries the disputed value.
 */

import { Link } from "react-router-dom";
import { OfficerActions } from "./OfficerActions";
import { QualityLabel } from "./QualityLabel";
import {
  isFieldSuppressed,
  type OfficerSuppressedMap,
} from "./use-officer-corrections";
import type { OfficerDetailView } from "./use-officer-detail";

export interface OfficerDetailPanelProps {
  view: OfficerDetailView;
  suppressed: OfficerSuppressedMap;
  onReportCorrection: (field: string, label: string, value: string) => void;
  onClose: () => void;
}

export function OfficerDetailPanel({
  view,
  suppressed,
  onReportCorrection,
  onClose,
}: OfficerDetailPanelProps) {
  const data = view.data;

  if (!data) {
    return (
      <section
        aria-label="Officer details"
        className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        {view.phase === "loading-local"
          ? "Loading officer details…"
          : "Officer not found locally."}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground"
        >
          Back to results
        </button>
      </section>
    );
  }

  const officerId = data.id;
  const nameSuppressed = isFieldSuppressed(
    suppressed,
    officerId,
    "officer",
    data.canonicalName,
  );
  const contacts = data.contactPoints.filter(
    (c) => !isFieldSuppressed(suppressed, officerId, c.type, c.value),
  );
  const emailContact = contacts.find((c) => c.type === "email") ?? null;
  const telephoneContact =
    contacts.find((c) => c.type === "telephone" || c.type === "mobile") ?? null;
  const headline = data.headlineAssignment;
  const titleSuppressed =
    headline !== null &&
    isFieldSuppressed(suppressed, officerId, "title", headline.title);
  const organisationSuppressed = isFieldSuppressed(
    suppressed,
    officerId,
    "organisation",
    data.organisationName,
  );

  const scrollToTenders = () => {
    document
      .getElementById("officer-related-tenders")
      ?.scrollIntoView({ block: "start" });
  };

  const report = (field: string, label: string, value: string | null) => {
    if (value !== null) onReportCorrection(field, label, value);
  };

  return (
    <section
      aria-label={`Details for ${data.canonicalName}`}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-primary/20 bg-primary/5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Officer record
          </p>
          <h2 className="mt-1 text-xl font-semibold text-card-foreground">
            {nameSuppressed ? "Name under review" : data.canonicalName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[data.currentTitle, data.province].filter(Boolean).join(" · ") ||
              "Details pending"}
          </p>
          {view.phase === "error" && (
            <p className="mt-2 text-sm text-warning" role="alert">
              Server refresh failed — showing the local record.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <QualityLabel status={data.status} lastSeenAt={data.lastSeenAt} />
          <button
            type="button"
            onClick={() => report("officer", "Name", data.canonicalName)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/50"
          >
            Report incorrect
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/50"
          >
            Back
          </button>
        </div>
      </header>

      {headline && (
        <div className="border-b border-border p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current assignment
            </p>
            {!titleSuppressed && headline.title && (
              <button
                type="button"
                onClick={() => report("title", "Current title", headline.title)}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Report
              </button>
            )}
          </div>
          {!titleSuppressed && (
            <p className="mt-1 font-medium">
              {headline.title ?? "Procurement role"}
              {headline.isCurrent && (
                <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  Current
                </span>
              )}
            </p>
          )}
          {!organisationSuppressed && headline.organisationName && (
            <p className="text-sm text-muted-foreground">
              {headline.organisationName}
            </p>
          )}
          {headline.validFrom && (
            <p className="mt-1 text-xs text-muted-foreground">
              Since {formatDate(headline.validFrom)}
              {headline.validTo
                ? ` — until ${formatDate(headline.validTo)}`
                : ""}
            </p>
          )}
        </div>
      )}

      {!organisationSuppressed &&
        (data.organisationName || data.organisationAddress) && (
          <div className="border-b border-border p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organisation
              </p>
              {data.organisationName && (
                <button
                  type="button"
                  onClick={() =>
                    report(
                      "organisation",
                      "Organisation",
                      data.organisationName,
                    )
                  }
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Report
                </button>
              )}
            </div>
            <p className="mt-1 text-sm font-medium">{data.organisationName}</p>
            {data.organisationAddress && (
              <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                {data.organisationAddress}
              </p>
            )}
          </div>
        )}

      <div className="border-b border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Official contacts
        </p>
        {contacts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No official contacts recorded.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
              >
                <span>
                  <span className="capitalize text-foreground/70">
                    {contact.type}:
                  </span>{" "}
                  {contact.value}
                  {contact.masked && (
                    <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      masked — sync to reveal
                    </span>
                  )}
                </span>
                {contact.type === "email" ? (
                  <a
                    href={`mailto:${contact.value}`}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary/50"
                  >
                    Email
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void view.copyValue(contact.value)}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary/50"
                  >
                    Copy
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    report(contact.type, contact.type, contact.value)
                  }
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Report
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-b border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Actions
        </p>
        <div className="mt-2">
          <OfficerActions
            emailContact={emailContact}
            telephoneContact={telephoneContact}
            saved={view.saved}
            note={view.note}
            organisationLink={view.organisationLink}
            onToggleSaved={() => void view.toggleSaved()}
            onSaveNote={(note) => view.saveNote(note)}
            onCopy={(value) => view.copyValue(value)}
            onViewTenders={scrollToTenders}
          />
        </div>
      </div>

      <div id="officer-related-tenders" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Related tenders
        </p>
        {data.tenders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No related tenders recorded.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.tenders.map((tender) => (
              <li
                key={tender.tenderId}
                className="rounded-lg border border-border bg-background/40 px-3 py-2.5"
              >
                <Link
                  to={`/tenders/${encodeURIComponent(tender.tenderId)}`}
                  className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                >
                  {tender.title ?? `Tender ${tender.tenderId}`}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    tender.referenceNumber,
                    tender.province,
                    tender.closingDate &&
                      `Closes ${formatDate(tender.closingDate)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No further details cached"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
}
