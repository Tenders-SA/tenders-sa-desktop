/**
 * Company Profile.
 *
 * Refs: brief §6, §4.3, INT-A3
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET /api/v1/company/profile      -> bare company object, **404 when absent**
 *   GET /api/v1/company/profile/extended
 *   GET /api/v1/company/profile/cidb
 *   GET /api/v1/company/experiences
 *   GET /api/v1/company/personnel
 *
 * Two things about this contract shape the desktop's behaviour:
 *
 * 1. **404 means "no profile yet", not "broken"**, and it is the normal state
 *    for a new account. It also explains an empty Tender Radar, since
 *    matching needs a profile. So `getProfile` returns `undefined` for 404
 *    rather than throwing, and the screen invites the user to create one.
 * 2. **`industryCodes`, `provincesOperating` and `certifications` are
 *    `String` columns holding JSON**, which the route `JSON.parse`s before
 *    responding. The desktop receives arrays — but a row written by an older
 *    path can still yield something else, so the schemas tolerate it.
 *
 * The profile is **read-only here.** Brief §4.3 requires human approval for
 * company profile changes, and editing is a form-heavy flow that belongs with
 * the accessible-form foundation; the desktop shows the profile and sends
 * users to the web app to change it rather than shipping a half-validated
 * editor that could corrupt matching inputs.
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

const companyProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    registrationNumber: z.string().nullable().optional(),
    taxNumber: z.string().nullable().optional(),
    bbbeeLevel: z.union([z.number(), z.string()]).nullable().optional(),
    bbbeeCertificateUrl: z.string().nullable().optional(),
    industryCodes: stringList,
    provincesOperating: stringList,
    companySize: z.string().nullable().optional(),
    annualTurnover: z.union([z.number(), z.string()]).nullable().optional(),
    certifications: stringList,
    capabilitiesDescription: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

const radarExtendedProfileSchema = z.object({
  company: z.object({
    id: z.string(),
    name: z.string(),
    registrationNumber: z.string().nullable().optional(),
    bbbeeLevel: z.union([z.number(), z.string()]).nullable().optional(),
    industryCodes: stringList,
    annualTurnover: z.union([z.number(), z.string()]).nullable().optional(),
  }),
  profile: z
    .object({
      companyType: z.string().nullable().optional(),
      cidbGrading: z.string().nullable().optional(),
    })
    .nullable(),
});

export type RadarExtendedProfile = z.infer<typeof radarExtendedProfileSchema>;

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

const experienceSchema = z
  .object({
    id: z.string(),
    projectName: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    clientName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    value: z.number().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .passthrough();

export type CompanyExperience = z.infer<typeof experienceSchema>;

const personnelSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    qualification: z.string().nullable().optional(),
    yearsExperience: z.number().nullable().optional(),
  })
  .passthrough();

export type CompanyPersonnel = z.infer<typeof personnelSchema>;

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

  /** Six profile signals used by the canonical Radar completeness card. */
  async getExtendedProfile(
    signal?: AbortSignal,
  ): Promise<RadarExtendedProfile | undefined> {
    try {
      return await this.transport.request({
        method: "GET",
        path: "/api/v1/company/profile/extended",
        schema: radarExtendedProfileSchema,
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

  /** CIDB grading, which is a hard eligibility gate on construction work. */
  async getCidb(
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      return await this.transport.request({
        method: "GET",
        path: "/api/v1/company/profile/cidb",
        schema: z.record(z.string(), z.unknown()),
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
}

/** A person's display name across the two field names the parent uses. */
export function personnelName(person: CompanyPersonnel): string {
  return (
    person.fullName?.trim() || person.name?.trim() || "Unnamed team member"
  );
}

/** An experience record's display title across both field names. */
export function experienceTitle(experience: CompanyExperience): string {
  return (
    experience.projectName?.trim() ||
    experience.title?.trim() ||
    "Untitled project"
  );
}
