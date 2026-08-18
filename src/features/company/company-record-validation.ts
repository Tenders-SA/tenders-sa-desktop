/**
 * Validation for the company record editors.
 *
 * Refs: Slice 11 spec §4.3 (H3, H4).
 *
 * The parent validates **creates more loosely than updates**. On
 * `POST /api/v1/company/experiences` a malformed email, URL or `clientType`
 * is quietly transformed to `null` (`experiences/route.ts:28-58`); on
 * `PUT /api/v1/company/experiences/[id]` the same value is rejected with a
 * 400 (`experiences/[id]/route.ts:38-49`). The personnel routes differ the
 * same way.
 *
 * Validating only to the create bar would therefore let a user save a record
 * whose stored contents are not what they typed, and which the parent then
 * refuses to update — a record you can make but never edit. So the stricter
 * update rules are applied to **both** paths, here, in one place.
 *
 * Empty means *omit the key*, never `null`. The update route maps a falsy
 * date to `undefined` (`experiences/[id]/route.ts:101-102`), which Prisma
 * ignores, so a stored date cannot be cleared from the desktop at all; the
 * editors say so rather than offering a control that does nothing.
 */

import type {
  ExperienceWrite,
  PersonnelWrite,
  PersonnelCertification,
  UnknownJsonRow,
} from "../../services/api/endpoints/company";

/** The parent's own email test (`experiences/route.ts:44`). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CLIENT_TYPES = ["Government", "Private", "SOE"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ValidationResult<T, K extends string> =
  { ok: true; value: T } | { ok: false; errors: FieldErrors<K> };

export interface ExperienceDraft {
  projectName: string;
  clientName: string;
  clientType: string;
  contractValue: string;
  currency: string;
  startDate: string;
  completionDate: string;
  referenceContact: string;
  referenceEmail: string;
  description: string;
  categoryRelevance: string;
  provinceRelevance: string;
  completionCertUrl: string;
  referenceLetterUrl: string;
}

export type ExperienceField = keyof ExperienceDraft;

export interface PersonnelDraft {
  fullName: string;
  role: string;
  department: string;
  qualifications: string;
  yearsExperience: string;
  cvUrl: string;
  email: string;
  phone: string;
  certifications: PersonnelCertification[];
  /**
   * Certification rows whose shape the editor cannot present as fields. Kept
   * out of the form but written back, because the parent replaces the whole
   * array on save.
   */
  preservedCertifications: UnknownJsonRow[];
}

export type PersonnelField = keyof PersonnelDraft;

export function emptyExperienceDraft(): ExperienceDraft {
  return {
    projectName: "",
    clientName: "",
    clientType: "",
    contractValue: "",
    currency: "ZAR",
    startDate: "",
    completionDate: "",
    referenceContact: "",
    referenceEmail: "",
    description: "",
    categoryRelevance: "",
    provinceRelevance: "",
    completionCertUrl: "",
    referenceLetterUrl: "",
  };
}

export function emptyPersonnelDraft(): PersonnelDraft {
  return {
    fullName: "",
    role: "",
    department: "",
    qualifications: "",
    yearsExperience: "",
    cvUrl: "",
    email: "",
    phone: "",
    certifications: [],
    preservedCertifications: [],
  };
}

/** Splits a textarea or comma-separated field into unique trimmed entries. */
export function lines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a URL field to the stricter update bar.
 *
 * Returns `undefined` for empty (the key is then omitted) and an error
 * message when present but unparsable.
 */
function urlField(
  value: string,
  label: string,
): { value?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (!isUrl(trimmed)) {
    return {
      error: `${label} must be a full web address, including https://.`,
    };
  }
  return { value: trimmed };
}

function emailField(
  value: string,
  label: string,
): { value?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (!EMAIL.test(trimmed)) {
    return { error: `${label} must be a valid email address.` };
  }
  return { value: trimmed };
}

/** ISO date (`yyyy-mm-dd`) as produced by `<input type="date">`. */
function dateField(
  value: string,
  label: string,
): { value?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return { error: `${label} must be a valid date.` };
  }
  return { value: trimmed };
}

