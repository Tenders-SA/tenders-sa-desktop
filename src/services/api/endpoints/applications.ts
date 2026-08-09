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
import { ApiError } from "../errors";
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
  // The detail route omits this field while the list route returns it
  // (verified against the live site on 2026-08-07). One shared schema,
  // so the workspace reads an absent `isArchived` as "not archived".
  isArchived: z.boolean().default(false),
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

/**
 * The parent's workspace board stages (Workspace Cockpit). Kept as strings
 * so a new parent stage cannot break the client; the stepper only renders
 * stages it knows.
 */
export const WORKSPACE_STAGES = [
  "suggested",
  "needs_analysis",
  "review_requirements",
  "fix_readiness",
  "add_information",
  "generate_documents",
  "ready_to_submit",
  "submitted",
] as const;

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number];

export const WORKSPACE_STAGE_LABELS: Record<WorkspaceStage, string> = {
  suggested: "Suggested",
  needs_analysis: "Needs analysis",
  review_requirements: "Review requirements",
  fix_readiness: "Fix readiness",
  add_information: "Add information",
  generate_documents: "Generate documents",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
};

export type WorkspaceAction = "status" | "stage" | "remove";

/*
 * Cockpit contracts (desktop-workspace-cockpit design.md). All permissive:
 * recognised fields are typed, everything else passes through, and the
 * nullable spots the live payload actually has stay nullable.
 */
