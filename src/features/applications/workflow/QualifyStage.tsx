import { Link } from "react-router-dom";
import { Panel } from "../../../components/common/AsyncSection";
import type {
  ApplicationDetail,
  ApplicationsEndpoint,
} from "../../../services/api/endpoints/applications";
import type { EligibilityEndpoint } from "../../../services/api/endpoints/eligibility";
import { EligibilityPanel } from "../../tenders/TenderActions";
import { describeJsonField } from "../../tenders/tender-fields";
import { ComplianceGapsPanel } from "../workspace/ComplianceGapsPanel";

export interface QualifyStageProps {
  application: ApplicationDetail;
  applicationId: string;
  applications: ApplicationsEndpoint;
  eligibility: EligibilityEndpoint;
}

/** Existing qualification evidence, arranged as a deliberate user decision. */
export function QualifyStage({
  application,
  applicationId,
  applications,
  eligibility,
}: QualifyStageProps) {
  const { tender, company } = application;

  return (
    <div className="space-y-4">
      <EligibilityPanel endpoint={eligibility} tenderId={tender.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tender criteria on record">
          <EvidenceList label="Requirements" value={tender.requirements} />
          <EvidenceList
            label="Eligibility criteria"
            value={tender.eligibilityCriteria}
          />
          <EvidenceList
            label="B-BBEE requirements"
            value={tender.bbbeeRequirements}
          />
          {!hasEvidence([
            tender.requirements,
            tender.eligibilityCriteria,
            tender.bbbeeRequirements,
          ]) && (
            <p className="text-sm text-muted-foreground">
              Tender criteria have not been fully extracted yet. This is not a
              confirmation that no criteria apply.
            </p>
          )}
        </Panel>

        <Panel title="Company evidence on record">
          {company ? (
            <dl className="space-y-2 text-sm">
              <EvidenceRow label="Company" value={company.name} />
              <EvidenceRow label="B-BBEE level" value={company.bbbeeLevel} />
              <EvidenceRow
                label="Industry codes"
                value={describeJsonField(company.industryCodes)?.join(", ")}
              />
              <EvidenceRow
                label="Operating provinces"
                value={describeJsonField(company.provincesOperating)?.join(
                  ", ",
                )}
              />
            </dl>
          ) : (
            <p className="text-sm text-warning">
              No company profile is attached. Unknown profile data cannot be
              treated as meeting a tender requirement.
            </p>
          )}
          <Link
            to="/company"
            className="mt-4 inline-flex rounded border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
          >
            Review or update company profile
          </Link>
        </Panel>
      </div>

      <ComplianceGapsPanel
        endpoint={applications}
        applicationId={applicationId}
      />
    </div>
  );
}

function EvidenceList({ label, value }: { label: string; value: unknown }) {
  const lines = describeJsonField(value);
  if (!lines) return null;
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <ul className="mt-1 space-y-1 text-sm text-foreground">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceRow({ label, value }: { label: string; value: unknown }) {
  const recorded = value !== null && value !== undefined && value !== "";
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={recorded ? "text-foreground" : "text-warning"}>
        {recorded ? String(value) : "Not recorded"}
      </dd>
    </div>
  );
}

function hasEvidence(values: unknown[]): boolean {
  return values.some((value) => describeJsonField(value) !== null);
}
