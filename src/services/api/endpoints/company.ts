/**
 * Company Profile.
 *
 * Refs: brief §6, §4.3, INT-A3; Slice 11 spec
 * `docs/specifications/desktop-company-profile-full-record/`.
 *
 * Parent routes (re-read from parent source at 2026-08-16):
 *   GET  /api/v1/company/profile            -> bare company object, **404 when absent**
 *   PUT  /api/v1/company/profile            -> eleven company-level fields
 *   GET  /api/v1/company/profile/extended   -> company + profile + experiences
 *                                              + keyPersonnel + completeness
 *   POST /api/v1/company/profile/extended   -> **full replace** of the profile
 *   POST /api/v1/company/profile/cidb       -> single-field cidbGrading write
 *   GET|POST        /api/v1/company/experiences
 *   PUT|DELETE      /api/v1/company/experiences/[id]
 *   GET|POST        /api/v1/company/personnel
 *   PUT|DELETE      /api/v1/company/personnel/[id]
 *
 * Five things about this contract shape the desktop's behaviour:
 *
 * 1. **404 means "no profile yet", not "broken"**, and it is the normal state
 *    for a new account. It also explains an empty Tender Radar, since
 *    matching needs a profile. So `getProfile` returns `undefined` for 404
 *    rather than throwing, and the screen invites the user to create one.
 * 2. **`industryCodes`, `provincesOperating` and `certifications` are
 *    `String` columns holding JSON**, which the route `JSON.parse`s before
 *    responding. The desktop receives arrays — but a row written by an older
 *    path can still yield something else, so the schemas tolerate it.
 * 3. **There is no `GET /profile/cidb`.** That route exports only `POST`, so
 *    the GET this client used to issue returned 405 — mapped to `validation`,
 *    not `not-found`, so it was never swallowed and the CIDB panel rendered an
 *    error on every load. The grading is already in the extended payload;
 *    reading it from there costs nothing and cannot 405.
 * 4. **`POST /profile/extended` is a full replace, not a patch.** It writes all
 *    seven profile fields unconditionally, so a body that omits `profileText`
 *    *erases* `profileText`. {@link ExtendedProfileWrite} therefore requires
 *    every field: a partial body is not representable. The per-record `PUT`
 *    routes are genuine patches and are typed as partial accordingly.
 * 5. **`PUT` validates more strictly than `POST`.** On create, a malformed
 *    email, URL or `clientType` is silently coerced to `null`; on update the
 *    same value is a 400. Callers must validate to the `PUT` bar on create too
 *    (`features/company/company-record-validation.ts`), or they will write
 *    records that can never afterwards be edited.
 */

import { z } from "zod";
import { ApiError } from "../errors";
import { AuthenticatedEndpoint } from "./base";

/** Tolerates a JSON-column that did not parse into an array. */
const stringList = z
  .union([z.array(z.string()), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  });

/**
 * A number the parent may serialise as a string.
 *
 * `bbbeeLevel` and `annualTurnover` have always been tolerated this way here;
 * the record columns get the same treatment so one row stored oddly cannot
 * blank a whole panel.
 */
const numeric = z.union([z.number(), z.string()]).nullable().optional();

/** Narrows a value the parent typed only as `Json?`. See {@link narrowList}. */
const jsonValue = z.unknown().nullable().optional();

const companyProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    registrationNumber: z.string().nullable().optional(),
    taxNumber: z.string().nullable().optional(),
    bbbeeLevel: numeric,
    bbbeeCertificateUrl: z.string().nullable().optional(),
    industryCodes: stringList,
    provincesOperating: stringList,
    companySize: z.string().nullable().optional(),
    annualTurnover: numeric,
    certifications: stringList,
    capabilitiesDescription: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

// --------------------------------------------------------------------------
// Records
// --------------------------------------------------------------------------

