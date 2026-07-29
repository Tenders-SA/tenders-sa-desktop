/**
 * Application Workspaces.
 *
 * Refs: brief §4.1, §6, INT-A3
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET  /api/v1/applications                       -> {applications[], pagination:{total,limit,offset,hasMore}}
 *   GET  /api/v1/applications/[id]                  -> application detail
 *   GET  /api/v1/applications/[id]/workspace        -> workspace state
 *   POST /api/v1/applications/[id]/validate         -> submission readiness
 *   GET  /api/v1/applications/status/[tenderId]     -> whether this tender is already an application
 *   POST /api/v1/applications/new                   -> start one
 *
 * `GET /api/v1/applications` returns **400, not 401**, when the user has no
 * company profile ("Company profile required"). That is a real state for a
 * new account, so the screen has to tell the user to create a profile rather
 * than report a generic failure — a 400 read as "something went wrong" would
 * leave them with no idea what to do.
 *
 * Nothing here submits a tender or approves anything. Brief §4.3 requires
 * human approval for bid decisions, pricing, proposal completion and final
 * submission packs; `validate` reports readiness and never acts on it.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

/** Parent `ApplicationStatus`, kept as a string: new values must not break the list. */
const applicationTenderSchema = z.object({
  id: z.string(),
  title: z.string(),
  referenceNumber: z.string().nullable(),
  sourceOrganization: z.string().nullable(),
  closingDate: z.string().nullable(),
  estimatedValue: z.number().nullable(),
  industryCategories: z.array(z.string()).optional(),
  province: z.string().nullable(),
});

const applicationSchema = z.object({
  id: z.string(),
  tenderId: z.string(),
  status: z.string(),
  submittedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  notes: z.string().nullable(),
  isArchived: z.boolean(),
  tender: applicationTenderSchema,
});

export type Application = z.infer<typeof applicationSchema>;

