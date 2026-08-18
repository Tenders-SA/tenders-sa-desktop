/**
 * Company Profile.
 *
 * Refs: Slice 11 spec
 * `docs/specifications/desktop-company-profile-full-record/`.
 *
 * The screen reads the whole record in one call. It used to fire four loads —
 * three of them redundant with the extended route and one (`getCidb`) against
 * a route that has no `GET` handler at all, so the CIDB panel showed an error
 * on every visit. See the endpoint module's header for the contract detail.
 */

import { useState } from "react";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import { describeApiError } from "../../services/api/describe-error";
import {
  equipmentAssetList,
  experienceTitle,
  missingFieldList,
  numberOrUndefined,
  operationalCapacityFields,
  personnelCertificationList,
  personnelName,
  professionalBodyList,
  type CompanyEndpoint,
  type CompanyExperience,
  type CompanyPersonnel,
  type CompanyProfile,
  type CompanyProfileUpdate,
  type ExperienceWrite,
  type ExtendedCompanyRecord,
  type ExtendedProfileWrite,
  type PersonnelWrite,
} from "../../services/api/endpoints/company";
import { CompanyProfileEditor } from "./CompanyProfileEditor";
import { ExperienceEditor } from "./ExperienceEditor";
import { PersonnelEditor } from "./PersonnelEditor";
import { ExtendedProfileEditor } from "./ExtendedProfileEditor";
import {
  COMPANY_TYPE_LABELS,
  extendedWriteFrom,
  fingerprintExceptCidb,
} from "./extended-profile-model";
import { ConfirmDelete } from "./company-form-controls";

export interface CompanyProfileScreenProps {
  endpoint: CompanyEndpoint;
}

type Mode =
  | { kind: "view" }
  | { kind: "company" }
  | { kind: "profile" }
  | { kind: "experience"; id?: string }
  | { kind: "personnel"; id?: string };

type Pending = { kind: "experience" | "personnel"; id: string } | undefined;

