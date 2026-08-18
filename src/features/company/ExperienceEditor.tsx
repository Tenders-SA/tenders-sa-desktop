/**
 * Create/edit a project-experience record.
 *
 * Refs: Slice 11 spec R-C9, §4.3 (H3), §4.4 (H4).
 *
 * Validation runs to the parent's **update** bar even when creating, because
 * the create route silently nulls what the update route rejects — see
 * `company-record-validation.ts`.
 */

import { useState, type FormEvent } from "react";
import type {
  CompanyExperience,
  ExperienceWrite,
} from "../../services/api/endpoints/company";
import { numberOrUndefined } from "../../services/api/endpoints/company";
import {
  CLIENT_TYPES,
  emptyExperienceDraft,
  validateExperienceDraft,
  type ExperienceDraft,
  type ExperienceField,
  type FieldErrors,
} from "./company-record-validation";
import { control, EditorActions, Field } from "./company-form-controls";
import { dateInputValue } from "./extended-profile-model";

interface ExperienceEditorProps {
  /** Omit to create a new record. */
  record?: CompanyExperience;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: ExperienceWrite) => Promise<void>;
}

function draftFrom(record: CompanyExperience | undefined): ExperienceDraft {
  if (!record) return emptyExperienceDraft();
  const contractValue = numberOrUndefined(record.contractValue);
  return {
    projectName: record.projectName ?? "",
    clientName: record.clientName ?? "",
    clientType: record.clientType ?? "",
    contractValue: contractValue == null ? "" : String(contractValue),
    currency: record.currency ?? "ZAR",
    startDate: dateInputValue(record.startDate),
    completionDate: dateInputValue(record.completionDate),
    referenceContact: record.referenceContact ?? "",
    referenceEmail: record.referenceEmail ?? "",
    description: record.description ?? "",
    categoryRelevance: record.categoryRelevance.join("\n"),
    provinceRelevance: record.provinceRelevance.join("\n"),
    completionCertUrl: record.completionCertUrl ?? "",
    referenceLetterUrl: record.referenceLetterUrl ?? "",
  };
}

export function ExperienceEditor({
  record,
  saving,
  onCancel,
  onSave,
}: ExperienceEditorProps) {
  const [draft, setDraft] = useState(() => draftFrom(record));
  const [errors, setErrors] = useState<FieldErrors<ExperienceField>>({});

  const hasStoredDate = Boolean(record?.startDate || record?.completionDate);

  function set<K extends keyof ExperienceDraft>(
    key: K,
    value: ExperienceDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateExperienceDraft(draft);
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
      /**
       * Native constraint validation is off on purpose: it would abort the
       * submit before `validateExperienceDraft` runs, so the parent's stricter
       * update-route rules (client type, date ordering) would never be checked
       * and the user would get a browser tooltip instead of our copy.
       */
      noValidate
      aria-label={record ? "Edit project experience" : "Add project experience"}
      className="rounded border border-border bg-background p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Project name" required error={errors.projectName}>
            <input
              value={draft.projectName}
              onChange={(event) => set("projectName", event.target.value)}
              className={control}
            />
          </Field>
        </div>
        <Field label="Client name">
          <input
            value={draft.clientName}
            onChange={(event) => set("clientName", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Client type" error={errors.clientType}>
          <select
            value={draft.clientType}
            onChange={(event) => set("clientType", event.target.value)}
            className={control}
          >
            <option value="">Not recorded</option>
            {CLIENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contract value" error={errors.contractValue}>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.contractValue}
            onChange={(event) => set("contractValue", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Currency" hint="Defaults to ZAR.">
          <input
            value={draft.currency}
            onChange={(event) => set("currency", event.target.value)}
            className={control}
          />
        </Field>
        <Field
          label="Start date"
          error={errors.startDate}
          hint={
            hasStoredDate
              ? "Dates can be changed here but not removed."
              : undefined
          }
        >
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => set("startDate", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Completion date" error={errors.completionDate}>
          <input
            type="date"
            value={draft.completionDate}
            onChange={(event) => set("completionDate", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Reference contact">
          <input
            value={draft.referenceContact}
            onChange={(event) => set("referenceContact", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Reference email" error={errors.referenceEmail}>
          <input
            type="email"
            value={draft.referenceEmail}
            onChange={(event) => set("referenceEmail", event.target.value)}
            className={control}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              className={control}
            />
          </Field>
        </div>
        <Field label="Relevant categories" hint="One per line.">
          <textarea
            rows={3}
            value={draft.categoryRelevance}
            onChange={(event) => set("categoryRelevance", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Relevant provinces" hint="One per line.">
          <textarea
            rows={3}
            value={draft.provinceRelevance}
            onChange={(event) => set("provinceRelevance", event.target.value)}
            className={control}
          />
        </Field>
        <Field
          label="Completion certificate link"
          error={errors.completionCertUrl}
          hint="A link to the document. Uploading files happens in the Document Vault."
        >
          <input
            type="url"
            value={draft.completionCertUrl}
            onChange={(event) => set("completionCertUrl", event.target.value)}
            className={control}
          />
        </Field>
        <Field label="Reference letter link" error={errors.referenceLetterUrl}>
          <input
            type="url"
            value={draft.referenceLetterUrl}
            onChange={(event) => set("referenceLetterUrl", event.target.value)}
            className={control}
          />
        </Field>
      </div>
      <EditorActions
        saving={saving}
        saveLabel={record ? "Save project" : "Add project"}
        onCancel={onCancel}
      />
    </form>
  );
}