/**
 * Field names are the parent's, verified against
 * `prisma/user-domain.prisma:394-429`. The previous shape declared `value`,
 * `endDate` and `title`, none of which the parent has ever sent; because they
 * were `.optional()` nothing threw and the contract value simply never
 * rendered.
 */
const experienceSchema = z
  .object({
    id: z.string(),
    projectName: z.string().nullable().optional(),
    clientName: z.string().nullable().optional(),
    clientType: z.string().nullable().optional(),
    contractValue: numeric,
    currency: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    completionDate: z.string().nullable().optional(),
    referenceContact: z.string().nullable().optional(),
    referenceEmail: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    categoryRelevance: stringList,
    provinceRelevance: stringList,
    completionCertUrl: z.string().nullable().optional(),
    referenceLetterUrl: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type CompanyExperience = z.infer<typeof experienceSchema>;

/**
 * `qualifications` is plural in the parent
 * (`prisma/user-domain.prisma:439`); the singular `qualification` this client
 * used to declare never matched, so the qualification line never rendered.
 */
const personnelSchema = z
  .object({
    id: z.string(),
    fullName: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    qualifications: z.string().nullable().optional(),
    certifications: jsonValue,
    yearsExperience: numeric,
    cvUrl: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type CompanyPersonnel = z.infer<typeof personnelSchema>;

// --------------------------------------------------------------------------
// The extended record
// --------------------------------------------------------------------------

const extendedCompanySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    registrationNumber: z.string().nullable().optional(),
    taxNumber: z.string().nullable().optional(),
    bbbeeLevel: numeric,
    bbbeeCertificateUrl: z.string().nullable().optional(),
    industryCodes: stringList,
    provincesOperating: stringList,
    companySize: z.string().nullable().optional(),
    annualTurnover: numeric,
    certifications: stringList,
    capabilitiesDescription: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * `companyType` is read as a plain string, deliberately.
 *
 * It is a Prisma enum on the parent, but a read schema that rejected an
 * unknown member would turn "the parent added a company type" into a screen
 * that fails to load. The enum is enforced only where it must be — on write,
 * via {@link COMPANY_TYPES}.
 */
const extendedProfileSchema = z
  .object({
    id: z.string().optional(),
    companyType: z.string().nullable().optional(),
    profileDocument: z.string().nullable().optional(),
    profileText: z.string().nullable().optional(),
    equipmentAssets: jsonValue,
    operationalCapacity: jsonValue,
    cidbGrading: z.string().nullable().optional(),
    professionalBodies: jsonValue,
    completenessScore: numeric,
    missingFields: jsonValue,
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough();

const extendedRecordSchema = z.object({
  company: extendedCompanySchema,
  /** `null` when a Company exists but has no CompanyProfile row yet. */
  profile: extendedProfileSchema.nullable(),
  experiences: z.array(experienceSchema).optional().default([]),
  keyPersonnel: z.array(personnelSchema).optional().default([]),
  completeness: z
    .object({
      score: z.number(),
      missingFields: z.array(z.string()).optional().default([]),
    })
    .optional(),
});

export type ExtendedCompanyRecord = z.infer<typeof extendedRecordSchema>;
export type ExtendedCompanyProfile = z.infer<typeof extendedProfileSchema>;

/**
 * The six profile signals the Radar completeness card reads.
 *
 * Kept as a **narrowing of the full record** rather than its own request
 * schema: the shape is unchanged, so `radar-workspace-model.ts` and its tests
 * are untouched, but the narrowness can no longer cause data loss elsewhere
 * because it is applied at the projection instead of at the parse.
 */
export interface RadarExtendedProfile {
  company: {
    id: string;
    name: string;
    registrationNumber?: string | null;
    bbbeeLevel?: number | string | null;
    industryCodes: string[];
    annualTurnover?: number | string | null;
  };
  profile: {
    companyType?: string | null;
    cidbGrading?: string | null;
  } | null;
}

function radarSignals(record: ExtendedCompanyRecord): RadarExtendedProfile {
  return {
    company: {
      id: record.company.id,
      name: record.company.name,
      registrationNumber: record.company.registrationNumber,
      bbbeeLevel: record.company.bbbeeLevel,
      industryCodes: record.company.industryCodes,
      annualTurnover: record.company.annualTurnover,
    },
    profile: record.profile
      ? {
          companyType: record.profile.companyType,
          cidbGrading: record.profile.cidbGrading,
        }
      : null,
  };
}

// --------------------------------------------------------------------------
// Write shapes
// --------------------------------------------------------------------------

export interface CompanyProfileUpdate {
  name: string;
  registrationNumber: string | null;
  taxNumber: string | null;
  bbbeeLevel: number | null;
  bbbeeCertificateUrl: string | null;
  industryCodes: string[];
  provincesOperating: string[];
  companySize: string | null;
  annualTurnover: number | null;
  certifications: string[];
  capabilitiesDescription: string | null;
}

export interface CompanyProfileUpdateResult {
  company: CompanyProfile;
  profileCompleteness: number;
  matchingTriggered: boolean;
}

const companyProfileUpdateResponseSchema = z.object({
  message: z.string(),
  profileCompleteness: z.number(),
  matchingTriggered: z.boolean(),
  company: companyProfileSchema,
});

/** The parent's `CompanyType` enum (`prisma/user-domain.prisma:344-353`). */
export const COMPANY_TYPES = [
  "SOLE_PROPRIETOR",
  "CLOSE_CORPORATION",
  "PTY_LTD",
  "PUBLIC_COMPANY",
  "NPO",
  "COOPERATIVE",
  "JOINT_VENTURE",
  "OTHER",
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];

export interface EquipmentAsset {
  name: string;
  quantity?: number;
  value?: number;
}

export interface OperationalCapacity {
  staffCount?: number | null;
  vehicleCount?: number | null;
  premisesOwned?: boolean | null;
  premisesSize?: string | null;
}

export interface ProfessionalBody {
  name: string;
  membershipNumber?: string;
  expiryDate?: string;
}

export interface PersonnelCertification {
  name: string;
  issuer?: string;
  expiryDate?: string;
}

/**
 * A row of a `Json?` column written by some other path, whose shape the
 * documented type does not describe.
 *
 * These rows are carried through an edit verbatim. The alternative — writing
 * back only the rows the desktop understood — would make *opening and saving*
 * the profile delete real company data, which is a far worse failure than
 * rendering it plainly.
 */
export type UnknownJsonRow = Record<string, unknown>;

/**
 * A **complete** extended profile.
 *
 * Every field is required because `POST /profile/extended` replaces all seven
 * unconditionally — an omitted key is written as null. Making the type total
 * means a caller cannot accidentally erase `profileText` while saving a CIDB
 * grade; it has to pass the loaded value through, or null it on purpose.
 * `companyType` is non-optional because the parent's schema requires it.
 */
export interface ExtendedProfileWrite {
  companyType: CompanyType;
  profileDocument: string | null;
  profileText: string | null;
  equipmentAssets: (EquipmentAsset | UnknownJsonRow)[] | null;
  operationalCapacity: OperationalCapacity | null;
  cidbGrading: string | null;
  professionalBodies: (ProfessionalBody | UnknownJsonRow)[] | null;
}

const extendedProfileWriteResponseSchema = z.object({
  message: z.string(),
  profile: z
    .object({
      id: z.string(),
      companyType: z.string().nullable().optional(),
      completenessScore: numeric,
      missingFields: jsonValue,
    })
    .passthrough(),
});

export type ExtendedProfileWriteResult = z.infer<
  typeof extendedProfileWriteResponseSchema
>;

/**
 * A new project-experience record.
 *
 * Optional keys are **omitted** rather than sent as `null`: the update route
 * maps a falsy date to `undefined` (`experiences/[id]/route.ts:101-102`), so
 * sending `null` cannot clear a stored date and only creates the impression
 * that it can.
 */
export interface ExperienceWrite {
  projectName: string;
  clientName?: string;
  clientType?: "Government" | "Private" | "SOE";
  contractValue?: number;
  currency?: string;
  startDate?: string;
  completionDate?: string;
  referenceContact?: string;
  referenceEmail?: string;
  description?: string;
  categoryRelevance?: string[];
  provinceRelevance?: string[];
  completionCertUrl?: string;
  referenceLetterUrl?: string;
}

/** `PUT /experiences/[id]` is a genuine patch, unlike the extended route. */
export type ExperienceUpdate = Partial<ExperienceWrite>;

export interface PersonnelWrite {
  fullName: string;
  role: string;
  department?: string;
  qualifications?: string;
  /** Unrecognised rows are preserved — see {@link UnknownJsonRow}. */
  certifications?: (PersonnelCertification | UnknownJsonRow)[];
  yearsExperience?: number;
  cvUrl?: string;
  email?: string;
  phone?: string;
}

/** `PUT /personnel/[id]` is a genuine patch, unlike the extended route. */
export type PersonnelUpdate = Partial<PersonnelWrite>;

const experienceWriteResponseSchema = z
  .object({ message: z.string().optional(), experience: experienceSchema })
  .passthrough();

/** The write routes answer with the **singular** `person` key. */
const personnelWriteResponseSchema = z
  .object({ message: z.string().optional(), person: personnelSchema })
  .passthrough();

const messageResponseSchema = z
  .object({ message: z.string().optional() })
  .passthrough();

const cidbWriteResponseSchema = z
  .object({
    success: z.boolean().optional(),
    cidbGrading: z.string().nullable().optional(),
  })
  .passthrough();

/** These collection routes may wrap under a domain key or return bare. */
function collectionSchema<T extends z.ZodTypeAny>(item: T, key: string) {
  return z.union([
    z.object({ [key]: z.array(item) }) as unknown as z.ZodType<
      Record<string, z.infer<T>[]>
    >,
    z.object({ success: z.literal(true), data: z.array(item) }),
    z.array(item),
  ]);
}

function unwrapCollection<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (Array.isArray(record[key])) return record[key] as T[];
    if (Array.isArray(record.data)) return record.data as T[];
  }
  return [];
}

export class CompanyEndpoint extends AuthenticatedEndpoint {
  /**
   * The company profile, or `undefined` when none exists.
   *
   * A 404 here is a first-class state, not a failure: it is what a brand-new
   * account looks like, and it is the reason Tender Radar has nothing to
   * match against. Turning it into an error would send the user hunting for
   * a fault instead of to the "create your profile" step.
   *
   * Still read alongside {@link getExtendedRecord} because it is the only
   * route that serialises the company's own `createdAt`/`updatedAt`.
   */
  async getProfile(signal?: AbortSignal): Promise<CompanyProfile | undefined> {
    try {
      return await this.transport.request({
        method: "GET",
        path: "/api/v1/company/profile",
        schema: companyProfileSchema,
        headers: await this.authHeaders(),
        signal,
      });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not-found") {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * The whole company record in one read.
   *
   * `undefined` means no Company at all (the route's 404). A Company with no
   * CompanyProfile row comes back as a record whose `profile` is `null` —
   * a different, actionable state, and the reason the record routes would
   * answer 400.
   */
  async getExtendedRecord(
    signal?: AbortSignal,
  ): Promise<ExtendedCompanyRecord | undefined> {
    try {
      return await this.transport.request({
        method: "GET",
        path: "/api/v1/company/profile/extended",
        schema: extendedRecordSchema,
        headers: await this.authHeaders(),
        signal,
      });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not-found") {
        return undefined;
      }
      throw error;
    }
  }

  /** Six profile signals used by the canonical Radar completeness card. */
  async getExtendedProfile(
    signal?: AbortSignal,
  ): Promise<RadarExtendedProfile | undefined> {
    const record = await this.getExtendedRecord(signal);
    return record ? radarSignals(record) : undefined;
  }

  /** Explicit human-approved update of the canonical parent company record. */
  async updateProfile(
    update: CompanyProfileUpdate,
    signal?: AbortSignal,
  ): Promise<CompanyProfileUpdateResult> {
    const body = await this.transport.request({
      method: "PUT",
      path: "/api/v1/company/profile",
      schema: companyProfileUpdateResponseSchema,
      headers: await this.authHeaders(),
      body: update,
      signal,
    });
    return {
      company: body.company,
      profileCompleteness: body.profileCompleteness,
      matchingTriggered: body.matchingTriggered,
    };
  }

  /**
   * Replace the extended profile.
   *
   * The parameter is a complete profile by construction — see
   * {@link ExtendedProfileWrite}. Do not be tempted to widen it to a partial:
   * the parent writes every field it names, so a partial body silently
   * deletes whatever it leaves out.
   */
  async saveExtendedProfile(
    profile: ExtendedProfileWrite,
    signal?: AbortSignal,
  ): Promise<ExtendedProfileWriteResult> {
    return this.transport.request({
      method: "POST",
      path: "/api/v1/company/profile/extended",
      schema: extendedProfileWriteResponseSchema,
      headers: await this.authHeaders(),
      body: profile,
      signal,
    });
  }

  /**
   * Write the CIDB grading on its own dedicated route.
   *
   * Deliberately *not* routed through {@link saveExtendedProfile}: this route
   * touches one column, so a CIDB edit cannot clobber the rest of the profile
   * even if the caller's loaded copy is stale. 400s when no CompanyProfile
   * row exists, which the screen's profile gate prevents.
   */
  async setCidbGrading(
    cidbGrading: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.transport.request({
      method: "POST",
      path: "/api/v1/company/profile/cidb",
      schema: cidbWriteResponseSchema,
      headers: await this.authHeaders(),
      body: { cidbGrading },
      signal,
    });
  }

  async getExperiences(signal?: AbortSignal): Promise<CompanyExperience[]> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/company/experiences",
      schema: collectionSchema(experienceSchema, "experiences"),
      headers: await this.authHeaders(),
      signal,
    });
    return unwrapCollection<CompanyExperience>(body, "experiences");
  }

  async createExperience(
    experience: ExperienceWrite,
    signal?: AbortSignal,
  ): Promise<CompanyExperience> {
    const body = await this.transport.request({
      method: "POST",
      path: "/api/v1/company/experiences",
      schema: experienceWriteResponseSchema,
      headers: await this.authHeaders(),
      body: experience,
      signal,
    });
    return body.experience;
  }

  async updateExperience(
    id: string,
    experience: ExperienceUpdate,
    signal?: AbortSignal,
  ): Promise<CompanyExperience> {
    const body = await this.transport.request({
      method: "PUT",
      path: `/api/v1/company/experiences/${encodeURIComponent(id)}`,
      schema: experienceWriteResponseSchema,
      headers: await this.authHeaders(),
      body: experience,
      signal,
    });
    return body.experience;
  }

  async deleteExperience(id: string, signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "DELETE",
      path: `/api/v1/company/experiences/${encodeURIComponent(id)}`,
      schema: messageResponseSchema,
      headers: await this.authHeaders(),
      signal,
    });
  }

  async getPersonnel(signal?: AbortSignal): Promise<CompanyPersonnel[]> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/company/personnel",
      schema: collectionSchema(personnelSchema, "personnel"),
      headers: await this.authHeaders(),
      signal,
    });
    return unwrapCollection<CompanyPersonnel>(body, "personnel");
  }

  async createPersonnel(
    person: PersonnelWrite,
    signal?: AbortSignal,
  ): Promise<CompanyPersonnel> {
    const body = await this.transport.request({
      method: "POST",
      path: "/api/v1/company/personnel",
      schema: personnelWriteResponseSchema,
      headers: await this.authHeaders(),
      body: person,
      signal,
    });
    return body.person;
  }

  async updatePersonnel(
    id: string,
    person: PersonnelUpdate,
    signal?: AbortSignal,
  ): Promise<CompanyPersonnel> {
    const body = await this.transport.request({
      method: "PUT",
      path: `/api/v1/company/personnel/${encodeURIComponent(id)}`,
      schema: personnelWriteResponseSchema,
      headers: await this.authHeaders(),
      body: person,
      signal,
    });
    return body.person;
  }

  async deletePersonnel(id: string, signal?: AbortSignal): Promise<void> {
    await this.transport.request({
      method: "DELETE",
      path: `/api/v1/company/personnel/${encodeURIComponent(id)}`,
      schema: messageResponseSchema,
      headers: await this.authHeaders(),
      signal,
    });
  }
}

