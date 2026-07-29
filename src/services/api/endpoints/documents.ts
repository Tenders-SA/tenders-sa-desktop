/**
 * Company Document Vault.
 *
 * Refs: brief §5 "Company Document Vault", INT-4, INT-A3
 * Parent routes (read from source at `8ff2e4c2`):
 *   GET /api/v1/documents        -> {documents[], stats?, pagination:{total,page,limit,totalPages}}
 *   GET /api/v1/documents/stats  -> {stats:{...,usagePercentage}}
 *   GET /api/v1/documents/[id]/download-url
 *
 * **Expiry is the point of this screen.** A tax clearance or B-BBEE
 * certificate that lapses disqualifies a bid outright, so the parent computes
 * `expiryStatus` and `daysUntilExpiry` server-side and the desktop renders
 * them rather than recomputing — a client clock that is wrong by a day would
 * tell someone a certificate is valid when the buyer will reject it.
 *
 * `fileUrl` comes back as a **relative proxy path** (`/api/v1/documents/:id`),
 * not a storage URL. It is never fetched directly: downloads go through
 * `download-url` (INT-4), which is the parent's R2 flow.
 *
 * The vault is read-only here. Uploading is a multipart flow and a document
 * that fails to attach is worse than one the user knows to add on the web.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";

/** Server-computed. Never derived locally — see the note above. */
const expiryStatusSchema = z.enum(["valid", "expiring", "expired"]);

export type ExpiryStatus = z.infer<typeof expiryStatusSchema>;

const documentSchema = z
  .object({
    id: z.string(),
    companyId: z.string().optional(),
    documentType: z.string(),
    /** Relative parent proxy path, not a storage URL. */
    fileUrl: z.string(),
    fileName: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    verified: z.boolean().optional(),
    uploadedAt: z.string().nullable().optional(),
    expiryStatus: expiryStatusSchema.nullable().optional(),
    daysUntilExpiry: z.number().nullable().optional(),
  })
  .passthrough();

export type CompanyDocument = z.infer<typeof documentSchema>;

const documentsSchema = z.object({
  documents: z.array(documentSchema),
  stats: z.unknown().optional(),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export interface DocumentsResult {
  documents: CompanyDocument[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DocumentsQuery {
  page?: number;
  limit?: number;
  /** Must be a parent `DOCUMENT_TYPES` member; an unknown value 400s. */
  type?: string;
  status?: ExpiryStatus;
  verified?: boolean;
  search?: string;
}

const statsSchema = z.object({
  stats: z
    .object({
      totalDocuments: z.number().optional(),
      referencedDocuments: z.number().optional(),
      expiringSoon: z.number().optional(),
      expired: z.number().optional(),
      usagePercentage: z.number().optional(),
    })
    .passthrough(),
});

export type DocumentStats = z.infer<typeof statsSchema>["stats"];

const downloadUrlSchema = z
  .object({
    url: z.string().optional(),
    downloadUrl: z.string().optional(),
    data: z.object({ url: z.string() }).optional(),
  })
  .passthrough();

export class DocumentsEndpoint extends AuthenticatedEndpoint {
  async list(
    query: DocumentsQuery = {},
    signal?: AbortSignal,
  ): Promise<DocumentsResult> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/documents",
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? 25,
        type: query.type || undefined,
        status: query.status || undefined,
        search: query.search || undefined,
        verified:
          query.verified === undefined ? undefined : String(query.verified),
        // Stats come from the dedicated route instead, so the list stays
        // cheap and one screen's two panels can fail independently.
        includeStats: "false",
      },
      schema: documentsSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      documents: body.documents,
      total: body.pagination.total,
      page: body.pagination.page,
      totalPages: body.pagination.totalPages,
    };
  }

  async getStats(signal?: AbortSignal): Promise<DocumentStats> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/v1/documents/stats",
      schema: statsSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.stats;
  }

  /**
   * A time-limited URL for one document (INT-4).
   *
   * `requireR2=1` because the parent's R2-backed path is the supported one;
   * the desktop never reaches a government source or a storage bucket
   * directly.
   */
  async getDownloadUrl(
    documentId: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/documents/${encodeURIComponent(documentId)}/download-url`,
      query: { requireR2: 1 },
      schema: downloadUrlSchema,
      headers: await this.authHeaders(),
      signal,
    });
    return body.url ?? body.downloadUrl ?? body.data?.url;
  }
}

/** `TAX_CLEARANCE` -> `Tax clearance`. */
export function describeDocumentType(documentType: string): string {
  const words = documentType.replace(/_/g, " ").toLowerCase().trim();
  if (!words) return "Document";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Expiry as text, never colour alone (A11Y-1).
 *
 * Falls back to `expiryStatus` when `daysUntilExpiry` is absent, and says
 * nothing at all when neither is present — a document with no expiry date is
 * not "valid forever", it simply has no expiry to report.
 */
export function describeExpiry(document: CompanyDocument): string | undefined {
  const days = document.daysUntilExpiry;
  if (typeof days === "number") {
    if (days < 0) {
      const overdue = Math.abs(days);
      return `Expired ${overdue} ${overdue === 1 ? "day" : "days"} ago`;
    }
    if (days === 0) return "Expires today";
    return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
  }
  switch (document.expiryStatus) {
    case "expired":
      return "Expired";
    case "expiring":
      return "Expiring soon";
    case "valid":
      return "In date";
    default:
      return undefined;
  }
}