export function CompanyProfileScreen({ endpoint }: CompanyProfileScreenProps) {
  const record = useAsync(
    (signal) => endpoint.getExtendedRecord(signal),
    [endpoint],
  );
  /**
   * Read only for the company's own `createdAt`/`updatedAt`: the extended
   * route does not serialise them, and this is the only route that does.
   */
  const timestamps = useAsync(
    (signal) => endpoint.getProfile(signal),
    [endpoint],
  );

  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [confirming, setConfirming] = useState<Pending>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [saveError, setSaveError] = useState<string>();

  /**
   * Every mutation re-reads the record rather than patching state locally.
   * `completenessScore` and `missingFields` are recomputed server-side from
   * the rows just changed, so a local patch would leave a stale completeness
   * figure sitting next to fresh data.
   */
  async function run(
    subject: string,
    /** May return the notice to show; otherwise `message` is used. */
    action: () => Promise<string | void>,
    message: string,
  ) {
    setSaving(true);
    setSaveError(undefined);
    try {
      const reported = await action();
      record.reload();
      timestamps.reload();
      setMode({ kind: "view" });
      setConfirming(undefined);
      setNotice(reported || message);
    } catch (error) {
      setSaveError(describeApiError(error, subject).message);
    } finally {
      setSaving(false);
    }
  }

  function saveCompany(update: CompanyProfileUpdate) {
    return run(
      "your company profile",
      async () => {
        const result = await endpoint.updateProfile(update);
        return result.matchingTriggered
          ? `Profile saved. Tender matches are being refreshed. Completeness: ${result.profileCompleteness}%.`
          : `Profile saved. Completeness: ${result.profileCompleteness}%.`;
      },
      "Profile saved.",
    );
  }

  function saveExtendedProfile(value: ExtendedProfileWrite) {
    const current =
      record.status === "ready" && record.value
        ? extendedWriteFrom(record.value.profile)
        : undefined;

    // A CIDB-only change goes through the single-field route, which cannot
    // disturb the rest of the profile even if this copy is stale (R-C12).
    const cidbOnly =
      current !== undefined &&
      fingerprintExceptCidb(current) === fingerprintExceptCidb(value) &&
      current.cidbGrading !== value.cidbGrading &&
      value.cidbGrading !== null;

    return run(
      "your company profile",
      async () => {
        if (cidbOnly) {
          await endpoint.setCidbGrading(value.cidbGrading as string);
        } else {
          await endpoint.saveExtendedProfile(value);
        }
      },
      cidbOnly ? "CIDB grading saved." : "Company profile detail saved.",
    );
  }

  function saveExperience(id: string | undefined, value: ExperienceWrite) {
    return run(
      "this project",
      async () => {
        if (id) await endpoint.updateExperience(id, value);
        else await endpoint.createExperience(value);
      },
      id ? "Project updated." : "Project added.",
    );
  }

  function savePersonnel(id: string | undefined, value: PersonnelWrite) {
    return run(
      "this team member",
      async () => {
        if (id) await endpoint.updatePersonnel(id, value);
        else await endpoint.createPersonnel(value);
      },
      id ? "Team member updated." : "Team member added.",
    );
  }

  function remove(kind: "experience" | "personnel", id: string) {
    return run(
      kind === "experience" ? "this project" : "this team member",
      async () => {
        if (kind === "experience") await endpoint.deleteExperience(id);
        else await endpoint.deletePersonnel(id);
      },
      kind === "experience" ? "Project removed." : "Team member removed.",
    );
  }

  const loaded = record.status === "ready" ? record.value : undefined;
  const canEdit = Boolean(loaded) && mode.kind === "view";

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
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setMode({ kind: "company" });
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
          state={record}
          subject="your company profile"
          onRetry={record.reload}
          isEmpty={(value) => value === undefined}
          empty={<NoCompany />}
        >
          {(value) => {
            if (!value) return null;
            if (mode.kind === "company") {
              return (
                <CompanyProfileEditor
                  company={value.company as CompanyProfile}
                  saving={saving}
                  onCancel={() => {
                    setMode({ kind: "view" });
                    setSaveError(undefined);
                  }}
                  onSave={saveCompany}
                />
              );
            }
            /**
             * Full width, like the company editor. It edits fields belonging
             * to four different panels, so rendering it inside one of them
             * both mis-signals its scope and squeezes a multi-section form
             * into a half-width column.
             */
            if (mode.kind === "profile") {
              return (
                <ExtendedProfileEditor
                  profile={value.profile}
                  saving={saving}
                  onCancel={() => {
                    setMode({ kind: "view" });
                    setSaveError(undefined);
                  }}
                  onSave={saveExtendedProfile}
                />
              );
            }
            return (
              <ProfileOverview
                record={value}
                timestamps={
                  timestamps.status === "ready" ? timestamps.value : undefined
                }
                mode={mode}
                saving={saving}
                confirming={confirming}
                onMode={(next) => {
                  setMode(next);
                  setNotice(undefined);
                  setSaveError(undefined);
                }}
                onConfirm={setConfirming}
                onSaveExperience={saveExperience}
                onSavePersonnel={savePersonnel}
                onRemove={remove}
              />
            );
          }}
        </AsyncSection>
      </div>
    </section>
  );
}