// --------------------------------------------------------------------------
// Display helpers
// --------------------------------------------------------------------------

/** A person's display name. */
export function personnelName(person: CompanyPersonnel): string {
  return person.fullName?.trim() || "Unnamed team member";
}

/** An experience record's display title. */
export function experienceTitle(experience: CompanyExperience): string {
  return experience.projectName?.trim() || "Untitled project";
}

/** Coerces a tolerated number-or-string column to a number. */
export function numberOrUndefined(
  value: number | string | null | undefined,
): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Splits a `Json?` column into the items matching the documented shape and
 * the ones that do not.
 *
 * These columns are untyped at the database level, so a row written by
 * another path can hold anything. Dropping what does not match would hide
 * real company data; throwing would blank the panel. Both halves are returned
 * so the screen can render the known shape properly and the rest as plain
 * key/values.
 */
export function narrowList<T>(
  value: unknown,
  schema: z.ZodType<T>,
): { matched: T[]; unmatched: unknown[] } {
  if (value == null) return { matched: [], unmatched: [] };
  if (!Array.isArray(value)) return { matched: [], unmatched: [value] };

  const matched: T[] = [];
  const unmatched: unknown[] = [];
  for (const item of value) {
    const result = schema.safeParse(item);
    if (result.success) matched.push(result.data);
    else unmatched.push(item);
  }
  return { matched, unmatched };
}