const applicationsSchema = z.object({
  applications: z.array(applicationSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

export interface ApplicationsResult {
  applications: Application[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ApplicationsQuery {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  /** The route treats absent as `false`, i.e. active applications only. */
  archived?: boolean;
}

/**
 * The workspace payload: `{application: {...}}`, one known shape.
 *
 * This is the brief's gap-analysis view in a single response — it returns the
 * tender's requirements, eligibility criteria and required documents
 * *alongside* the company's B-BBEE level, industry codes, operating provinces
 * and turnover. Comparing them is the whole point of the screen.
 *
 * The Json-ish fields are `safeJsonParse`d server-side and default to `null`
 * or `[]` on failure, so they arrive parsed but their shape is not guaranteed
 * — hence `unknown`, read through the same defensive renderer the tender
 * detail screen uses (gap E-11).
 */
const applicationDetailTenderSchema = applicationTenderSchema.extend({
  description: z.string().nullable().optional(),
  requirements: z.unknown().optional(),
  eligibilityCriteria: z.unknown().optional(),
  bbbeeRequirements: z.unknown().optional(),
  requiredDocuments: z.unknown().optional(),
  documents: z
    .array(
      z
        .object({
          id: z.string(),
          fileName: z.string().nullable().optional(),
          documentCategory: z.string().nullable().optional(),
          fileSize: z.number().nullable().optional(),
          mimeType: z.string().nullable().optional(),
        })
        .passthrough(),
    )
    .optional(),
});

const applicationCompanySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    registrationNumber: z.string().nullable().optional(),
    bbbeeLevel: z.union([z.number(), z.string()]).nullable().optional(),
    industryCodes: z.unknown().optional(),
    provincesOperating: z.unknown().optional(),
    annualTurnover: z.union([z.number(), z.string()]).nullable().optional(),
    capabilitiesDescription: z.string().nullable().optional(),
  })
  .passthrough();

const applicationDetailSchema = z.object({
  application: applicationSchema.extend({
    aiGeneratedContent: z.unknown().optional(),
    documentsUploaded: z.array(z.string()).optional(),
    documentReferences: z.array(z.unknown()).optional(),
    complianceCheckResults: z.unknown().optional(),
    tender: applicationDetailTenderSchema,
    company: applicationCompanySchema.optional(),
  }),
});

export type ApplicationDetail = z.infer<
  typeof applicationDetailSchema
>["application"];

const validationSchema = z
  .object({
    valid: z.boolean().optional(),
    isValid: z.boolean().optional(),
    ready: z.boolean().optional(),
    errors: z.array(z.unknown()).optional(),
    warnings: z.array(z.unknown()).optional(),
    missing: z.array(z.unknown()).optional(),
  })
  .passthrough();

/** Normalised readiness, so the UI does not branch on three field names. */
export interface SubmissionReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

const statusForTenderSchema = z
  .object({
    hasApplication: z.boolean().optional(),
    exists: z.boolean().optional(),
    applicationId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .passthrough();

export interface TenderApplicationStatus {
  hasApplication: boolean;
  applicationId?: string;
  status?: string;
}

export class ApplicationsEndpoint extends AuthenticatedEndpoint {
  async list(
    query: ApplicationsQuery = {},
    signal?: AbortSignal,
  ): Promise<ApplicationsResult> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/applications",
      query: {
        limit,
        offset,
        status: query.status || undefined,
        search: query.search || undefined,
        archived: query.archived ? "true" : undefined,
      },
      schema: applicationsSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      applications: body.applications,
      total: body.pagination.total,
      offset: body.pagination.offset,
      limit: body.pagination.limit,
      hasMore: body.pagination.hasMore,
    };
  }

  async get(id: string, signal?: AbortSignal): Promise<ApplicationDetail> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}`,
      schema: applicationDetailSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.application;
  }

  /**
   * Submission readiness. **Reports, never submits** (brief §4.3).
   *
   * A POST because that is what the route is, not because anything is
   * committed: it recomputes validation server-side.
   */
  async validate(
    id: string,
    signal?: AbortSignal,
  ): Promise<SubmissionReadiness> {
    const body = await this.transport.request({
      method: "POST",
      path: `/api/v1/applications/${encodeURIComponent(id)}/validate`,
      schema: validationSchema,
      headers: await this.authHeaders(),
      signal,
    });

    const blockers = [...toMessages(body.errors), ...toMessages(body.missing)];
    const warnings = toMessages(body.warnings);
    // Only "ready" when the server says so AND nothing is blocking. Defaulting
    // an absent flag to true would call an unvalidated pack submittable.
    const flag = body.valid ?? body.isValid ?? body.ready ?? false;

    return { ready: flag && blockers.length === 0, blockers, warnings };
  }

  /** Whether the current company already has an application for a tender. */
  async statusForTender(
    tenderId: string,
    signal?: AbortSignal,
  ): Promise<TenderApplicationStatus> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/status/${encodeURIComponent(tenderId)}`,
      schema: statusForTenderSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return {
      hasApplication:
        body.hasApplication ?? body.exists ?? Boolean(body.applicationId),
      applicationId: body.applicationId ?? undefined,
      status: body.status ?? undefined,
    };
  }

  /**
   * Starts an application for a tender.
   *
   * This is a deliberate user action (the "pursue this tender" decision), so
   * it is only ever called from an explicit control -- never automatically
   * from viewing a tender.
   */
  async create(
    tenderId: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const body = await this.transport.request({
      method: "POST",
      path: "/api/v1/applications/new",
      body: { tenderId },
      schema: z
        .object({
          id: z.string().optional(),
          applicationId: z.string().optional(),
          application: z.object({ id: z.string() }).optional(),
          data: z.object({ id: z.string() }).optional(),
        })
        .passthrough(),
      headers: await this.authHeaders(),
      signal,
    });
    return (
      body.id ?? body.applicationId ?? body.application?.id ?? body.data?.id
    );
  }
}

/** Pulls readable strings out of a loosely-typed problem list. */
function toMessages(entries: unknown[] | undefined): string[] {
  if (!entries) return [];
  const messages: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string" && entry.trim()) {
      messages.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      for (const key of ["message", "label", "title", "requirement", "field"]) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
          messages.push(value.trim());
          break;
        }
      }
    }
  }
  return messages;
}

/** Status as sentence-case words rather than `UNDER_REVIEW`. */
export function describeApplicationStatus(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase().trim();
  if (!words) return "Unknown";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
