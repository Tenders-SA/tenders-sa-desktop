/**
 * Create/edit a key-personnel record.
 *
 * Refs: Slice 11 spec R-C10, §4.3 (H3).
 */

import { useState, type FormEvent } from "react";
import type {
  CompanyPersonnel,
  PersonnelCertification,
  PersonnelWrite,
} from "../../services/api/endpoints/company";
import {
  numberOrUndefined,
  personnelCertificationList,
  type UnknownJsonRow,
} from "../../services/api/endpoints/company";
import {
  emptyPersonnelDraft,
  validatePersonnelDraft,
  type FieldErrors,
  type PersonnelDraft,
  type PersonnelField,
} from "./company-record-validation";
import { control, EditorActions, Field } from "./company-form-controls";

interface PersonnelEditorProps {
  /** Omit to create a new record. */
  record?: CompanyPersonnel;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: PersonnelWrite) => Promise<void>;
}

function draftFrom(record: CompanyPersonnel | undefined): PersonnelDraft {
  if (!record) return emptyPersonnelDraft();
  const years = numberOrUndefined(record.yearsExperience);
  const certifications = personnelCertificationList(record.certifications);
  return {
    fullName: record.fullName ?? "",
    role: record.role ?? "",
    department: record.department ?? "",
    qualifications: record.qualifications ?? "",
    yearsExperience: years == null ? "" : String(years),
    cvUrl: record.cvUrl ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    certifications: certifications.matched,
    // `PUT` replaces the whole certifications array, so rows this editor
    // cannot present must still be written back or they are deleted.
    preservedCertifications: certifications.unmatched as UnknownJsonRow[],
  };
}

export function PersonnelEditor({
  record,
  saving,
  onCancel,
  onSave,
}: PersonnelEditorProps) {
  const [draft, setDraft] = useState(() => draftFrom(record));
  const [errors, setErrors] = useState<FieldErrors<PersonnelField>>({});

  function set<K extends keyof PersonnelDraft>(
    key: K,
    value: PersonnelDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setCertification(
    index: number,
    patch: Partial<PersonnelCertification>,
  ) {
    setDraft((current) => ({
      ...current,
      certifications: current.certifications.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validatePersonnelDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await onSave(result.value);
  }

  return (
    <form
      onSubmit={submit}
      /** See `ExperienceEditor` — our validation is the authoritative one. */
      noValidate
      aria-label={record ? "Edit team member" : "Add team member"}
      className="rounded border border-border bg-background p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.fullName}>
          <input
            value={draft.fullName}
            onChange={(event) => set("fullName", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Role" required error={errors.role}>
          <input
            value={draft.role}
            onChange={(event) => set("role", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Department">
          <input
            value={draft.department}
            onChange={(event) => set("department", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Years of experience" error={errors.yearsExperience}>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.yearsExperience}
            onChange={(event) => set("yearsExperience", event.target.value)}
            className={control}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Qualifications">
            <textarea
              rows={3}
              value={draft.qualifications}
              onChange={(event) => set("qualifications", event.target.value)}
              className={control}
            />
          </Field>
        </div>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Phone">
          <input
            value={draft.phone}
            onChange={(event) => set("phone", event.target.value)}
            className={control}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="CV link"
            error={errors.cvUrl}
            hint="A link to the CV. Uploading files happens in the Document Vault."
          >
            <input
              type="url"
              value={draft.cvUrl}
              onChange={(event) => set("cvUrl", event.target.value)}
              className={control}
            />
          </Field>
        </div>
      </div>

      <fieldset className="mt-5 border-t border-border pt-4">
        <legend className="text-sm font-medium text-card-foreground">
          Professional certifications
        </legend>
        {draft.certifications.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            None recorded for this person.
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {draft.certifications.map((certification, index) => (
            <li
              key={index}
              className="grid gap-3 rounded border border-border p-3 sm:grid-cols-3"
            >
              <Field label="Certification">
                <input
                  value={certification.name}
                  onChange={(event) =>
                    setCertification(index, { name: event.target.value })
                  }
                  className={control}
                />
              </Field>
              <Field label="Issuer">
                <input
                  value={certification.issuer ?? ""}
                  onChange={(event) =>
                    setCertification(index, { issuer: event.target.value })
                  }
                  className={control}
                />
              </Field>
              <Field label="Expiry date">
                <input
                  type="date"
                  value={certification.expiryDate ?? ""}
                  onChange={(event) =>
                    setCertification(index, { expiryDate: event.target.value })
                  }
                  className={control}
                />
              </Field>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      certifications: current.certifications.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                  className="rounded border border-border px-3 py-1.5 text-xs text-foreground"
                >
                  Remove certification
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              certifications: [...current.certifications, { name: "" }],
            }))
          }
          className="mt-3 rounded border border-border px-3 py-1.5 text-sm text-foreground"
        >
          Add certification
        </button>
      </fieldset>

      <EditorActions
        saving={saving}
        saveLabel={record ? "Save team member" : "Add team member"}
        onCancel={onCancel}
      />
    </form>
  );
}