const equipmentAssetSchema: z.ZodType<EquipmentAsset> = z.object({
  name: z.string(),
  quantity: z.number().optional(),
  value: z.number().optional(),
});

const professionalBodySchema: z.ZodType<ProfessionalBody> = z.object({
  name: z.string(),
  membershipNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const personnelCertificationSchema: z.ZodType<PersonnelCertification> =
  z.object({
    name: z.string(),
    issuer: z.string().optional(),
    expiryDate: z.string().optional(),
  });

const operationalCapacitySchema: z.ZodType<OperationalCapacity> = z.object({
  staffCount: z.number().nullable().optional(),
  vehicleCount: z.number().nullable().optional(),
  premisesOwned: z.boolean().nullable().optional(),
  premisesSize: z.string().nullable().optional(),
});

export function equipmentAssetList(value: unknown) {
  return narrowList(value, equipmentAssetSchema);
}

export function professionalBodyList(value: unknown) {
  return narrowList(value, professionalBodySchema);
}

export function personnelCertificationList(value: unknown) {
  return narrowList(value, personnelCertificationSchema);
}

/** `undefined` when the column holds a shape that is not an object. */
export function operationalCapacityFields(
  value: unknown,
): OperationalCapacity | undefined {
  if (value == null) return undefined;
  const result = operationalCapacitySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/** The parent stores `missingFields` as `Json?`; only a string array is useful. */
export function missingFieldList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