function NoCompany() {
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

interface OverviewProps {
  record: ExtendedCompanyRecord;
  timestamps: CompanyProfile | undefined;
  mode: Mode;
  saving: boolean;
  confirming: Pending;
  onMode: (mode: Mode) => void;
  onConfirm: (pending: Pending) => void;
  onSaveExperience: (
    id: string | undefined,
    value: ExperienceWrite,
  ) => Promise<void>;
  onSavePersonnel: (
    id: string | undefined,
    value: PersonnelWrite,
  ) => Promise<void>;
  onRemove: (kind: "experience" | "personnel", id: string) => Promise<void>;
}

function ProfileOverview({
  record,
  timestamps,
  mode,
  saving,
  confirming,
  onMode,
  onConfirm,
  onSaveExperience,
  onSavePersonnel,
  onRemove,
}: OverviewProps) {
  const { company, profile } = record;
  const view = mode.kind === "view";
  /**
   * The record routes answer 400 without a CompanyProfile row, so the add
   * affordances are gated on it rather than letting the parent reject.
   */
  const hasProfile = profile !== null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <CompletenessPanel record={record} />
      </div>

      {!hasProfile && mode.kind !== "profile" && (
        <div className="lg:col-span-2">
          <div className="rounded border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-card-foreground">
              Company profile detail not set up
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Company type, CIDB grading, capacity, equipment, project
              experience and key personnel all hang off this record. Set it up
              to record them.
            </p>
            <button
              type="button"
              onClick={() => onMode({ kind: "profile" })}
              className="mt-3 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Set up company profile
            </button>
          </div>
        </div>
      )}

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
            <Row label="B-BBEE certificate">
              {company.bbbeeCertificateUrl ? (
                <ExternalLink href={company.bbbeeCertificateUrl}>
                  View certificate
                </ExternalLink>
              ) : (
                notRecorded()
              )}
            </Row>
            <Row label="Company size">
              {company.companySize ?? notRecorded()}
            </Row>
            <Row label="Annual turnover">
              {money(company.annualTurnover, "ZAR")}
            </Row>
            <Row label="Operating provinces">
              {company.provincesOperating.length
                ? company.provincesOperating.join(", ")
                : notRecorded()}
            </Row>
            <Row label="Record created">{date(timestamps?.createdAt)}</Row>
            <Row label="Record updated">{date(timestamps?.updatedAt)}</Row>
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

      {/*
        All four panels below are written by one route, so they share one
        editor and each carries its own way in. Leaving the affordance on a
        single panel made the other three read as read-only.
      */}
      <Panel
        title="Company profile"
        aside={
          <EditDetail view={view} hasProfile={hasProfile} onMode={onMode} />
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Company type">
            {profile?.companyType
              ? (COMPANY_TYPE_LABELS[profile.companyType] ??
                profile.companyType)
              : notRecorded()}
          </Row>
          <Row label="CIDB grading">
            {profile?.cidbGrading ?? notRecorded()}
          </Row>
          <Row label="Profile document">
            {profile?.profileDocument ? (
              <ExternalLink href={profile.profileDocument}>
                Open document
              </ExternalLink>
            ) : (
              notRecorded()
            )}
          </Row>
          <Row label="Detail last updated">{date(profile?.updatedAt)}</Row>
          {profile?.profileText && (
            <div className="sm:col-span-2 border-t border-border pt-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Company profile text
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {profile.profileText}
              </dd>
            </div>
          )}
        </dl>
      </Panel>

      <Panel
        title="Operational capacity"
        aside={
          <EditDetail view={view} hasProfile={hasProfile} onMode={onMode} />
        }
      >
        <OperationalCapacityView value={profile?.operationalCapacity} />
      </Panel>

      <Panel
        title="Equipment and assets"
        aside={
          <EditDetail view={view} hasProfile={hasProfile} onMode={onMode} />
        }
      >
        <EquipmentView value={profile?.equipmentAssets} />
      </Panel>

      <Panel
        title="Professional bodies"
        aside={
          <EditDetail view={view} hasProfile={hasProfile} onMode={onMode} />
        }
      >
        <ProfessionalBodiesView value={profile?.professionalBodies} />
      </Panel>

      <div className="lg:col-span-2">
        <Panel
          title="Project experience"
          aside={
            view &&
            hasProfile && (
              <button
                type="button"
                onClick={() => onMode({ kind: "experience" })}
                className="text-xs font-medium text-primary"
              >
                Add project
              </button>
            )
          }
        >
          {mode.kind === "experience" && mode.id === undefined && (
            <div className="mb-4">
              <ExperienceEditor
                saving={saving}
                onCancel={() => onMode({ kind: "view" })}
                onSave={(value) => onSaveExperience(undefined, value)}
              />
            </div>
          )}
          {record.experiences.length === 0 && mode.kind !== "experience" && (
            <p className="text-sm text-muted-foreground">
              No past projects recorded.
            </p>
          )}
          <ul className="space-y-4">
            {record.experiences.map((item) =>
              mode.kind === "experience" && mode.id === item.id ? (
                <li key={item.id}>
                  <ExperienceEditor
                    record={item}
                    saving={saving}
                    onCancel={() => onMode({ kind: "view" })}
                    onSave={(value) => onSaveExperience(item.id, value)}
                  />
                </li>
              ) : (
                <li
                  key={item.id}
                  className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                >
                  <ExperienceRow
                    record={item}
                    view={view}
                    saving={saving}
                    confirming={
                      confirming?.kind === "experience" &&
                      confirming.id === item.id
                    }
                    onEdit={() => onMode({ kind: "experience", id: item.id })}
                    onAskRemove={() =>
                      onConfirm({ kind: "experience", id: item.id })
                    }
                    onCancelRemove={() => onConfirm(undefined)}
                    onRemove={() => onRemove("experience", item.id)}
                  />
                </li>
              ),
            )}
          </ul>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        <Panel
          title="Key personnel"
          aside={
            view &&
            hasProfile && (
              <button
                type="button"
                onClick={() => onMode({ kind: "personnel" })}
                className="text-xs font-medium text-primary"
              >
                Add team member
              </button>
            )
          }
        >
          {mode.kind === "personnel" && mode.id === undefined && (
            <div className="mb-4">
              <PersonnelEditor
                saving={saving}
                onCancel={() => onMode({ kind: "view" })}
                onSave={(value) => onSavePersonnel(undefined, value)}
              />
            </div>
          )}
          {record.keyPersonnel.length === 0 && mode.kind !== "personnel" && (
            <p className="text-sm text-muted-foreground">
              No personnel recorded.
            </p>
          )}
          <ul className="space-y-4">
            {record.keyPersonnel.map((person) =>
              mode.kind === "personnel" && mode.id === person.id ? (
                <li key={person.id}>
                  <PersonnelEditor
                    record={person}
                    saving={saving}
                    onCancel={() => onMode({ kind: "view" })}
                    onSave={(value) => onSavePersonnel(person.id, value)}
                  />
                </li>
              ) : (
                <li
                  key={person.id}
                  className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                >
                  <PersonnelRow
                    record={person}
                    view={view}
                    saving={saving}
                    confirming={
                      confirming?.kind === "personnel" &&
                      confirming.id === person.id
                    }
                    onEdit={() => onMode({ kind: "personnel", id: person.id })}
                    onAskRemove={() =>
                      onConfirm({ kind: "personnel", id: person.id })
                    }
                    onCancelRemove={() => onConfirm(undefined)}
                    onRemove={() => onRemove("personnel", person.id)}
                  />
                </li>
              ),
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/**
 * The way into the extended-profile editor.
 *
 * Repeated on every panel that editor writes, so no panel looks read-only
 * merely because the control lives on a neighbour.
 */
function EditDetail({
  view,
  hasProfile,
  onMode,
}: {
  view: boolean;
  hasProfile: boolean;
  onMode: (mode: Mode) => void;
}) {
  if (!view) return null;
  return (
    <button
      type="button"
      onClick={() => onMode({ kind: "profile" })}
      className="text-xs font-medium text-primary"
    >
      {hasProfile ? "Edit" : "Set up"}
    </button>
  );
}

function CompletenessPanel({ record }: { record: ExtendedCompanyRecord }) {
  const score =
    record.completeness?.score ??
    numberOrUndefined(record.profile?.completenessScore);
  const missing =
    record.completeness?.missingFields ??
    missingFieldList(record.profile?.missingFields);

  return (
    <Panel
      title="Profile completeness"
      aside={
        score == null ? undefined : (
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {score}%
          </span>
        )
      }
    >
      {score == null && (
        <p className="text-sm text-muted-foreground">
          Completeness has not been assessed yet.
        </p>
      )}
      {missing.length === 0 ? (
        score == null ? null : (
          <p className="text-sm text-muted-foreground">
            Every tracked field is recorded.
          </p>
        )
      ) : (
        <>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Still missing
          </h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            {missing.map((item) => (
              <li key={item} className="text-sm text-foreground">
                <span aria-hidden="true" className="mr-2 text-muted-foreground">
                  ☐
                </span>
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function ExperienceRow({
  record,
  view,
  saving,
  confirming,
  onEdit,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  record: CompanyExperience;
  view: boolean;
  saving: boolean;
  confirming: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-card-foreground">
          {experienceTitle(record)}
        </p>
        {view &&
          (confirming ? (
            <ConfirmDelete
              label="Remove this project?"
              busy={saving}
              onConfirm={onRemove}
              onCancel={onCancelRemove}
            />
          ) : (
            <span className="flex gap-3">
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-medium text-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onAskRemove}
                className="text-xs font-medium text-muted-foreground"
              >
                Remove
              </button>
            </span>
          ))}
      </div>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Row label="Client">{record.clientName ?? notRecorded()}</Row>
        <Row label="Client type">{record.clientType ?? notRecorded()}</Row>
        <Row label="Contract value">
          {money(record.contractValue, record.currency ?? "ZAR")}
        </Row>
        <Row label="Start date">{date(record.startDate)}</Row>
        <Row label="Completion date">{date(record.completionDate)}</Row>
        <Row label="Reference contact">
          {record.referenceContact ?? notRecorded()}
        </Row>
        <Row label="Reference email">
          {record.referenceEmail ?? notRecorded()}
        </Row>
        <Row label="Completion certificate">
          {record.completionCertUrl ? (
            <ExternalLink href={record.completionCertUrl}>
              View completion certificate
            </ExternalLink>
          ) : (
            notRecorded()
          )}
        </Row>
        <Row label="Reference letter">
          {record.referenceLetterUrl ? (
            <ExternalLink href={record.referenceLetterUrl}>
              View letter
            </ExternalLink>
          ) : (
            notRecorded()
          )}
        </Row>
      </dl>
      {record.description && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {record.description}
        </p>
      )}
      {(record.categoryRelevance.length > 0 ||
        record.provinceRelevance.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
              Relevant categories
            </h4>
            <ListOrEmpty
              values={record.categoryRelevance}
              empty="None recorded."
            />
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
              Relevant provinces
            </h4>
            <ListOrEmpty
              values={record.provinceRelevance}
              empty="None recorded."
            />
          </div>
        </div>
      )}
    </>
  );
}

function PersonnelRow({
  record,
  view,
  saving,
  confirming,
  onEdit,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  record: CompanyPersonnel;
  view: boolean;
  saving: boolean;
  confirming: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
}) {
  const certifications = personnelCertificationList(record.certifications);
  const years = numberOrUndefined(record.yearsExperience);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-card-foreground">
          {personnelName(record)}
        </p>
        {view &&
          (confirming ? (
            <ConfirmDelete
              label="Remove this team member?"
              busy={saving}
              onConfirm={onRemove}
              onCancel={onCancelRemove}
            />
          ) : (
            <span className="flex gap-3">
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-medium text-primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onAskRemove}
                className="text-xs font-medium text-muted-foreground"
              >
                Remove
              </button>
            </span>
          ))}
      </div>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Row label="Role">{record.role ?? notRecorded()}</Row>
        <Row label="Department">{record.department ?? notRecorded()}</Row>
        <Row label="Years of experience">
          {years == null ? notRecorded() : `${years}`}
        </Row>
        <Row label="Email">{record.email ?? notRecorded()}</Row>
        <Row label="Phone">{record.phone ?? notRecorded()}</Row>
        <Row label="CV">
          {record.cvUrl ? (
            <ExternalLink href={record.cvUrl}>Open CV</ExternalLink>
          ) : (
            notRecorded()
          )}
        </Row>
      </dl>
      {record.qualifications && (
        <div className="mt-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
            Qualifications
          </h4>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {record.qualifications}
          </p>
        </div>
      )}
      {(certifications.matched.length > 0 ||
        certifications.unmatched.length > 0) && (
        <div className="mt-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
            Certifications
          </h4>
          <ul className="mt-1 space-y-1">
            {certifications.matched.map((item, index) => (
              <li key={index} className="text-sm text-foreground">
                {item.name}
                {item.issuer ? ` · ${item.issuer}` : ""}
                {item.expiryDate ? ` · expires ${date(item.expiryDate)}` : ""}
              </li>
            ))}
          </ul>
          <UnknownEntries values={certifications.unmatched} />
        </div>
      )}
    </>
  );
}

function OperationalCapacityView({ value }: { value: unknown }) {
  const capacity = operationalCapacityFields(value);
  if (!capacity) {
    if (value == null) {
      return (
        <p className="text-sm text-muted-foreground">
          No operational capacity recorded.
        </p>
      );
    }
    return <UnknownEntries values={[value]} />;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Row label="Staff">{capacity.staffCount ?? notRecorded()}</Row>
      <Row label="Vehicles">{capacity.vehicleCount ?? notRecorded()}</Row>
      <Row label="Premises">
        {capacity.premisesOwned == null
          ? notRecorded()
          : capacity.premisesOwned
            ? "Owned"
            : "Leased"}
      </Row>
      <Row label="Premises size">{capacity.premisesSize ?? notRecorded()}</Row>
    </dl>
  );
}

function EquipmentView({ value }: { value: unknown }) {
  const { matched, unmatched } = equipmentAssetList(value);
  if (!matched.length && !unmatched.length) {
    return (
      <p className="text-sm text-muted-foreground">No equipment recorded.</p>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {matched.map((item, index) => (
          <li key={index} className="text-sm text-foreground">
            <span className="font-medium">{item.name}</span>
            {item.quantity == null ? "" : ` · ${item.quantity} units`}
            {item.value == null ? "" : ` · ${money(item.value, "ZAR")}`}
          </li>
        ))}
      </ul>
      <UnknownEntries values={unmatched} />
    </>
  );
}

function ProfessionalBodiesView({ value }: { value: unknown }) {
  const { matched, unmatched } = professionalBodyList(value);
  if (!matched.length && !unmatched.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No professional registrations recorded.
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {matched.map((item, index) => (
          <li key={index} className="text-sm text-foreground">
            <span className="font-medium">{item.name}</span>
            {item.membershipNumber ? ` · ${item.membershipNumber}` : ""}
            {item.expiryDate ? ` · expires ${date(item.expiryDate)}` : ""}
          </li>
        ))}
      </ul>
      <UnknownEntries values={unmatched} />
    </>
  );
}

/**
 * Renders a `Json?` value the documented shape did not describe.
 *
 * These columns are untyped in the database, so a row written by another path
 * can hold anything. Hiding it would be a quiet data loss on a screen whose
 * whole purpose is to show the entire record, so it is shown as plain text.
 */
function UnknownEntries({ values }: { values: unknown[] }) {
  if (!values.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {values.map((value, index) => (
        <li key={index} className="text-sm text-muted-foreground">
          {typeof value === "object" && value !== null
            ? Object.entries(value as Record<string, unknown>)
                .filter(([, item]) => item != null && typeof item !== "object")
                .map(([key, item]) => `${humanise(key)}: ${String(item)}`)
                .join(" · ") || JSON.stringify(value)
            : String(value)}
        </li>
      ))}
    </ul>
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

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline"
    >
      {children}
    </a>
  );
}

function notRecorded() {
  return <span className="text-muted-foreground">Not recorded</span>;
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/** Formats with the record's own currency — it is a free string on the parent. */
function money(
  value: number | string | null | undefined,
  currency: string,
): React.ReactNode {
  const amount = numberOrUndefined(value);
  if (amount == null) return notRecorded();
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // An unrecognised currency code must not blank the amount.
    return `${currency} ${amount.toLocaleString("en-ZA")}`;
  }
}

function date(value: string | null | undefined): React.ReactNode {
  if (!value) return notRecorded();
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
