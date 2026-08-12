import { useState, type FormEvent } from "react";
import type {
  CompanyProfile,
  CompanyProfileUpdate,
} from "../../services/api/endpoints/company";
import { PROVINCES } from "../tenders/tender-filter-options";
import {
  certificationsForIndustry,
  INDUSTRY_CERTIFICATION_GROUPS,
  inferIndustry,
} from "./company-certification-options";

interface CompanyProfileEditorProps {
  company: CompanyProfile;
  saving: boolean;
  onCancel: () => void;
  onSave: (update: CompanyProfileUpdate) => Promise<void>;
}

type Section = "identity" | "market" | "capability";

export function CompanyProfileEditor({
  company,
  saving,
  onCancel,
  onSave,
}: CompanyProfileEditorProps) {
  const [section, setSection] = useState<Section>("identity");
  const [draft, setDraft] = useState(() => profileDraft(company));
  const [primaryIndustry, setPrimaryIndustry] = useState(() =>
    inferIndustry(company.industryCodes),
  );
  const [validation, setValidation] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setSection("identity");
      setValidation("Company name is required.");
      return;
    }
    setValidation(undefined);
    await onSave({
      name: draft.name.trim(),
      registrationNumber: optional(draft.registrationNumber),
      taxNumber: optional(draft.taxNumber),
      bbbeeLevel: optionalNumber(draft.bbbeeLevel),
      bbbeeCertificateUrl: optional(draft.bbbeeCertificateUrl),
      industryCodes: lines(draft.industryCodes),
      provincesOperating: draft.provincesOperating,
      companySize: optional(draft.companySize),
      annualTurnover: optionalNumber(draft.annualTurnover),
      certifications: draft.certifications,
      capabilitiesDescription: optional(draft.capabilitiesDescription),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[13rem_1fr]">
      <nav
        aria-label="Profile editor sections"
        className="flex gap-2 lg:flex-col"
      >
        {(
          [
            ["identity", "Company details"],
            ["market", "Market footprint"],
            ["capability", "Bid capability"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSection(value)}
            className={`rounded px-3 py-2 text-left text-sm font-medium ${
              section === value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="rounded-lg border border-border bg-card p-5">
        {section === "identity" && (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-base font-semibold text-card-foreground">
              Company details
            </legend>
            <Field label="Company name" required>
              <input
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                className={control}
              />
            </Field>
            <Field label="Registration number">
              <input
                value={draft.registrationNumber}
                onChange={(event) =>
                  setDraft({ ...draft, registrationNumber: event.target.value })
                }
                className={control}
              />
            </Field>
            <Field label="Tax number">
              <input
                value={draft.taxNumber}
                onChange={(event) =>
                  setDraft({ ...draft, taxNumber: event.target.value })
                }
                className={control}
              />
            </Field>
            <Field label="Company size">
              <select
                value={draft.companySize}
                onChange={(event) =>
                  setDraft({ ...draft, companySize: event.target.value })
                }
                className={control}
              >
                <option value="">Not recorded</option>
                <option value="Micro">Micro</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </Field>
            <Field label="B-BBEE level">
              <select
                value={draft.bbbeeLevel}
                onChange={(event) =>
                  setDraft({ ...draft, bbbeeLevel: event.target.value })
                }
                className={control}
              >
                <option value="">Not recorded</option>
                {Array.from({ length: 8 }, (_, index) => index + 1).map(
                  (level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Annual turnover (ZAR)">
              <input
                type="number"
                min="0"
                step="1"
                value={draft.annualTurnover}
                onChange={(event) =>
                  setDraft({ ...draft, annualTurnover: event.target.value })
                }
                className={control}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="B-BBEE certificate URL">
                <input
                  type="url"
                  value={draft.bbbeeCertificateUrl}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      bbbeeCertificateUrl: event.target.value,
                    })
                  }
                  className={control}
                />
              </Field>
            </div>
          </fieldset>
        )}

        {section === "market" && (
          <fieldset>
            <legend className="text-base font-semibold text-card-foreground">
              Market footprint
            </legend>
            <p className="mt-1 text-sm text-muted-foreground">
              These inputs directly influence which opportunities Tender Radar
              prioritises.
            </p>
            <div className="mt-5">
              <Field
                label="Primary industry"
                hint="This controls the certification guidance shown under Bid capability."
              >
                <select
                  value={primaryIndustry}
                  onChange={(event) => {
                    const industry = event.target.value;
                    setPrimaryIndustry(industry);
                    setDraft({
                      ...draft,
                      industryCodes: withPrimaryIndustry(
                        draft.industryCodes,
                        industry,
                      ),
                    });
                  }}
                  className={control}
                >
                  <option value="">Select an industry</option>
                  {INDUSTRY_CERTIFICATION_GROUPS.map((industry) => (
                    <option key={industry.id} value={industry.id}>
                      {industry.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-5">
              <Field
                label="Industry codes and sectors"
                hint="One entry per line"
              >
                <textarea
                  rows={7}
                  value={draft.industryCodes}
                  onChange={(event) =>
                    setDraft({ ...draft, industryCodes: event.target.value })
                  }
                  className={control}
                />
              </Field>
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-card-foreground">
                Operating provinces
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {PROVINCES.map((province) => (
                  <label
                    key={province}
                    className="flex items-center gap-2 rounded border border-border p-2 text-sm text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={draft.provincesOperating.includes(province)}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          provincesOperating: toggle(
                            draft.provincesOperating,
                            province,
                          ),
                        })
                      }
                    />
                    {province}
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>
        )}

        {section === "capability" && (
          <fieldset className="flex flex-col gap-5">
            <legend className="text-base font-semibold text-card-foreground">
              Bid capability
            </legend>
            <Field
              label="Capabilities description"
              hint={`${draft.capabilitiesDescription.length} / 2000 characters`}
            >
              <textarea
                rows={10}
                maxLength={2000}
                value={draft.capabilitiesDescription}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    capabilitiesDescription: event.target.value,
                  })
                }
                className={control}
              />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-card-foreground">
                Certifications and registrations
              </legend>
              <p className="mt-1 text-xs text-muted-foreground">
                {primaryIndustry
                  ? "Select only evidence your company currently holds. Required means commonly mandatory for this field, not for every tender."
                  : "Select a primary industry under Market footprint to see relevant guidance."}
              </p>
              {primaryIndustry && (
                <div className="mt-3 grid gap-2">
                  {certificationsForIndustry(primaryIndustry).map((cert) => (
                    <label
                      key={cert.id}
                      className={`flex items-start gap-3 rounded border p-3 text-sm ${
                        draft.certifications.includes(cert.id)
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={draft.certifications.includes(cert.id)}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            certifications: toggle(
                              draft.certifications,
                              cert.id,
                            ),
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-card-foreground">
                          {cert.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {cert.issuingBody}
                        </span>
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {cert.required ? "Commonly required" : "Recommended"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <CustomCertifications
                values={draft.certifications}
                known={
                  new Set(
                    INDUSTRY_CERTIFICATION_GROUPS.flatMap((industry) =>
                      industry.certifications.map((cert) => cert.id),
                    ).concat(["csd", "bbbee", "tax-clearance"]),
                  )
                }
                onChange={(certifications) =>
                  setDraft({ ...draft, certifications })
                }
              />
            </fieldset>
          </fieldset>
        )}

        {validation && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {validation}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving profile…" : "Save company profile"}
          </button>
        </div>
      </div>
    </form>
  );
}

const control =
  "mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-card-foreground">
      {label}
      {required ? " *" : ""}
      {children}
      {hint && (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

function profileDraft(company: CompanyProfile) {
  return {
    name: company.name,
    registrationNumber: company.registrationNumber ?? "",
    taxNumber: company.taxNumber ?? "",
    bbbeeLevel: company.bbbeeLevel?.toString() ?? "",
    bbbeeCertificateUrl: company.bbbeeCertificateUrl ?? "",
    industryCodes: company.industryCodes.join("\n"),
    provincesOperating: [...company.provincesOperating],
    companySize: company.companySize ?? "",
    annualTurnover: company.annualTurnover?.toString() ?? "",
    certifications: [...company.certifications],
    capabilitiesDescription: company.capabilitiesDescription ?? "",
  };
}

function optional(value: string): string | null {
  return value.trim() || null;
}
function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null;
}
function lines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function withPrimaryIndustry(value: string, industry: string): string {
  const values = lines(value);
  const remaining = INDUSTRY_CERTIFICATION_GROUPS.some(
    (item) => item.id === values[0],
  )
    ? values.slice(1)
    : values;
  return industry ? [industry, ...remaining].join("\n") : remaining.join("\n");
}

function CustomCertifications({
  values,
  known,
  onChange,
}: {
  values: string[];
  known: Set<string>;
  onChange: (values: string[]) => void;
}) {
  const custom = values.filter((value) => !known.has(value));
  return (
    <div className="mt-4">
      <Field
        label="Other certifications already held"
        hint="One per line. Existing values are preserved even when they are outside the catalogue."
      >
        <textarea
          rows={4}
          value={custom.join("\n")}
          onChange={(event) =>
            onChange([
              ...values.filter((value) => known.has(value)),
              ...lines(event.target.value),
            ])
          }
          className={control}
        />
      </Field>
    </div>
  );
}
