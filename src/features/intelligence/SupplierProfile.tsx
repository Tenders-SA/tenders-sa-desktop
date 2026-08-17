import type { ReactNode } from "react";
import { useAsync, type AsyncState } from "../../hooks/use-async";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import {
  formatAwardValue,
  type IntelligenceCompany,
} from "../../services/api/endpoints/supplier-intelligence";
import type {
  ForensicFlag,
  ForensicRowResult,
  IntelligenceSummary,
  ShowcaseEntry,
  SupplierContacts,
  SupplierEntityContext,
  SupplierIdentity,
  SupplierProfileEndpoint,
  SupplierPublicRecord,
} from "../../services/api/endpoints/supplier-profile";
import {
  CAPS,
  ENRICHMENT,
  EYEBROW,
  RISK_DISCLAIMER,
  TIER,
  VERDICT,
  VERDICT_DETAIL,
  flagHeading,
  severityLabel,
} from "./supplier-profile-copy";
import {
  advancedContextLocked,
  awardsPerYear,
  describeEvidence,
  summariseBuyers,
} from "./supplier-profile-model";
import {
  DateValue,
  Field,
  MoneyValue,
  NotRecorded,
  ProvenanceEyebrow,
  StatTile,
  Value,
} from "./supplier-profile-fields";

export interface SupplierProfileProps {
  endpoint: SupplierProfileEndpoint;
  /** From `suppliers/:slug`; the screen itself stays router-agnostic. */
  slug: string;
  onBack?: () => void;
}

/**
 * Supplier Profile — the partner-vetting record (brief §8.4).
 *
 * Spec: desktop-supplier-profile §design 5
 *
 * **This is evidence for a human to weigh, not a verdict.** Brief §8.4
 * forbids legal claims about a company and §10 forbids using award data to
 * imply wrongdoing, so nothing here declares a company sound or unsound. It
 * shows what the public record holds, says where each figure came from, and
 * says plainly when it does not know — the same stance
 * `SupplierIntelligence.tsx:21-26` takes about the leaderboard that leads
 * here.
 *
 * **Identity is the only blocking read.** It resolves the slug to a canonical
 * company name through the one contract that is public and not tier-capped;
 * everything after it loads independently, so a plan limit or an outage costs
 * one panel and never the screen (R-S5).
 *
 * No panel is omitted when its data is missing. A panel that vanished would
 * be indistinguishable from a question the product never asks, and the reader
 * would not know something had been looked for.
 */
export function SupplierProfile({
  endpoint,
  slug,
  onBack,
}: SupplierProfileProps) {
  const identity = useAsync(
    (signal) => endpoint.resolveSupplier(slug, signal),
    [endpoint, slug],
  );

  return (
    <section aria-labelledby="supplier-profile-heading" className="max-w-4xl">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Supplier Intelligence
        </button>
      )}

      <AsyncSection
        state={identity}
        subject="this supplier"
        onRetry={identity.reload}
      >
        {(resolved) => (
          <SupplierProfileBody endpoint={endpoint} identity={resolved} />
        )}
      </AsyncSection>
    </section>
  );
}

