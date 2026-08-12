import { useState } from "react";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import { describeApiError } from "../../services/api/describe-error";
import {
  experienceTitle,
  personnelName,
  type CompanyEndpoint,
  type CompanyProfile,
  type CompanyProfileUpdate,
} from "../../services/api/endpoints/company";
import { CompanyProfileEditor } from "./CompanyProfileEditor";

export interface CompanyProfileScreenProps {
  endpoint: CompanyEndpoint;
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function CompanyProfileScreen({ endpoint }: CompanyProfileScreenProps) {
  const loadedProfile = useAsync(
    (signal) => endpoint.getProfile(signal),
    [endpoint],
  );
  const experiences = useAsync(
    (signal) => endpoint.getExperiences(signal),
    [endpoint],
  );
  const personnel = useAsync(
    (signal) => endpoint.getPersonnel(signal),
    [endpoint],
  );
  const cidb = useAsync((signal) => endpoint.getCidb(signal), [endpoint]);
  const [savedProfile, setSavedProfile] = useState<CompanyProfile>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [saveError, setSaveError] = useState<string>();

  const profile =
    savedProfile ??
    (loadedProfile.status === "ready" ? loadedProfile.value : undefined);

  async function save(update: CompanyProfileUpdate) {
    setSaving(true);
    setSaveError(undefined);
    try {
      const result = await endpoint.updateProfile(update);
      setSavedProfile(result.company);
      setEditing(false);
      setNotice(
        result.matchingTriggered
          ? `Profile saved. Tender matches are being refreshed. Completeness: ${result.profileCompleteness}%.`
          : `Profile saved. Completeness: ${result.profileCompleteness}%.`,
      );
    } catch (error) {
      setSaveError(describeApiError(error, "your company profile").message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="company-heading" className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Company readiness workspace
          </p>
          <h1
            id="company-heading"
            className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
          >
            Company Profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The verified company record used by Tender Radar and tender-response
            preparation.
          </p>
        </div>
        {profile && !editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setNotice(undefined);
              setSaveError(undefined);
            }}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Edit company profile
          </button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded border border-success/30 bg-success/10 p-3 text-sm text-success"
        >
          {notice}
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {saveError}
        </p>
      )}

      <div className="mt-6">
        <AsyncSection
          state={loadedProfile}
          subject="your company profile"
          onRetry={loadedProfile.reload}
          isEmpty={(value) => value === undefined}
          empty={<NoProfile />}
        >
          {(loaded) => {
            const company = savedProfile ?? loaded;
            if (!company) return null;
            if (editing) {
              return (
                <CompanyProfileEditor
                  company={company}
                  saving={saving}
                  onCancel={() => {
                    setEditing(false);
                    setSaveError(undefined);
                  }}
                  onSave={save}
                />
              );
            }
            return (
              <ProfileOverview
                company={company}
                experiences={experiences}
                personnel={personnel}
                cidb={cidb}
              />
            );
          }}
        </AsyncSection>
      </div>
    </section>
  );
}

function NoProfile() {
  return (
    <div className="rounded border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-card-foreground">
        No company profile yet
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A canonical company record must exist before the desktop can edit it.
        Complete account setup on Tenders-SA, then reload this screen.
      </p>
    </div>
  );
}

function ProfileOverview({
  company,
  experiences,
  personnel,
  cidb,
}: {
  company: CompanyProfile;
  experiences: ReturnType<
    typeof useAsync<Awaited<ReturnType<CompanyEndpoint["getExperiences"]>>>
  >;
  personnel: ReturnType<
    typeof useAsync<Awaited<ReturnType<CompanyEndpoint["getPersonnel"]>>>
  >;
  cidb: ReturnType<
    typeof useAsync<Awaited<ReturnType<CompanyEndpoint["getCidb"]>>>
  >;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <Panel title={company.name}>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Row label="Registration number">
              {company.registrationNumber ?? notRecorded()}
            </Row>
            <Row label="Tax number">{company.taxNumber ?? notRecorded()}</Row>
            <Row label="B-BBEE level">
              {company.bbbeeLevel ?? notRecorded()}
            </Row>
            <Row label="Company size">
              {company.companySize ?? notRecorded()}
            </Row>
            <Row label="Annual turnover">
              {company.annualTurnover == null
                ? notRecorded()
                : typeof company.annualTurnover === "number"
                  ? ZAR.format(company.annualTurnover)
                  : company.annualTurnover}
            </Row>
            <Row label="Operating provinces">
              {company.provincesOperating.length
                ? company.provincesOperating.join(", ")
                : notRecorded()}
            </Row>
          </dl>
          {company.capabilitiesDescription && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Capabilities
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {company.capabilitiesDescription}
              </p>
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Industries and certifications">
        <ListOrEmpty
          values={company.industryCodes}
          empty="No industries recorded."
        />
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Certifications
          </h3>
          <ListOrEmpty
            values={company.certifications}
            empty="No certifications recorded."
          />
        </div>
      </Panel>
      <Panel title="CIDB grading">
        <AsyncSection
          state={cidb}
          subject="your CIDB grading"
          onRetry={cidb.reload}
          isEmpty={(value) => value === undefined}
          empty={
            <p className="text-sm text-muted-foreground">
              No CIDB grading recorded.
            </p>
          }
        >
          {(value) => <KeyValues value={value ?? {}} />}
        </AsyncSection>
      </Panel>
      <Panel title="Project experience">
        <AsyncSection
          state={experiences}
          subject="your project experience"
          onRetry={experiences.reload}
          empty={
            <p className="text-sm text-muted-foreground">
              No past projects recorded.
            </p>
          }
        >
          {(records) => (
            <ul className="space-y-3">
              {records.map((record) => (
                <li key={record.id}>
                  <p className="text-sm font-medium text-card-foreground">
                    {experienceTitle(record)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.clientName ?? "Client not recorded"}
                    {typeof record.value === "number"
                      ? ` · ${ZAR.format(record.value)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </Panel>
      <Panel title="Key personnel">
        <AsyncSection
          state={personnel}
          subject="your personnel"
          onRetry={personnel.reload}
          empty={
            <p className="text-sm text-muted-foreground">
              No personnel recorded.
            </p>
          }
        >
          {(people) => (
            <ul className="space-y-3">
              {people.map((person) => (
                <li key={person.id}>
                  <p className="text-sm font-medium text-card-foreground">
                    {personnelName(person)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {person.role ?? "Role not recorded"}
                    {person.qualification ? ` · ${person.qualification}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </Panel>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}
function notRecorded() {
  return <span className="text-muted-foreground">Not recorded</span>;
}
function ListOrEmpty({ values, empty }: { values: string[]; empty: string }) {
  return values.length ? (
    <ul className="mt-2 flex flex-wrap gap-2">
      {values.map((value) => (
        <li
          key={value}
          className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground"
        >
          {value}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
  );
}
function KeyValues({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(
    ([, item]) => item != null && typeof item !== "object",
  );
  return entries.length ? (
    <dl className="space-y-2">
      {entries.map(([key, item]) => (
        <Row key={key} label={key.replace(/([A-Z])/g, " $1")}>
          {String(item)}
        </Row>
      ))}
    </dl>
  ) : (
    <p className="text-sm text-muted-foreground">No CIDB grading recorded.</p>
  );
}
