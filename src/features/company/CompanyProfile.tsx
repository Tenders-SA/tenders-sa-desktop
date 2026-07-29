import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import {
  experienceTitle,
  personnelName,
  type CompanyEndpoint,
} from "../../services/api/endpoints/company";

export interface CompanyProfileScreenProps {
  endpoint: CompanyEndpoint;
}

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

/**
 * Company Profile (brief §5).
 *
 * This is the data Tender Radar matches against, which is why it is worth
 * showing even though it cannot be edited here: when the radar is empty or a
 * match scores badly, this screen is the explanation.
 *
 * **Read-only, deliberately.** Brief §4.3 requires human approval for company
 * profile changes, and these fields are matching *inputs* — a half-validated
 * editor that wrote a malformed `industryCodes` JSON string would silently
 * degrade every future match. Editing stays on the web app until the
 * accessible-form foundation lands.
 */
export function CompanyProfileScreen({ endpoint }: CompanyProfileScreenProps) {
  const profile = useAsync((signal) => endpoint.getProfile(signal), [endpoint]);
  const experiences = useAsync(
    (signal) => endpoint.getExperiences(signal),
    [endpoint],
  );
  const personnel = useAsync(
    (signal) => endpoint.getPersonnel(signal),
    [endpoint],
  );

  return (
    <section aria-labelledby="company-heading" className="max-w-4xl">
      <h1
        id="company-heading"
        className="text-xl font-semibold text-foreground"
      >
        Company Profile
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tender Radar scores tenders against this profile.
      </p>

      <div className="mt-6">
        <AsyncSection
          state={profile}
          subject="your company profile"
          onRetry={profile.reload}
          // `undefined` is a real answer here: the parent 404s when no profile
          // exists, and that is what a new account looks like.
          isEmpty={(value) => value === undefined}
          empty={
            <div className="rounded border border-border bg-card p-6">
              <h2 className="text-sm font-medium text-card-foreground">
                No company profile yet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tender Radar cannot score tenders without one. Create your
                company profile on the Tenders-SA website and it will appear
                here.
              </p>
            </div>
          }
        >
          {(company) =>
            company ? (
              <div className="flex flex-col gap-4">
                <Panel title={company.name}>
                  <dl className="flex flex-col gap-2">
                    <Row label="Registration number">
                      {company.registrationNumber ?? notRecorded()}
                    </Row>
                    <Row label="Tax number">
                      {company.taxNumber ?? notRecorded()}
                    </Row>
                    <Row label="B-BBEE level">
                      {company.bbbeeLevel === null ||
                      company.bbbeeLevel === undefined
                        ? notRecorded()
                        : String(company.bbbeeLevel)}
                    </Row>
                    <Row label="Company size">
                      {company.companySize ?? notRecorded()}
                    </Row>
                    <Row label="Annual turnover">
                      {company.annualTurnover === null ||
                      company.annualTurnover === undefined
                        ? notRecorded()
                        : typeof company.annualTurnover === "number"
                          ? ZAR.format(company.annualTurnover)
                          : company.annualTurnover}
                    </Row>
                    <Row label="Industries">
                      {company.industryCodes.length > 0
                        ? company.industryCodes.join(", ")
                        : notRecorded()}
                    </Row>
                    <Row label="Operating provinces">
                      {company.provincesOperating.length > 0
                        ? company.provincesOperating.join(", ")
                        : notRecorded()}
                    </Row>
                    <Row label="Certifications">
                      {company.certifications.length > 0
                        ? company.certifications.join(", ")
                        : notRecorded()}
                    </Row>
                  </dl>

                  {company.capabilitiesDescription && (
                    <div className="mt-4">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Capabilities
                      </h3>
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {company.capabilitiesDescription}
                      </p>
                    </div>
                  )}
                </Panel>

                <Panel title="Project experience">
                  <AsyncSection
                    state={experiences}
                    subject="your project experience"
                    onRetry={experiences.reload}
                    empty={
                      <p className="text-sm text-muted-foreground">
                        No past projects recorded. Experience strengthens
                        matching on similar tenders.
                      </p>
                    }
                  >
                    {(records) => (
                      <ul className="flex flex-col gap-2">
                        {records.map((record) => (
                          <li key={record.id}>
                            <p className="text-sm text-card-foreground">
                              {experienceTitle(record)}
                            </p>
                            <p className="text-sm text-muted-foreground">
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

                <Panel title="Personnel">
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
                      <ul className="flex flex-col gap-2">
                        {people.map((person) => (
                          <li key={person.id}>
                            <p className="text-sm text-card-foreground">
                              {personnelName(person)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {person.role ?? "Role not recorded"}
                              {person.qualification
                                ? ` · ${person.qualification}`
                                : ""}
                              {typeof person.yearsExperience === "number"
                                ? ` · ${person.yearsExperience} years`
                                : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AsyncSection>
                </Panel>

                <p className="text-sm text-muted-foreground">
                  Profile changes are made on the Tenders-SA website. This build
                  shows the profile without editing it.
                </p>
              </div>
            ) : null
          }
        </AsyncSection>
      </div>
    </section>
  );
}

/** Absent data says so, rather than rendering a blank that reads as a bug. */
function notRecorded() {
  return <span className="text-muted-foreground">Not recorded</span>;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-48 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