const cockpitSchema = z
  .object({
    application: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
        currentStep: z.string().optional(),
        progressPercentage: z.number().optional(),
        readinessScore: z.number().optional(),
        notes: z.string().nullable().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        submittedAt: z.string().nullable().optional(),
        generatedCoverLetter: z.string().nullable().optional(),
        generatedCapability: z.string().nullable().optional(),
        generatedMethodology: z.string().nullable().optional(),
        generatedEmail: z.string().nullable().optional(),
        finalProposalUrl: z.string().nullable().optional(),
      })
      .passthrough(),
    tender: z
      .object({
        id: z.string().optional(),
        title: z.string().optional(),
        referenceNumber: z.string().nullable().optional(),
        sourceOrganization: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        closingDate: z.string().nullable().optional(),
        briefingDate: z.string().nullable().optional(),
        province: z.string().nullable().optional(),
        estimatedValue: z.number().nullable().optional(),
        timeline: z.unknown().optional(),
      })
      .passthrough(),
    company: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        profileCompleteness: z.number().optional(),
        hasProfile: z.boolean().optional(),
        experienceCount: z.number().optional(),
        personnelCount: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    matching: z.unknown().nullable().optional(),
    readiness: z
      .object({
        score: z.number().optional(),
        overall: z.string().optional(),
        factors: z
          .array(
            z
              .object({
                name: z.string().optional(),
                score: z.number().optional(),
                status: z.string().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    urgency: z
      .object({
        level: z.string().optional(),
        color: z.string().optional(),
        pulsing: z.boolean().optional(),
        daysRemaining: z.number().optional(),
        hoursRemaining: z.number().optional(),
        percentageRemaining: z.number().optional(),
        message: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    generationStatus: z.unknown().nullable().optional(),
    qualityChecks: z
      .array(
        z
          .object({
            id: z.string().optional(),
            category: z.string().optional(),
            status: z.string().optional(),
            message: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    valueEstimate: z
      .object({
        estimatedMin: z.number().optional(),
        estimatedMax: z.number().optional(),
        estimatedMedian: z.number().optional(),
        confidenceScore: z.number().optional(),
        confidenceLevel: z.string().optional(),
        methodology: z.string().optional(),
        dataSources: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
        currency: z.string().optional(),
        sampleSize: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    analysisStatus: z
      .object({
        status: z.string().optional(),
        message: z.string().optional(),
        progress: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    checklistState: z
      .array(
        z
          .object({
            id: z.string().optional(),
            label: z.string().optional(),
            completed: z.boolean().optional(),
            category: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    events: z
      .array(
        z
          .object({
            id: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            eventDate: z.string().optional(),
            eventType: z.string().optional(),
            isCompleted: z.boolean().optional(),
            source: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    documentState: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type CockpitPayload = z.infer<typeof cockpitSchema>;

export interface CockpitQualityCheck {
  id?: string;
  category?: string;
  status?: string;
  message?: string;
}

export interface CockpitChecklistItem {
  id?: string;
  label?: string;
  completed?: boolean;
  category?: string;
}

export interface CockpitEvent {
  id?: string;
  title?: string;
  description?: string;
  eventDate?: string;
  eventType?: string;
  isCompleted?: boolean;
  source?: string;
}

const complianceGapsSchema = z
  .object({
    gaps: z
      .array(
        z
          .object({
            id: z.string().optional(),
            category: z.string().optional(),
            severity: z.string().optional(),
            label: z.string().optional(),
            detail: z.string().optional(),
            tenderRequirement: z.string().optional(),
            companyStatus: z.string().optional(),
            fixLink: z.string().optional(),
            canAutoFix: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
    summary: z
      .object({
        blocking: z.number().optional(),
        important: z.number().optional(),
        strengths: z.number().optional(),
        info: z.number().optional(),
        score: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

/** Contract types are derived from the permissive schemas, never duplicated. */
export type ComplianceGaps = z.infer<typeof complianceGapsSchema>;
export type ComplianceGap = NonNullable<ComplianceGaps["gaps"]>[number];
export type ResearchPayload = z.infer<typeof researchSchema>;
export type ResearchCompetitor = NonNullable<
  ResearchPayload["competitors"]
>[number];
export type WorkspaceUpdateResult = z.infer<typeof workspaceUpdateSchema>;
type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

const researchSchema = z
  .object({
    organisation: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        slug: z.string().optional(),
        organizationType: z.string().optional(),
        contactEmail: z.string().nullable().optional(),
        contactPhone: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
        physicalAddress: z.string().nullable().optional(),
        registrationNumber: z.string().nullable().optional(),
        bbbeeLevel: z.string().nullable().optional(),
        provincesOperating: z.string().nullable().optional(),
        googleRating: z.number().nullable().optional(),
        csdNumber: z.string().nullable().optional(),
        enrichmentSources: z.array(z.string()).optional(),
        tenderCount: z.number().optional(),
        activeTenderCount: z.number().optional(),
        noticeCount: z.number().optional(),
        awardCount: z.number().optional(),
        closedTenderCount: z.number().optional(),
        cancellationCount: z.number().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    competitors: z
      .array(
        z
          .object({
            supplierName: z.string().optional(),
            totalValue: z.number().optional(),
            awardCount: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
    provinceHealth: z
      .object({
        province: z.string().optional(),
        score: z.number().optional(),
        activityLevel: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    eligibility: z.unknown().nullable().optional(),
    intelItems: z.array(z.unknown()).optional(),
    valueBenchmark: z.unknown().nullable().optional(),
    referenceMaterials: z.unknown().nullable().optional(),
    jvSuggestion: z.unknown().nullable().optional(),
  })
  .passthrough();

export interface ResearchPayloadOrganisation {
  id?: string;
  name?: string;
  slug?: string;
  organizationType?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  physicalAddress?: string | null;
  registrationNumber?: string | null;
  bbbeeLevel?: string | null;
  provincesOperating?: string | null;
  googleRating?: number | null;
  csdNumber?: string | null;
  enrichmentSources?: string[];
  tenderCount?: number;
  activeTenderCount?: number;
  noticeCount?: number;
  awardCount?: number;
  closedTenderCount?: number;
  cancellationCount?: number;
}

const workspaceSummarySchema = z
  .object({
    applications: z
      .array(
        z
          .object({
            id: z.string().optional(),
            applicationId: z.string().optional(),
            stage: z.string().optional(),
            status: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    autoArchived: z.boolean().optional(),
    hasMore: z.boolean().optional(),
  })
  .passthrough();

const workspaceUpdateSchema = z
  .object({
    success: z.boolean().optional(),
    status: z.string().optional(),
    submittedAt: z.string().nullable().optional(),
    persisted: z.boolean().optional(),
    stageOverride: z.unknown().nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .passthrough();

/**
 * Additional-info contracts (desktop-workspace-additional-info design.md).
 * `type` is a string so a field type the client does not know yet degrades to
 * a text input instead of failing the panel (R-A-5); `values` is a passthrough
 * record because the parent persists arbitrary flat answer keys.
 */
const additionalInfoFieldSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().optional(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    help: z.string().optional(),
  })
  .passthrough();

const additionalInfoSchema = z
  .object({
    values: z.record(z.string(), z.unknown()).default({}),
    fields: z.array(additionalInfoFieldSchema).optional(),
    unfilledRequired: z.number().optional(),
  })
  .passthrough();

const additionalInfoSaveSchema = z
  .object({
    persisted: z.boolean().optional(),
    unfilledRequired: z.number().optional(),
  })
  .passthrough();

export type AdditionalInfo = z.infer<typeof additionalInfoSchema>;
export type AdditionalInfoField = z.infer<typeof additionalInfoFieldSchema>;
/** Answer values the desktop sends: strings and checkboxes only, no undefined. */
export type AdditionalInfoValues = Record<string, string | boolean>;
export type AdditionalInfoSaveResult = z.infer<typeof additionalInfoSaveSchema>;

/**
 * Response-blueprint contracts (desktop-workspace-response-blueprint design.md).
 * Every section is optional (R-B-5): the parent may omit `blueprint` entirely
 * before analysis, and unknown `kind`/`category`/`source`/`confidence` values
 * pass through as strings so the panel renders them as plain text rather than
 * failing. `responseDocs`/`responseDocStatus` are the per-key saved-content
 * and async-generation state the panel reflects (R-B-3).
 */
const requiredUserDocumentSchema = z
  .object({
    name: z.string().optional(),
    canonicalType: z.string().optional(),
    source: z.string().optional(),
    mandatory: z.boolean().optional(),
    note: z.string().optional(),
  })
  .passthrough();

const responseBlueprintDocSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    kind: z.string().optional(),
    brief: z.string().optional(),
    requiredBy: z.string().optional(),
    mandatory: z.boolean().optional(),
  })
  .passthrough();

const blueprintStepSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    detail: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    category: z.string().optional(),
    mandatory: z.boolean().optional(),
    source: z.string().optional(),
  })
  .passthrough();

const blueprintSubmissionSchema = z
  .object({
    method: z.string().optional(),
    address: z.string().optional(),
    portalUrl: z.string().optional(),
    deadline: z.string().nullable().optional(),
    contact: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

const blueprintSchema = z
  .object({
    tenderId: z.string().optional(),
    industry: z
      .object({ id: z.string().optional(), name: z.string().optional() })
      .nullable()
      .optional(),
    requiredUserDocuments: z.array(requiredUserDocumentSchema).optional(),
    responseDocuments: z.array(responseBlueprintDocSchema).optional(),
    steps: z.array(blueprintStepSchema).optional(),
    submission: blueprintSubmissionSchema.optional(),
    risks: z.array(z.string()).optional(),
    confidence: z.string().optional(),
    generatedBy: z.string().optional(),
  })
  .passthrough();

const responseDocStatusSchema = z
  .object({
    state: z.string().optional(),
    startedAt: z.number().optional(),
    updatedAt: z.number().optional(),
    isFallback: z.boolean().optional(),
    error: z.string().optional(),
    unresolvedPlaceholders: z.array(z.string()).optional(),
  })
  .passthrough();

const blueprintPayloadSchema = z
  .object({
    blueprint: blueprintSchema.nullable().optional(),
    hasAnalysis: z.boolean().optional(),
    enriched: z.boolean().optional(),
    responseDocs: z.record(z.string(), z.string()).optional(),
    responseDocStatus: z.record(z.string(), responseDocStatusSchema).optional(),
  })
  .passthrough();

/**
 * Response-document authoring contracts (desktop-workspace-response-doc-authoring).
 * Both mutation routes answer small, permissive shapes; unknown fields pass
 * through (R-A-5). `generateResponseDocSchema` is the immediate 202 answer —
 * the actual result arrives later via the blueprint GET's
 * `responseDocs`/`responseDocStatus` (R-A-1).
 */
const generateResponseDocSchema = z
  .object({
    key: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const responseDocSaveSchema = z
  .object({
    ok: z.boolean().optional(),
    key: z.string().optional(),
  })
  .passthrough();

/**
 * Deep-analyse enrichment contract (desktop-workspace-deep-analyse-enrichment).
 * The POST returns the merged blueprint directly; `enriched: false` is not an
 * error — the deterministic plan is returned with a `reason` (R-E-4).
 * `analysisStatus` is a server-internal shape and is deliberately never
 * typed (never rendered).
 */
const enrichBlueprintResponseSchema = z
  .object({
    blueprint: blueprintSchema.nullable().optional(),
    enriched: z.boolean().optional(),
    reason: z.string().optional(),
    analysisStatus: z.unknown().optional(),
  })
  .passthrough();

export type BlueprintPayload = z.infer<typeof blueprintPayloadSchema>;
export type ResponseBlueprint = z.infer<typeof blueprintSchema>;
export type RequiredUserDocument = z.infer<typeof requiredUserDocumentSchema>;
export type ResponseBlueprintDoc = z.infer<typeof responseBlueprintDocSchema>;
export type BlueprintStep = z.infer<typeof blueprintStepSchema>;
export type BlueprintSubmission = z.infer<typeof blueprintSubmissionSchema>;
export type ResponseDocStatus = z.infer<typeof responseDocStatusSchema>;
export type ResponseDocStatusMap = Record<string, ResponseDocStatus>;
export type GenerateResponseDocResult = z.infer<
  typeof generateResponseDocSchema
>;
export type ResponseDocSaveResult = z.infer<typeof responseDocSaveSchema>;
export type EnrichBlueprintResult = z.infer<
  typeof enrichBlueprintResponseSchema
>;

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

  /**
   * The workspace cockpit payload (`GET /api/v1/applications/[id]/assist`).
   *
   * Live-verified 2026-08-08: readiness, urgency, qualityChecks,
   * valueEstimate, analysisStatus, checklistState, events and documentState
   * all arrive; `matching` can be null. Every panel schema below is
   * permissive — recognised fields typed, everything else passthrough — so a
   * moved parent shape degrades one panel to its error state instead of
   * failing the whole workspace (spec: desktop-workspace-cockpit R-W-6).
   */
  async getCockpit(id: string, signal?: AbortSignal): Promise<CockpitPayload> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist`,
      schema: cockpitSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body;
  }

  /**
   * Compliance gaps for the cockpit (`GET .../assist/compliance-gaps`).
   */
  async getComplianceGaps(
    id: string,
    signal?: AbortSignal,
  ): Promise<ComplianceGaps> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/compliance-gaps`,
      schema: complianceGapsSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body;
  }

  /** Market research for the cockpit (`GET .../assist/research`). */
  async getResearch(
    id: string,
    signal?: AbortSignal,
  ): Promise<ResearchPayload> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/research`,
      schema: researchSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body;
  }

  /**
   * The workspace board stage for one application
   * (`GET /api/v1/applications/workspace/summary`).
   *
   * The route is admin-gated in the parent; when it answers 403 the caller
   * still sees `undefined` rather than an error, and the stage bar falls
   * back to a status-derived stage. `undefined` is "stage unknown", never a
   * failure.
   */
  async getWorkspaceStage(
    id: string,
    signal?: AbortSignal,
  ): Promise<WorkspaceStage | undefined> {
    let body: WorkspaceSummary;
    try {
      body = await this.transport.request({
        method: "GET",
        path: "/api/v1/applications/workspace/summary",
        schema: workspaceSummarySchema,
        headers: await this.authHeaders(),
        signal,
      });
    } catch (error) {
      if (error instanceof ApiError && error.kind === "forbidden") {
        return undefined;
      }
      throw error;
    }
    const card = (body.applications ?? []).find(
      (entry) => entry.id === id || entry.applicationId === id,
    );
    if (!card?.stage) return undefined;
    return WORKSPACE_STAGES.includes(card.stage as WorkspaceStage)
      ? (card.stage as WorkspaceStage)
      : undefined;
  }

  /**
   * One workspace lifecycle action (`PATCH .../workspace`, R-W-4).
   *
   * Explicit human actions only: `{action:'status', status}`,
   * `{action:'stage', stage, baseStage}` (or `stage: null` to clear the
   * override) and `{action:'remove'}`. The parent validates; an invalid
   * status transition arrives as a 400 whose `error` and `allowed` list
   * surface verbatim. Never retried (the parent has no idempotency key).
   */
  async updateWorkspace(
    id: string,
    action: WorkspaceAction,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<WorkspaceUpdateResult> {
    return this.transport.request({
      method: "PATCH",
      path: `/api/v1/applications/${encodeURIComponent(id)}/workspace`,
      body: { action, ...body },
      schema: workspaceUpdateSchema,
      headers: await this.authHeaders(),
      policy: { retry: "never" },
      signal,
    });
  }

  /**
   * Tender-specific additional-information Q&A
   * (`GET .../assist/additional-info`, desktop-workspace-additional-info R-A-1).
   *
   * Live-verified 2026-08-08: `values` holds the user's persisted answers as
   * flat keys, `fields` is the detected per-tender schema (5 base fields +
   * conditional commitments + a declarations checkbox), `unfilledRequired`
   * counts required fields still blank. Permissive: an unknown field `type`
   * renders as a text input rather than failing the panel (R-A-5).
   */
  async getAdditionalInfo(
    id: string,
    signal?: AbortSignal,
  ): Promise<AdditionalInfo> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/additional-info`,
      schema: additionalInfoSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body;
  }

  /**
   * Persists the Q&A answers (`PUT .../assist/additional-info`, R-A-2).
   *
   * The parent merges these answers additively over its `__`-namespaced
   * workspace state, so the desktop sends exactly its form state and never a
   * reserved key (R-A-6). Never retried: there is no idempotency key, and a
   * replay could duplicate a save the user already saw succeed.
   */
  async saveAdditionalInfo(
    id: string,
    values: AdditionalInfoValues,
    signal?: AbortSignal,
  ): Promise<AdditionalInfoSaveResult> {
    return this.transport.request({
      method: "PUT",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/additional-info`,
      body: { values },
      schema: additionalInfoSaveSchema,
      headers: await this.authHeaders(),
      policy: { retry: "never" },
      signal,
    });
  }

  /**
   * Tender-driven Response Blueprint
   * (`GET .../assist/response-blueprint`,
   * desktop-workspace-response-blueprint R-B-1).
   *
   * Read-only: which response documents to generate, which documents the user
   * must have, and the steps/milestones — derived by the parent from the
   * tender's document analysis + industry profile. `responseDocs` holds
   * saved content per doc key; `responseDocStatus` tracks async generation
   * per key (generating/ready/failed). Permissive: `blueprint` may be null
   * before analysis, sections may be absent, and unknown enum values pass
   * through as strings (R-B-5). A plain GET, so it uses the default retry
   * policy — nothing here mutates.
   */
  async getResponseBlueprint(
    id: string,
    signal?: AbortSignal,
  ): Promise<BlueprintPayload> {
    return this.transport.request({
      method: "GET",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/response-blueprint`,
      schema: blueprintPayloadSchema,
      headers: await this.authHeaders(),
      signal,
    });
  }

  /**
   * Start generation of a response document
   * (`POST .../assist/generate-response-doc`,
   * desktop-workspace-response-doc-authoring R-A-1).
   *
   * The parent answers 202 immediately and generates asynchronously; the
   * result lands in the blueprint GET's `responseDocs`/`responseDocStatus`
   * (R-A-3). Gated server-side: 402 `SUBSCRIPTION_REQUIRED` (any active/trial
   * subscription) and 409 `PRECONDITIONS_NOT_MET` (unfilled required
   * additional info). A mutation that starts a server-side AI job — the
   * transport must never auto-retry it (R-A-6); the parent's 202-idempotency
   * covers a double press.
   */
  async generateResponseDocument(
    id: string,
    key: string,
    prompt?: string,
    signal?: AbortSignal,
  ): Promise<GenerateResponseDocResult> {
    const body: Record<string, string> = { key };
    if (prompt) body.prompt = prompt;
    return this.transport.request({
      method: "POST",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/generate-response-doc`,
      schema: generateResponseDocSchema,
      headers: await this.authHeaders(),
      body,
      policy: { retry: "never" },
      signal,
    });
  }

  /**
   * Save an edited response document
   * (`PUT .../assist/response-doc`,
   * desktop-workspace-response-doc-authoring R-A-2).
   *
   * Synchronous (`{ok: true, key}`); base docs also mirror to the legacy
   * generated_* columns server-side. No subscription gate. A mutation — the
   * transport must never auto-retry it (R-A-6, mirrors `saveAdditionalInfo`).
   */
  async saveResponseDocument(
    id: string,
    key: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<ResponseDocSaveResult> {
    return this.transport.request({
      method: "PUT",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/response-doc`,
      schema: responseDocSaveSchema,
      headers: await this.authHeaders(),
      body: { key, content },
      policy: { retry: "never" },
      signal,
    });
  }

  /**
   * Deep-analyse for this application
   * (`POST .../assist/enrich-blueprint`,
   * desktop-workspace-deep-analyse-enrichment R-E-1).
   *
   * Runs the parent's application-focused AI pass over the tender analysis
   * and caches the enrichment; the blueprint GET then re-merges it and
   * reports `enriched: true` (R-E-2). Professional/Enterprise tier only —
   * 402 with no machine code, so the panel keys its copy off the action
   * (R-E-3). A slow/failing AI pass falls back with `enriched: false` +
   * `reason` instead of failing (R-E-4). A mutation — the transport must
   * never auto-retry it (R-E-5).
   */
  async enrichBlueprint(
    id: string,
    signal?: AbortSignal,
  ): Promise<EnrichBlueprintResult> {
    return this.transport.request({
      method: "POST",
      path: `/api/v1/applications/${encodeURIComponent(id)}/assist/enrich-blueprint`,
      schema: enrichBlueprintResponseSchema,
      headers: await this.authHeaders(),
      policy: { retry: "never" },
      signal,
    });
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
