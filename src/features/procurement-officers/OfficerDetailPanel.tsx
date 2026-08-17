/**
 * Officer detail panel (TASK-1.7, design.md §UI, R-P10).
 *
 * Headline current assignment (never a stale one), organisation name +
 * physical address, official contact points, related tenders, actions
 * toolbar. Data comes from the local index first and refreshes from the
 * server; masked server values carry an explicit marker.
 */

import { Link } from "react-router-dom";
import { OfficerActions } from "./OfficerActions";
import { QualityLabel } from "./QualityLabel";
import type { OfficerDetailView } from "./use-officer-detail";

export interface OfficerDetailPanelProps {
  view: OfficerDetailView;
  onClose: () => void;
}

export function OfficerDetailPanel({ view, onClose }: OfficerDetailPanelProps) {
  const data = view.data;

  if (!data) {
    return (
      <section aria-label="Officer details" className="rounded-md border p-6 text-center text-sm text-foreground/60">
        {view.phase === "loading-local" ? "Loading officer details…" : "Officer not found locally."}
        <button type="button" onClick={onClose} className="mt-3 rounded-md border px-3 py-1.5 text-sm">
          Back to results
        </button>
      </section>
    );
  }

  const emailContact = data.contactPoints.find((c) => c.type === "email") ?? null;
  const telephoneContact =
    data.contactPoints.find((c) => c.type === "telephone" || c.type === "mobile") ?? null;

  const scrollToTenders = () => {
    document.getElementById("officer-related-tenders")?.scrollIntoView({ block: "start" });
  };

  const headline = data.headlineAssignment;

  return (
    <section aria-label={`Details for ${data.canonicalName}`} className="rounded-md border">
      <header className="flex items-start justify-between gap-4 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">{data.canonicalName}</h2>
          <p className="text-sm text-foreground/60">
            {[data.currentTitle, data.province].filter(Boolean).join(" · ") || "Details pending"}
          </p>
          {view.phase === "error" && (
            <p className="mt-1 text-sm text-amber-700" role="alert">
              Server refresh failed — showing the local record.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <QualityLabel status={data.status} lastSeenAt={data.lastSeenAt} />
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-1 text-sm">
            Back
          </button>
        </div>
      </header>

      {headline && (
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
            Current assignment
          </p>
          <p className="mt-1 font-medium">
            {headline.title ?? "Procurement role"}
            {headline.isCurrent && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Current
              </span>
            )}
          </p>
          {headline.organisationName && (
            <p className="text-sm text-foreground/70">{headline.organisationName}</p>
          )}
          {headline.validFrom && (
            <p className="mt-1 text-xs text-foreground/50">
              Since {formatDate(headline.validFrom)}
              {headline.validTo ? ` — until ${formatDate(headline.validTo)}` : ""}
            </p>
          )}
        </div>
      )}

      {(data.organisationName || data.organisationAddress) && (
        <div className="border-b p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
            Organisation
          </p>
          <p className="mt-1 text-sm font-medium">{data.organisationName}</p>
          {data.organisationAddress && (
            <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/70">
              {data.organisationAddress}
            </p>
          )}
        </div>
      )}

      <div className="border-b p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
          Official contacts
        </p>
        {data.contactPoints.length === 0 ? (
          <p className="mt-1 text-sm text-foreground/60">No official contacts recorded.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {data.contactPoints.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="capitalize text-foreground/70">{contact.type}:</span>{" "}
                  {contact.value}
                  {contact.masked && (
                    <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      masked — sync to reveal
                    </span>
                  )}
                </span>
                {contact.type === "email" ? (
                  <a
                    href={`mailto:${contact.value}`}
                    className="shrink-0 rounded-md border px-2 py-1 text-xs"
                  >
                    Email
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void view.copyValue(contact.value)}
                    className="shrink-0 rounded-md border px-2 py-1 text-xs"
                  >
                    Copy
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-b p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
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

      <div id="officer-related-tenders" className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
          Related tenders
        </p>
        {data.tenders.length === 0 ? (
          <p className="mt-1 text-sm text-foreground/60">No related tenders recorded.</p>
        ) : (
          <ul className="mt-1 divide-y">
            {data.tenders.map((tender) => (
              <li key={tender.tenderId} className="py-2">
                <Link to={`/tenders/${encodeURIComponent(tender.tenderId)}`} className="text-sm font-medium hover:underline">
                  {tender.title ?? `Tender ${tender.tenderId}`}
                </Link>
                <p className="text-xs text-foreground/60">
                  {[tender.referenceNumber, tender.province, tender.closingDate && `Closes ${formatDate(tender.closingDate)}`]
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