function SupplierProfileBody({
  endpoint,
  identity,
}: {
  endpoint: SupplierProfileEndpoint;
  identity: SupplierIdentity;
}) {
  const { name, slug, company } = identity;

  // Six independent loads rather than one composed request. The upstreams
  // have very different latencies — contract C is CDN-cached and instant,
  // contract D runs several aggregates — and a single settled composite would
  // hold the whole screen at the slowest of them while moving the
  // "which part failed" branching out of `AsyncSection`, which already
  // renders those four states correctly.
  const forensic = useAsync(
    (signal) => endpoint.getForensicRow(name, slug, signal),
    [endpoint, name, slug],
  );
  const record = useAsync(
    (signal) => endpoint.getPublicRecord(slug, name, signal),
    [endpoint, slug, name],
  );
  const context = useAsync(
    (signal) => endpoint.getEntityContext(name, signal),
    [endpoint, name],
  );
  const access = useAsync(
    (signal) => endpoint.getReportAccess(slug, signal),
    [endpoint, slug],
  );
  const contacts = useAsync(
    (signal) => endpoint.getContacts(slug, signal),
    [endpoint, slug],
  );
  const showcase = useAsync(
    (signal) => endpoint.getShowcaseEntry(slug, signal),
    [endpoint, slug],
  );

  return (
    <>
      <SupplierHero company={company} />

      <div className="mt-4 flex flex-col gap-4">
        <Panel title="Registration details">
          <ProvenanceEyebrow>{EYEBROW.registration}</ProvenanceEyebrow>
          <AsyncSection
            state={record}
            subject="registration details"
            onRetry={record.reload}
          >
            {(value) => <RegistrationPanel record={value} />}
          </AsyncSection>
        </Panel>

        <Panel title="Contact details">
          <ProvenanceEyebrow>{EYEBROW.contacts}</ProvenanceEyebrow>
          <AsyncSection
            state={contacts}
            subject="partner contact details"
            onRetry={contacts.reload}
          >
            {(value) => <ContactsPanel contacts={value} />}
          </AsyncSection>
        </Panel>

        <Panel title="Operating areas and categories">
          <ProvenanceEyebrow>{EYEBROW.operating}</ProvenanceEyebrow>
          <AsyncSection
            state={context}
            subject="operating areas"
            onRetry={context.reload}
          >
            {(value) => <OperatingPanel context={value} />}
          </AsyncSection>
          {/*
            Rendered outside the AsyncSection so a 403 on the richer contract
            still leaves the reader with the provinces the leaderboard row
            already carried. A plan limit should cost detail, not everything.
          */}
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Provinces on the award record:{" "}
            {company.provinces.length > 0
              ? company.provinces.join(", ")
              : "Not recorded"}
          </p>
        </Panel>

        <Panel title="Award history">
          <ProvenanceEyebrow>{EYEBROW.awards}</ProvenanceEyebrow>
          <AsyncSection
            state={record}
            subject="the award history"
            onRetry={record.reload}
          >
            {(value) => <AwardHistoryPanel record={value} company={company} />}
          </AsyncSection>
        </Panel>

        <Panel title="Known buyers and award frequency">
          <ProvenanceEyebrow>{EYEBROW.buyers}</ProvenanceEyebrow>
          <AsyncSection
            state={record}
            subject="the award history"
            onRetry={record.reload}
          >
            {(value) => <BuyersPanel record={value} company={company} />}
          </AsyncSection>
        </Panel>

        <Panel title="Risk, restriction and compliance signals">
          <ProvenanceEyebrow>{EYEBROW.risk}</ProvenanceEyebrow>
          {/*
            Two upstreams, two AsyncSections. Contract D is subscriber-only
            and contract B is not, so nesting them separately means a 403 on
            the restriction overlay does not take the published risk score
            down with it.
          */}
          <AsyncSection
            state={forensic}
            subject="risk signals"
            onRetry={forensic.reload}
          >
            {(value) => <RiskPanel forensic={value} record={record} />}
          </AsyncSection>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-xs font-medium text-card-foreground">
              Restricted supplier and market context
            </h3>
            <div className="mt-2">
              <AsyncSection
                state={context}
                subject="restricted-supplier and market context"
                onRetry={context.reload}
              >
                {(value) => <RestrictionPanel context={value} />}
              </AsyncSection>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {RISK_DISCLAIMER}
          </p>
        </Panel>

        <Panel title="Data confidence">
          <ProvenanceEyebrow>{EYEBROW.confidence}</ProvenanceEyebrow>
          <AsyncSection
            state={record}
            subject="the register match"
            onRetry={record.reload}
          >
            {(value) => <ConfidencePanel record={value} company={company} />}
          </AsyncSection>
          <div className="mt-3 border-t border-border pt-3">
            <AsyncSection
              state={access}
              subject="your access to this report"
              onRetry={access.reload}
            >
              {(value) =>
                /*
                  Only positives are rendered. The route answers 200 with every
                  flag false for an anonymous user, an unresolvable slug and an
                  internal error alike, so a false flag means "not
                  established", never "definitely not" (H9).
                */
                value.established ? (
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {value.isPro && (
                      <li>You have Pro access to this report.</li>
                    )}
                    {value.isPurchased && (
                      <li>You have purchased this report.</li>
                    )}
                    {value.isClaimed && (
                      <li>This profile has been claimed by its owner.</li>
                    )}
                    {value.pendingForCurrentUser && (
                      <li>Your claim on this profile is pending.</li>
                    )}
                  </ul>
                ) : null
              }
            </AsyncSection>
          </div>
        </Panel>

        {/*
          Contract H only. Absence from a 20-row featured list says nothing
          about a company, so no panel is rendered when there is no match —
          this is the one panel whose absence is itself honest (R-S15).
        */}
        <AsyncSection state={showcase} subject="the company showcase listing">
          {(entry) => (entry ? <ShowcasePanel entry={entry} /> : null)}
        </AsyncSection>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 0 — hero
 * ------------------------------------------------------------------ */

/**
 * Rendered from the resolved leaderboard row, so it needs no request of its
 * own and appears the moment the screen resolves. It sits outside
 * `AsyncSection` deliberately: if identity fails there is no supplier, and
 * the whole screen is correctly an error.
 */
function SupplierHero({ company }: { company: IntelligenceCompany }) {
  const enrichment = company.enrichment;

  return (
    <header className="mt-4 rounded-xl border border-border bg-card p-5">
      <ProvenanceEyebrow>{EYEBROW.hero}</ProvenanceEyebrow>
      <h1
        id="supplier-profile-heading"
        className="mt-1 text-xl font-semibold text-card-foreground"
      >
        {company.name}
      </h1>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Awards recorded">
          {company.totalAwards.toLocaleString("en-ZA")}
        </StatTile>
        <StatTile label="Total award value">
          {formatAwardValue(company)}
        </StatTile>
        <StatTile label="Leaderboard rank">
          {`#${company.rank.toLocaleString("en-ZA")}`}
        </StatTile>
        <StatTile label="Provinces">
          {company.provinces.length > 0 ? (
            company.provinces.join(", ")
          ) : (
            <NotRecorded />
          )}
        </StatTile>
        <StatTile label="Last active">
          {/* Never a guessed year — the same rule the list row applies. */}
          {company.lastActiveYear ?? <NotRecorded />}
        </StatTile>
        <StatTile label="Most recent buyer">
          {company.lastKnownBuyer ?? <NotRecorded />}
        </StatTile>
      </dl>

      {enrichment?.website && (
        <p className="mt-3 text-xs text-muted-foreground">
          {/*
            Text, not a link. Opening an external URL needs a Tauri
            `opener:`/`shell:` permission the capability deliberately withholds,
            and R-S16 forbids widening it.
          */}
          Website: {enrichment.website}
        </p>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 1 — registration details (contract C)
 * ------------------------------------------------------------------ */

function RegistrationPanel({ record }: { record: SupplierPublicRecord }) {
  if (!record.matched) {
    return <RegisterMismatch supplierName={record.supplierName} />;
  }

  const cipc = record.cipcData;
  return (
    <dl>
      <Field label="Registration number">
        {<Value of={cipc?.registrationNumber} />}
      </Field>
      <Field label="Register status">{<Value of={cipc?.status} />}</Field>
      <Field label="Company type">{<Value of={cipc?.companyType} />}</Field>
      <Field label="Registration date">
        {<DateValue iso={cipc?.registrationDate} />}
      </Field>
      <Field label="Compliance score">
        {<Value of={cipc?.complianceScore} />}
      </Field>
      <Field label="Physical address">
        {<Value of={cipc?.physicalAddress} />}
      </Field>
      <Field label="Directors on record">
        {<Value of={cipc?.directorCount} />}
      </Field>
    </dl>
  );
}

/**
 * The honest answer when contract C resolved the slug to another company
 * (H2). Showing nothing at all would read as "this company is not
 * registered"; showing the mismatched record would be worse still.
 */
function RegisterMismatch({ supplierName }: { supplierName: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-card-foreground">
        {VERDICT.requiresManualVerification}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {VERDICT_DETAIL.registerMismatch}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The register lookup resolved to “{supplierName}”.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 2 — contact details (contract G)
 * ------------------------------------------------------------------ */

function ContactsPanel({ contacts }: { contacts: SupplierContacts }) {
  if (!contacts.resolved) {
    // A 200 with an empty body means the slug did not resolve, not that the
    // company has no directors (H10).
    return (
      <p className="text-sm text-muted-foreground">
        Contact details are not recorded for this company.
      </p>
    );
  }

  return (
    <>
      <dl>
        <Field label="Contact email">
          {<Value of={contacts.contactEmail} />}
        </Field>
      </dl>
      {contacts.directors.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {contacts.directors.map((director, index) => (
            <li
              key={`${index}-${director.fullName}`}
              className="flex flex-wrap justify-between gap-x-4 text-sm text-card-foreground"
            >
              <span>{director.fullName}</span>
              <span className="text-muted-foreground">
                {<Value of={director.email} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 3 — operating areas (contract D)
 * ------------------------------------------------------------------ */

function OperatingPanel({ context }: { context: SupplierEntityContext }) {
  return (
    <dl>
      <Field label="Provinces">
        {context.provinces.length > 0 ? (
          context.provinces.join(", ")
        ) : (
          <NotRecorded />
        )}
      </Field>
      <Field label="Procurement categories">
        {context.categories.length > 0 ? (
          context.categories.join(", ")
        ) : (
          <NotRecorded />
        )}
      </Field>
      <Field label="Province procurement health">
        {advancedContextLocked(context.access.capabilities) ? (
          <span className="text-muted-foreground">
            {TIER.advancedContextLocked}
          </span>
        ) : context.provinceHealth.length > 0 ? (
          context.provinceHealth
            .map((province) => `${province.name}: ${province.status ?? "—"}`)
            .join(" · ")
        ) : (
          <NotRecorded />
        )}
      </Field>
    </dl>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 4 — award history (contract C)
 * ------------------------------------------------------------------ */

function AwardHistoryPanel({
  record,
  company,
}: {
  record: SupplierPublicRecord;
  company: IntelligenceCompany;
}) {
  if (!record.matched) {
    return <RegisterMismatch supplierName={record.supplierName} />;
  }

  if (record.awardTimeline.length === 0) {
    const verdict = describeEvidence({
      registerMatched: true,
      hasRegisterData: record.cipcData !== null,
      timelineLength: 0,
      totalAwards: company.totalAwards,
      confidenceScore: company.enrichment?.confidenceScore,
    });
    return (
      <div>
        <p className="text-sm font-medium text-card-foreground">
          {verdict.verdict}
        </p>
        {verdict.detail && (
          <p className="mt-1 text-sm text-muted-foreground">{verdict.detail}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {record.awardTimeline.map((row, index) => (
          <li
            // Award rows carry no id on this contract, and two rows can share
            // a date and amount, so the index is the only stable key here.
            key={`${index}-${row.awardDate ?? "undated"}`}
            className="border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
          >
            <p className="text-sm text-card-foreground">
              {<Value of={row.tenderTitle} />}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {<DateValue iso={row.awardDate} />} ·{" "}
              {<MoneyValue amount={row.amount} currency={company.currency} />} ·{" "}
              {<Value of={row.department} />}
            </p>
          </li>
        ))}
      </ul>
      {record.timelineAtCap && (
        <p className="mt-3 text-xs text-muted-foreground">{CAPS.timeline}</p>
      )}
      {/*
        There is no per-award tender id on this contract, so no row can link
        into the desktop's own tender detail. Said plainly rather than left as
        a silently missing affordance.
      */}
      <p className="mt-1 text-xs text-muted-foreground">
        The award record carries no tender reference, so these cannot be opened
        as tenders.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 5 — known buyers (derived)
 * ------------------------------------------------------------------ */

function BuyersPanel({
  record,
  company,
}: {
  record: SupplierPublicRecord;
  company: IntelligenceCompany;
}) {
  const { buyers, unattributed } = summariseBuyers(record.awardTimeline);
  const years = awardsPerYear(record.awardTimeline);

  if (buyers.length === 0 && years.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No buyer or frequency detail is recorded here.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-1">
        {buyers.map((buyer) => (
          <li
            key={buyer.buyer}
            className="flex flex-wrap justify-between gap-x-4 text-sm text-card-foreground"
          >
            <span>{buyer.buyer}</span>
            <span className="text-muted-foreground">
              {buyer.awards} {buyer.awards === 1 ? "award" : "awards"} ·{" "}
              {<MoneyValue amount={buyer.value} currency={company.currency} />}
            </span>
          </li>
        ))}
      </ul>
      {unattributed > 0 && (
        // Counted, never bucketed under an invented "Unknown" buyer — that
        // would attribute an award to a buyer the record does not name.
        <p className="mt-2 text-xs text-muted-foreground">
          {unattributed} {unattributed === 1 ? "award has" : "awards have"} no
          buyer recorded.
        </p>
      )}
      {years.length > 0 && (
        <p className="mt-3 text-sm text-card-foreground">
          {years.map((year) => `${year.year}: ${year.awards}`).join(" · ")}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Counted from the awards listed above, which are the most recent on
        record rather than the company’s full history.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 6 — risk and restriction (contracts B and D)
 * ------------------------------------------------------------------ */

function RiskPanel({
  forensic,
  record,
}: {
  forensic: ForensicRowResult;
  /**
   * The public record's *state*, not its value: this panel reads contract C
   * only as a fallback for flags, and must render its own contract's data
   * even while C is still loading or has failed.
   */
  record: AsyncState<SupplierPublicRecord>;
}) {
  const row = forensic.row;

  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        {/*
          Under preview the route returns at most 8 rows on page 1, so an
          absent row is as likely to be a plan limit as an absence of records
          — and only `meta.preview` can tell the two apart (H6).
        */}
        {forensic.preview ? TIER.previewRowMissing : TIER.notInWorkbench}
      </p>
    );
  }

  /*
    Flags come from the workbench row in preference to the public record: the
    workbench computes the same score but is not truncated, whereas the public
    route slices to 3 for any caller that does not assert `x-pro-access` (H3),
    which the desktop refuses to do. The public record's flags are the
    fallback, and its cap is disclosed when they are used.
  */
  const publicRecord =
    record.status === "ready" && record.value.matched ? record.value : null;
  const flags: ForensicFlag[] =
    row.forensicFlags.length > 0
      ? row.forensicFlags
      : (publicRecord?.forensicFlags ?? []);
  const usingPublicFlags = row.forensicFlags.length === 0 && flags.length > 0;

  return (
    <>
      <dl>
        <Field label="Published risk indicator score">
          {<Value of={row.forensicRiskScore} />}
        </Field>
        <Field label="Signals recorded">
          {<Value of={row.forensicFlagCount} />}
        </Field>
        <Field label="B-BBEE level">{<Value of={row.beeLevel} />}</Field>
        <Field label="Enterprise type">
          {<Value of={row.enterpriseType} />}
        </Field>
        <Field label="Restricted-supplier records">
          {row.ocpo ? (
            `${row.ocpo.activeCount} active · ${row.ocpo.historyCount} historic`
          ) : (
            <NotRecorded />
          )}
        </Field>
      </dl>

      {flags.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium text-card-foreground">
            {VERDICT.potentialInconsistency}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {VERDICT_DETAIL.flagsNeedVerification}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {flags.map((flag, index) => (
              <li key={`${index}-${flag.type}`}>
                <p className="text-sm text-card-foreground">
                  {flagHeading(flag.type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {severityLabel(flag.severity)}
                </p>
                {/* The source's own words, shown verbatim. */}
                <p className="text-xs text-muted-foreground">
                  {flag.description}
                </p>
              </li>
            ))}
          </ul>
          {usingPublicFlags && publicRecord?.flagsAtCap && (
            <p className="mt-2 text-xs text-muted-foreground">
              {CAPS.flags(publicRecord.flagCount, flags.length)}
            </p>
          )}
        </>
      )}

      <MarketContext
        intelligence={row.intelligence ?? null}
        locked={advancedContextLocked(forensic.access.capabilities)}
      />
    </>
  );
}

function MarketContext({
  intelligence,
  locked,
}: {
  intelligence: IntelligenceSummary | null;
  locked: boolean;
}) {
  if (locked) {
    // `null` here means "withheld by plan", which is a different claim from
    // "nothing was published" (H5).
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {TIER.advancedContextLocked}
      </p>
    );
  }
  if (!intelligence?.topHeadline) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No public reporting is recorded against this company.
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="text-sm text-card-foreground">{intelligence.topHeadline}</p>
      {intelligence.topSummary && (
        <p className="text-xs text-muted-foreground">
          {intelligence.topSummary}
        </p>
      )}
    </div>
  );
}

function RestrictionPanel({ context }: { context: SupplierEntityContext }) {
  const restriction = context.restriction;
  if (!restriction) {
    return (
      <p className="text-sm text-muted-foreground">
        No restricted-supplier record was returned.
      </p>
    );
  }

  return (
    <>
      {/*
        The parent authored this label to be legally cautious
        (`forensic-restricted-suppliers.ts:48-49`), so it is rendered exactly
        as sent. Rewriting it here would re-do wording that is already right
        and put the desktop in the business of making legal claims.
      */}
      <p className="text-sm text-card-foreground">{restriction.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {restriction.activeCount ?? 0} active · {restriction.historyCount ?? 0}{" "}
        historic · {restriction.overlapCount ?? 0} overlapping an award
      </p>
      {restriction.confidence === "possible" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Possible name match only — {VERDICT.requiresManualVerification}.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 7 — data confidence
 * ------------------------------------------------------------------ */

function ConfidencePanel({
  record,
  company,
}: {
  record: SupplierPublicRecord;
  company: IntelligenceCompany;
}) {
  const enrichment = company.enrichment;
  const verdict = describeEvidence({
    registerMatched: record.matched,
    hasRegisterData: record.cipcData !== null,
    timelineLength: record.awardTimeline.length,
    totalAwards: company.totalAwards,
    confidenceScore: enrichment?.confidenceScore,
  });

  return (
    <>
      <p className="text-sm font-medium text-card-foreground">
        {verdict.verdict}
      </p>
      {verdict.detail && (
        <p className="mt-1 text-sm text-muted-foreground">{verdict.detail}</p>
      )}

      {enrichment?.description && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            {enrichment.description}
          </p>
          {/*
            Identical wording to the list row (`SupplierIntelligence.tsx:209-215`)
            so one product does not describe the same derived field two ways.
          */}
          <p className="mt-1 text-xs text-muted-foreground">
            {ENRICHMENT.compiled}
            {typeof enrichment.confidenceScore === "number"
              ? ` · confidence ${Math.round(enrichment.confidenceScore * 100)}%`
              : ""}
            {enrichment.lastEnrichedAt ? (
              <>
                {` · ${ENRICHMENT.lastCompiled} `}
                {<DateValue iso={enrichment.lastEnrichedAt} />}
              </>
            ) : null}
            {ENRICHMENT.verify}
          </p>
        </div>
      )}

      {enrichment?.headquartersAddress && (
        <p className="mt-2 text-xs text-muted-foreground">
          Compiled head office: {enrichment.headquartersAddress}
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Panel 8 — showcase listing (contract H)
 * ------------------------------------------------------------------ */

function ShowcasePanel({ entry }: { entry: ShowcaseEntry }): ReactNode {
  return (
    <Panel title="Listed in the Tenders-SA company showcase">
      <ProvenanceEyebrow>{EYEBROW.showcase}</ProvenanceEyebrow>
      <dl>
        <Field label="Listed name">{entry.displayName}</Field>
        <Field label="Description">
          {<Value of={entry.shortDescription} />}
        </Field>
        <Field label="Industries">
          {entry.industriesServed?.length ? (
            entry.industriesServed.join(", ")
          ) : (
            <NotRecorded />
          )}
        </Field>
        <Field label="Provinces served">
          {entry.provincesServed?.length ? (
            entry.provincesServed.join(", ")
          ) : (
            <NotRecorded />
          )}
        </Field>
        <Field label="B-BBEE level">{<Value of={entry.bbbeeLevel} />}</Field>
        <Field label="Certifications">
          {entry.certifications?.length ? (
            entry.certifications.join(", ")
          ) : (
            <NotRecorded />
          )}
        </Field>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Submitted by the company to the public showcase directory, not derived
        from award records.
      </p>
    </Panel>
  );
}