export function validateExperienceDraft(
  draft: ExperienceDraft,
): ValidationResult<ExperienceWrite, ExperienceField> {
  const errors: FieldErrors<ExperienceField> = {};
  const write: ExperienceWrite = { projectName: draft.projectName.trim() };

  if (!write.projectName) {
    errors.projectName = "Project name is required.";
  }

  const clientName = draft.clientName.trim();
  if (clientName) write.clientName = clientName;

  const clientType = draft.clientType.trim();
  if (clientType) {
    if (!(CLIENT_TYPES as readonly string[]).includes(clientType)) {
      errors.clientType = "Client type must be Government, Private or SOE.";
    } else {
      write.clientType = clientType as ClientType;
    }
  }

  const contractValue = draft.contractValue.trim();
  if (contractValue) {
    const parsed = Number(contractValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.contractValue = "Contract value must be a positive amount.";
    } else {
      write.contractValue = parsed;
    }
  }

  const currency = draft.currency.trim();
  if (currency) write.currency = currency;

  const startDate = dateField(draft.startDate, "Start date");
  if (startDate.error) errors.startDate = startDate.error;
  else if (startDate.value) write.startDate = startDate.value;

  const completionDate = dateField(draft.completionDate, "Completion date");
  if (completionDate.error) errors.completionDate = completionDate.error;
  else if (completionDate.value) write.completionDate = completionDate.value;

  if (
    startDate.value &&
    completionDate.value &&
    Date.parse(completionDate.value) < Date.parse(startDate.value)
  ) {
    errors.completionDate = "Completion date cannot be before the start date.";
  }

  const referenceContact = draft.referenceContact.trim();
  if (referenceContact) write.referenceContact = referenceContact;

  const referenceEmail = emailField(draft.referenceEmail, "Reference email");
  if (referenceEmail.error) errors.referenceEmail = referenceEmail.error;
  else if (referenceEmail.value) write.referenceEmail = referenceEmail.value;

  const description = draft.description.trim();
  if (description) write.description = description;

  const categoryRelevance = lines(draft.categoryRelevance);
  if (categoryRelevance.length) write.categoryRelevance = categoryRelevance;

  const provinceRelevance = lines(draft.provinceRelevance);
  if (provinceRelevance.length) write.provinceRelevance = provinceRelevance;

  const certUrl = urlField(draft.completionCertUrl, "Completion certificate");
  if (certUrl.error) errors.completionCertUrl = certUrl.error;
  else if (certUrl.value) write.completionCertUrl = certUrl.value;

  const letterUrl = urlField(draft.referenceLetterUrl, "Reference letter");
  if (letterUrl.error) errors.referenceLetterUrl = letterUrl.error;
  else if (letterUrl.value) write.referenceLetterUrl = letterUrl.value;

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: write };
}

export function validatePersonnelDraft(
  draft: PersonnelDraft,
): ValidationResult<PersonnelWrite, PersonnelField> {
  const errors: FieldErrors<PersonnelField> = {};
  const write: PersonnelWrite = {
    fullName: draft.fullName.trim(),
    role: draft.role.trim(),
  };

  if (!write.fullName) errors.fullName = "Full name is required.";
  if (!write.role) errors.role = "Role is required.";

  const department = draft.department.trim();
  if (department) write.department = department;

  const qualifications = draft.qualifications.trim();
  if (qualifications) write.qualifications = qualifications;

  const yearsExperience = draft.yearsExperience.trim();
  if (yearsExperience) {
    const parsed = Number(yearsExperience);
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.yearsExperience =
        "Years of experience must be a whole number of years.";
    } else {
      write.yearsExperience = parsed;
    }
  }

  const cvUrl = urlField(draft.cvUrl, "CV link");
  if (cvUrl.error) errors.cvUrl = cvUrl.error;
  else if (cvUrl.value) write.cvUrl = cvUrl.value;

  const email = emailField(draft.email, "Email");
  if (email.error) errors.email = email.error;
  else if (email.value) write.email = email.value;

  const phone = draft.phone.trim();
  if (phone) write.phone = phone;

  // Unrecognised rows are appended rather than dropped: `PUT` replaces the
  // whole array, so anything the editor omits is deleted.
  const certifications = [
    ...draft.certifications.filter((item) => item.name?.trim()),
    ...draft.preservedCertifications,
  ];
  if (certifications.length) write.certifications = certifications;

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: write };
}
