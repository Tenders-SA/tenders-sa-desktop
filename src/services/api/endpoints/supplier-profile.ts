/**
 * Supplier Profile — the partner-vetting record, composed from what the
 * parent already serves.
 *
 * Spec: desktop-supplier-profile §design 2, 3 (R-S3, R-S4)
 * Refs: brief §8.3, §8.4, §10; INT-A3, REQ-A12
 *
 * **There is no per-supplier profile route.** `/tools/company-intelligence/[slug]`
 * is a Next.js server component reading the database directly, so this client
 * composes six partial contracts instead (requirements §"Parent contracts",
 * read from parent source 2026-08-16):
 *
 *   A `GET /api/tools/company-intelligence/search?mode=company`  (public)
 *   B `GET /api/tools/forensic-analysis/search?mode=supplier`    (tiered)
 *   C `GET /api/forensic/supplier/[slug]`                        (public)
 *   D `GET /api/tools/forensic-analysis/entity-context`          (403 free)
 *   F `GET /api/v1/report-access/[slug]`                         (200 always)
 *   G `GET /api/jv/contacts?target=`                             (401/403)
 *   H `GET /api/public/featured-user-companies`                  (public)
 *
 * Three envelope conventions and two access models in one screen. They are
 * **not** normalised here: A's meta is snake_case and B's is camelCase for
 * the same concepts (H4), and a shared reader would silently yield
 * `undefined` on one of the two.
 *
 * This is a **separate class** from `SupplierIntelligenceEndpoint` rather than
 * an extension of it. That client is one method over one route; folding six
 * more routes into it would put six unused methods on every screen and every
 * test stub that holds a list client, and would make a forensic-contract
 * change touch the file the list screen depends on. It does import that
 * module's schema and formatter — a shared contract, not a second copy.
 */

import { z } from "zod";
import { AuthenticatedEndpoint } from "./base";
import { ApiError } from "../errors";
import {
  intelligenceCompanySchema,
  type IntelligenceCompany,
} from "./supplier-intelligence";

/* ------------------------------------------------------------------ *
 * Identity (contract A)
 * ------------------------------------------------------------------ */

const leaderboardSearchSchema = z.object({
  data: z.array(intelligenceCompanySchema),
  meta: z
    .object({
      total: z.number(),
      page: z.number(),
      per_page: z.number(),
      total_pages: z.number(),
      has_next: z.boolean(),
      has_prev: z.boolean(),
    })
    .passthrough(),
});

export interface SupplierIdentity {
  /** The slug the route was opened with, echoed back for downstream calls. */
  slug: string;
  /** The canonical supplier name — the key contracts B and D want. */
  name: string;
  /** The full leaderboard row, so the hero needs no second request. */
  company: IntelligenceCompany;
}

/**
 * How many leaderboard rows to scan for an exact slug match.
 *
 * The route clamps `per_page` to 50 (`company-intelligence/search/route.ts:19`),
 * so this asks for the most it can. A common word — "construction",
 * "trading" — matches hundreds of suppliers, and the one the user clicked is
 * not necessarily near the top of a value-ranked list.
 */
const IDENTITY_SCAN_PER_PAGE = 50;

/**
 * The comparison the parent's own slug generator implies.
 *
 * `generateCompanySlug` (parent `src/lib/utils/company-name.ts:111-115`) runs
 * `sanitizeCompanyName` first, which **deletes** `()[]{}` and trims wrapper
 * punctuation, then lower-cases and hyphenates. So two names that differ only
 * in that punctuation produce the same slug and must compare equal here.
 *
 * Reimplemented rather than imported: the desktop cannot import parent
 * `src/lib`. It is pinned by unit test against the examples in that file's
 * own doc comment.
 */
export function slugComparableName(name: string): string {
  return name
    .replace(/[()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—_:;,.|/\\]+|[\s\-–—_:;,.|/\\]+$/g, "")
    .trim()
    .toLowerCase();
}

/** The search term contract A is given for a slug: hyphens back to spaces. */
export function deslugForSearch(slug: string): string {
  return slug.replace(/-+/g, " ").trim();
}

/**
 * The **leaderboard** slug, reproduced from a raw supplier name.
 *
 * The two surfaces slug a supplier from *different strings*. The leaderboard
 * slugs `supplierNormalizedName` — `normalizeCompanyName` output — after
 * sanitising it (`company-intelligence.ts:426-434`); the forensic workbench
 * slugs the raw `tender_awards.supplier_name` it picked for the group
 * (`forensic-search.ts:378,643`). `normalizeCompanyName` rewrites far more
 * than `sanitizeCompanyName` does, so `ABC & Sons` slugs to `abc-and-sons` on
 * one route and `abc-sons` on the other, and a workbench row would never
 * match its own leaderboard company.
 *
 * **A partial reproduction, deliberately.** The separator and punctuation
 * rules (`company-name.ts:80-88`) are reproduced because they are short and
 * stable. The trading-as split (R6) and the legal-form synonym table (R7,
 * `legal-forms.ts`) are **not**: copying that table into the desktop would be
 * a second copy of a list that changes. So a name carrying `T/A` or an
 * Afrikaans legal form still produces a slug that will not match, and those
 * suppliers fall back to the other comparison this module makes rather than
 * being claimed as matched.
 */
export function awardSlugFromName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[/\\_–—-]/g, " ")
    .replace(/['".,;:]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** True when a workbench row is the supplier this leaderboard slug names. */
export function isSameSupplier(
  candidate: { slug: string; name: string },
  slug: string,
): boolean {
  return candidate.slug === slug || awardSlugFromName(candidate.name) === slug;
}

/**
 * Tokens a slug carries that the raw stored name may not spell the same way.
 * `(Pty) Ltd` slugs to `-pty-ltd`; `&` slugs to `-and-`.
 */
const SLUG_ONLY_TOKENS = new Set([
  "and",
  "pty",
  "ltd",
  "limited",
  "cc",
  "inc",
  "npc",
  "soc",
  "co",
  "t",
  "a",
  "the",
]);

/**
 * Search terms to try, most specific first, when resolving a slug.
 *
 * **A slug is not a substring of the name it came from.** Both search routes
 * filter `q` with a substring match against the *raw* `supplier_name`
 * (`company-intelligence.ts:99`, `forensic-search.ts:210-217`), while the slug
 * is built from the normalised name — so the full deslugged string matches
 * nothing for the commonest South African legal form: `acme-civils-pty-ltd`
 * searches for `acme civils pty ltd` and the stored value is
 * `ACME CIVILS (PTY) LTD`.
 *
 * Each term is a prefix of the deslugged name, shortened one step at a time
 * and stopping before the first slug-only token. Longest first, so the
 * narrowest search that can work is used; a broader term can only lengthen the
 * scan, never produce a wrong answer, because the caller still requires an
 * exact slug match on the rows that come back.
 */
export function slugSearchTerms(slug: string): string[] {
  const words = deslugForSearch(slug).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const firstSlugOnly = words.findIndex((word) => SLUG_ONLY_TOKENS.has(word));
  const safeLength = firstSlugOnly === -1 ? words.length : firstSlugOnly;
  const lengths = [words.length, safeLength, 2, 1].filter(
    (length) => length >= 1 && length <= words.length,
  );
  return [...new Set(lengths.map((n) => words.slice(0, n).join(" ")))];
}

/* ------------------------------------------------------------------ *
 * Forensic workbench row (contract B)
 * ------------------------------------------------------------------ */

const forensicFlagSchema = z
  .object({
    type: z.string(),
    /** `low | medium | high | critical` on the parent; kept open. */
    severity: z.string(),
    description: z.string(),
  })
  .passthrough();

export type ForensicFlag = z.infer<typeof forensicFlagSchema>;

const ocpoSummarySchema = z
  .object({
    status: z.string(),
    activeCount: z.number(),
    historyCount: z.number(),
    lastSyncAt: z.string().nullable(),
  })
  .passthrough();

/**
 * The news/market summary. Every field is optional because the whole object
 * is `null` for a non-subscriber (H5) and because it is a composed shape the
 * parent may extend; the display layer narrows what it needs.
 */
const intelligenceSummarySchema = z
  .object({
    total: z.number().optional(),
    criticalCount: z.number().optional(),
    highCount: z.number().optional(),
    latestPublishedAt: z.string().nullable().optional(),
    topHeadline: z.string().nullable().optional(),
    topUrgency: z.string().nullable().optional(),
    topSummary: z.string().nullable().optional(),
    riskFlags: z.array(z.string()).optional(),
  })
  .passthrough();

export type IntelligenceSummary = z.infer<typeof intelligenceSummarySchema>;

const provinceHealthSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    healthScore: z.number().optional(),
    status: z.string().optional(),
    scoreDate: z.string().optional(),
  })
  .passthrough();

export type ProvinceHealth = z.infer<typeof provinceHealthSchema>;

const forensicRowSchema = z
  .object({
    id: z.string(),
    mode: z.string(),
    name: z.string(),
    slug: z.string(),
    totalAwards: z.number(),
    totalValue: z.number(),
    latestAwardDate: z.string().nullable(),
    lastCounterpart: z.string().nullable(),
    provinces: z.array(z.string()),
    enterpriseType: z.string().nullable(),
    beeLevel: z.string().nullable(),
    forensicRiskScore: z.number().nullable(),
    forensicFlagCount: z.number(),
    forensicFlags: z.array(forensicFlagSchema),
    ocpo: ocpoSummarySchema.nullable().optional(),
    intelligence: intelligenceSummarySchema.nullable().optional(),
    provinceHealth: z.array(provinceHealthSchema).optional(),
    previewLocked: z.boolean().optional(),
  })
  .passthrough();

export type ForensicRow = z.infer<typeof forensicRowSchema>;

/**
 * `meta.access` from the forensic routes.
 *
 * `capabilities` is a loose record rather than a named object: the parent's
 * list (`forensic-access.ts:4-16`) is its own and may grow, and a longer list
 * arriving must not fail the parse. Two are read by name here — `fullRows`
 * and `advancedFilters`.
 */
const forensicAccessSchema = z
  .object({
    isSubscriber: z.boolean(),
    isAdmin: z.boolean(),
    planTier: z.string().nullable(),
    capabilities: z.record(z.boolean()),
  })
  .passthrough();

export type ForensicAccess = z.infer<typeof forensicAccessSchema>;

/**
 * **camelCase**, where contract A's meta is snake_case for the same concepts
 * (H4). Deliberately not shared with `leaderboardSearchSchema`: a common
 * reader would resolve to `undefined` on one of the two routes and the bug
 * would look like an empty page rather than a parse failure.
 */
const forensicSearchSchema = z.object({
  data: z.array(forensicRowSchema),
  meta: z
    .object({
      total: z.number(),
      page: z.number(),
      perPage: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
      preview: z.boolean(),
      access: forensicAccessSchema,
    })
    .passthrough(),
});

export interface ForensicRowResult {
  /** `null` means "not in the response", which preview and absence share. */
  row: ForensicRow | null;
  /** True when the plan capped the response at 8 rows on page 1 (H6). */
  preview: boolean;
  access: ForensicAccess;
}

export interface ForensicPage {
  rows: ForensicRow[];
  /** True when the plan capped the response at 8 rows on page 1 (H6). */
  preview: boolean;
  access: ForensicAccess;
}

export interface ForensicPageQuery {
  q?: string;
  province?: string;
  page?: number;
  perPage?: number;
}

/**
 * The narrow port the Supplier Intelligence list needs for its optional risk
 * overlay.
 *
 * Declared as a port rather than the whole endpoint so the list screen
 * depends on one method it actually calls, and can be tested with a two-line
 * stub instead of a six-method fake.
 */
export interface ForensicOverlayPort {
  searchForensicSuppliers(
    query: ForensicPageQuery,
    signal?: AbortSignal,
  ): Promise<ForensicPage>;
}

/* ------------------------------------------------------------------ *
 * Public forensic record (contract C)
 * ------------------------------------------------------------------ */

const cipcDataSchema = z
  .object({
    registrationNumber: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    companyType: z.string().nullable().optional(),
    registrationDate: z.string().nullable().optional(),
    // A Prisma Decimal serialises as a string; a plain column as a number.
    // Both are accepted and normalised at the boundary rather than guessed.
    complianceScore: z.union([z.number(), z.string()]).nullable().optional(),
    physicalAddress: z.string().nullable().optional(),
    directorCount: z.number().nullable().optional(),
  })
  .passthrough();

/**
 * Declared field-by-field rather than as `Omit<z.infer<…>, "complianceScore">`.
 *
 * `.passthrough()` adds an index signature to the inferred type, and `Omit`
 * over an index signature collapses every named key into it — so the derived
 * form typed every field as `unknown` while still compiling. Writing the
 * fields out keeps them typed and keeps `complianceScore` normalised to a
 * number.
 */
export interface CipcData {
  registrationNumber?: string | null;
  status?: string | null;
  companyType?: string | null;
  registrationDate?: string | null;
  complianceScore: number | null;
  physicalAddress?: string | null;
  directorCount?: number | null;
}

const awardTimelineRowSchema = z
  .object({
    amount: z.number().nullable().optional(),
    awardDate: z.string().nullable().optional(),
    tenderTitle: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
  })
  .passthrough();

export type AwardTimelineRow = z.infer<typeof awardTimelineRowSchema>;

const publicRecordSchema = z
  .object({
    supplierName: z.string(),
    cipcData: cipcDataSchema.nullable(),
    forensicRiskScore: z.number().nullable(),
    forensicFlags: z.array(forensicFlagSchema),
    flagCount: z.number(),
    awardTimeline: z.array(awardTimelineRowSchema),
  })
  .passthrough();

/**
 * The award-timeline length an anonymous caller is capped at
 * (`src/app/api/forensic/supplier/[slug]/route.ts:37`). The desktop never
 * asserts `x-pro-access` (H3), so reaching this length means "capped", not
 * "that is all there is".
 */
const PUBLIC_TIMELINE_CAP = 10;

export interface SupplierPublicRecord {
  /**
   * False when the name contract C echoed back is not the deslugged slug the
   * desktop asked for — i.e. slug-generation drift, not a different company:
   * the route echoes its own input rather than a resolved record. See
   * `getPublicRecord`. When false, every field below is empty.
   */
  matched: boolean;
  /** What contract C thinks the slug means. Shown only to explain a mismatch. */
  supplierName: string;
  cipcData: CipcData | null;
  forensicRiskScore: number | null;
  forensicFlags: ForensicFlag[];
  flagCount: number;
  awardTimeline: AwardTimelineRow[];
  /** The timeline is at the anonymous cap, so there may be more (H3). */
  timelineAtCap: boolean;
  /** `flagCount` exceeds the flags actually returned (H3). */
  flagsAtCap: boolean;
}

/* ------------------------------------------------------------------ *
 * Entity context (contract D)
 * ------------------------------------------------------------------ */

const restrictionOverlaySchema = z
  .object({
    state: z.string(),
    restricted: z.boolean().optional(),
    activeCount: z.number().optional(),
    historyCount: z.number().optional(),
    overlapCount: z.number().optional(),
    /** `high | possible` on the parent. */
    confidence: z.string().optional(),
    lastSyncAt: z.string().nullable().optional(),
    /**
     * The parent authored this to be legally cautious
     * (`forensic-restricted-suppliers.ts:48-49`). It is rendered verbatim;
     * rewriting it in the desktop would re-do wording that is already right.
     */
    label: z.string(),
  })
  .passthrough();

export type RestrictionOverlay = z.infer<typeof restrictionOverlaySchema>;

const entityContextSchema = z.object({
  data: z
    .object({
      mode: z.string(),
      name: z.string(),
      provinces: z.array(z.string()),
      categories: z.array(z.string()),
      intelligence: intelligenceSummarySchema.nullable().optional(),
      provinceHealth: z.array(provinceHealthSchema).optional(),
      ocpo: ocpoSummarySchema.nullable().optional(),
      restriction: restrictionOverlaySchema.nullable().optional(),
    })
    .passthrough(),
  meta: z.object({ access: forensicAccessSchema }).passthrough(),
});

export interface SupplierEntityContext {
  provinces: string[];
  categories: string[];
  intelligence: IntelligenceSummary | null;
  provinceHealth: ProvinceHealth[];
  restriction: RestrictionOverlay | null;
  access: ForensicAccess;
}

/* ------------------------------------------------------------------ *
 * Report access (contract F) and contacts (contract G)
 * ------------------------------------------------------------------ */

const reportAccessSchema = z
  .object({
    isPro: z.boolean(),
    isPurchased: z.boolean(),
    isClaimed: z.boolean(),
    pendingForCurrentUser: z.boolean(),
    hasApprovedClaimForCurrentUser: z.boolean(),
  })
  .passthrough();

export interface ReportAccess {
  /**
   * False when every flag is false — which is exactly the body the route
   * returns for an anonymous user, an unresolvable slug **and** an internal
   * error (H9). The screen may render positives from this record; it may
   * never render a negative.
   */
  established: boolean;
  isPro: boolean;
  isPurchased: boolean;
  isClaimed: boolean;
  pendingForCurrentUser: boolean;
  hasApprovedClaimForCurrentUser: boolean;
}

const contactsSchema = z
  .object({
    directors: z.array(
      z
        .object({
          fullName: z.string(),
          email: z.string().nullable(),
        })
        .passthrough(),
    ),
    contactEmail: z.string().nullable(),
  })
  .passthrough();

export type SupplierDirector = z.infer<
  typeof contactsSchema
>["directors"][number];

export interface SupplierContacts {
  directors: SupplierDirector[];
  contactEmail: string | null;
  /**
   * False when the route answered 200 with nothing at all — which it does
   * when the slug does not resolve (H10). An empty `directors` array is not
   * evidence that a company has no directors.
   */
  resolved: boolean;
}

/* ------------------------------------------------------------------ *
 * Showcase directory (contract H)
 * ------------------------------------------------------------------ */

const showcaseEntrySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    displayName: z.string(),
    shortDescription: z.string().nullable().optional(),
    websiteUrl: z.string().nullable().optional(),
    industriesServed: z.array(z.string()).optional(),
    provincesServed: z.array(z.string()).optional(),
    companyType: z.string().nullable().optional(),
    bbbeeLevel: z.union([z.number(), z.string()]).nullable().optional(),
    certifications: z.array(z.string()).optional(),
  })
  .passthrough();

export type ShowcaseEntry = z.infer<typeof showcaseEntrySchema>;

/** A **bare array**, no wrapper — a shape unique to this route among A–H. */
const showcaseListSchema = z.array(showcaseEntrySchema);

/** The route clamps `limit` to 20 (`featured-user-companies/route.ts:12`). */
const SHOWCASE_LIMIT = 20;

export class SupplierProfileEndpoint extends AuthenticatedEndpoint {
  /**
   * Resolves a route slug to the canonical supplier name (R-S4).
   *
   * **This is the only blocking read on the screen**, and it goes to contract
   * A deliberately. A needs no session, is not tier-capped, and its `slug` is
   * produced by the very generator the route parameter came from
   * (`company-intelligence.ts:434`) — so an exact match is meaningful. Every
   * other contract on this screen either needs the canonical *name* (B, D) or
   * resolves the slug through a helper that only some of them use (F, G) or
   * none at all (C, which is why H2 exists).
   *
   * The row whose `slug` **equals** the target is selected, never the first
   * row. A search for `abc-trading` returns `ABC Trading Holdings` first when
   * it has more award value, and rendering that company's registration
   * details under the requested slug would be a wrong answer wearing a
   * confident face.
   *
   * **Several search terms are tried, not one.** `q` is substring-matched
   * against the *raw* `supplier_name` column while the slug is built from the
   * normalised name, so the full deslugged slug finds nothing for the
   * commonest South African legal form — see {@link slugSearchTerms}. The
   * exact-slug requirement is unchanged, so a broader term costs a request
   * and cannot return a different company.
   */
  async resolveSupplier(
    slug: string,
    signal?: AbortSignal,
  ): Promise<SupplierIdentity> {
    const terms = slugSearchTerms(slug);
    for (const term of terms.length ? terms : [""]) {
      const body = await this.transport.request({
        method: "GET",
        path: "/api/tools/company-intelligence/search",
        query: {
          q: term || undefined,
          mode: "company",
          page: 1,
          per_page: IDENTITY_SCAN_PER_PAGE,
        },
        schema: leaderboardSearchSchema,
        headers: await this.authHeaders(),
        signal,
      });

      const match = body.data.find((row) => row.slug === slug);
      if (match) return { slug, name: match.name, company: match };
    }

    // `not-found` rather than a thrown string: `describeApiError` renders it
    // as "This supplier could not be found.", which is true and is not a
    // crash. A `malformed` here would blame the parent for a slug the user
    // may simply have mistyped or bookmarked before a rename.
    throw new ApiError({
      kind: "not-found",
      message: "No company matches this slug",
    });
  }

  /**
   * Contract B — the forensic workbench row for one supplier.
   *
   * Supplier mode is **not** 403-gated; only `mode=buyer` is
   * (`forensic-analysis/search/route.ts:79-87`). A non-subscriber instead
   * gets `meta.preview: true` with at most 8 rows forced onto page 1
   * (`forensic-search.ts:183-199`), so a missing row means "outside the
   * preview" as often as it means "not recorded" — which is why `preview` and
   * `access` come back alongside the row instead of being flattened away.
   *
   * The canonical name is tried first, then the same shortened terms
   * {@link slugSearchTerms} builds, because this route substring-matches `q`
   * against the raw column too.
   */
  async getForensicRow(
    name: string,
    slug: string,
    signal?: AbortSignal,
  ): Promise<ForensicRowResult> {
    const attempts = [...new Set([name, ...slugSearchTerms(slug)])].filter(
      Boolean,
    );
    let page = await this.searchForensicSuppliers(
      { q: attempts[0], perPage: IDENTITY_SCAN_PER_PAGE },
      signal,
    );
    // Matched on either slug spelling: the workbench slugs the raw supplier
    // name and the leaderboard the normalised one (`forensic-search.ts:643`,
    // `company-intelligence.ts:434`), so the two differ whenever the name
    // holds `&`, `/`, `T/A` or trailing punctuation.
    let row =
      page.rows.find((candidate) => isSameSupplier(candidate, slug)) ?? null;

    // Under preview the route caps at 8 rows on page 1, so a broader term
    // cannot surface the row — retrying would only cost requests.
    for (let i = 1; !row && !page.preview && i < attempts.length; i++) {
      page = await this.searchForensicSuppliers(
        { q: attempts[i], perPage: IDENTITY_SCAN_PER_PAGE },
        signal,
      );
      row =
        page.rows.find((candidate) => isSameSupplier(candidate, slug)) ?? null;
    }

    return { row, preview: page.preview, access: page.access };
  }

  /**
   * Contract B — one page of the forensic workbench.
   *
   * Used both to find a single supplier's row and to overlay risk signals on
   * the Supplier Intelligence list. `preview` and `access` always travel with
   * the rows because both callers need to tell a plan limit apart from an
   * absence of records (H5, H6), and neither can do that from the rows alone.
   */
  async searchForensicSuppliers(
    query: ForensicPageQuery = {},
    signal?: AbortSignal,
  ): Promise<ForensicPage> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/tools/forensic-analysis/search",
      query: {
        q: query.q || undefined,
        mode: "supplier",
        province: query.province || undefined,
        page: query.page ?? 1,
        per_page: query.perPage ?? IDENTITY_SCAN_PER_PAGE,
      },
      schema: forensicSearchSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      rows: body.data,
      preview: body.meta.preview,
      access: body.meta.access,
    };
  }

  /**
   * Contract C — the public per-supplier forensic record.
   *
   * **The path is `/api/forensic/supplier/[slug]`** (H1).
   * `/api/tools/forensic-analysis/supplier/[slug]` does not exist; a client
   * on that path gets a 404 that `describeApiError` renders as a statement
   * about the *company* rather than about the client.
   *
   * **The route resolves its slug with `slug.replace(/-/g, ' ')`** and then
   * matches the stored supplier name case-insensitively (H2). Slugs are built
   * by deleting `()[]{}` before hyphenating, so `"Acme Civils (Pty) Ltd"`
   * becomes `acme-civils-pty-ltd` and is matched as `"acme civils pty ltd"` —
   * a string that matches nothing. Because `(Pty) Ltd` is the commonest South
   * African legal form, the award timeline comes back empty for a large share
   * of real suppliers.
   *
   * **The route echoes its input.** `supplierName` in the response is
   * `slug.replace(/-/g, ' ')`, not the row it resolved
   * (`forensic/supplier/[slug]/route.ts:15,42`), so the comparison below can
   * only catch slug-generation drift between the desktop and the parent — it
   * cannot detect that the route described a different company. The CIPC half
   * is safe regardless: `ensureEnriched` resolves through
   * `normalizeCompanyName` (`cipc/enrichment.ts:12`), the same key the
   * leaderboard groups by. The award timeline is the exposed half — it
   * matches `supplierName` exactly against the raw column, so it comes back
   * empty for punctuated names. That case is detected downstream, where
   * `describeEvidence` compares the empty timeline against the leaderboard's
   * own `totalAwards` and says "Limited public data" rather than inventing a
   * claim about the company.
   *
   * The emptying branch is kept as a cheap guard against that drift, and on a
   * mismatch every field is emptied here rather than left for each panel to
   * guard. A panel added later cannot then render another company's
   * registration number by forgetting to check a flag.
   *
   * No `x-pro-access` header is sent (H3): it is a client-assertable access
   * gate, and asserting it is privilege escalation, not a feature. The
   * resulting caps are reported instead.
   */
  async getPublicRecord(
    slug: string,
    expectedName: string,
    signal?: AbortSignal,
  ): Promise<SupplierPublicRecord> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/forensic/supplier/${encodeURIComponent(slug)}`,
      schema: publicRecordSchema,
      headers: await this.authHeaders(),
      signal,
    });

    const matched =
      slugComparableName(body.supplierName) ===
      slugComparableName(expectedName);

    if (!matched) {
      return {
        matched: false,
        supplierName: body.supplierName,
        cipcData: null,
        forensicRiskScore: null,
        forensicFlags: [],
        flagCount: 0,
        awardTimeline: [],
        timelineAtCap: false,
        flagsAtCap: false,
      };
    }

    return {
      matched: true,
      supplierName: body.supplierName,
      cipcData: normaliseCipc(body.cipcData),
      forensicRiskScore: body.forensicRiskScore,
      forensicFlags: body.forensicFlags,
      flagCount: body.flagCount,
      awardTimeline: body.awardTimeline,
      timelineAtCap: body.awardTimeline.length >= PUBLIC_TIMELINE_CAP,
      flagsAtCap: body.flagCount > body.forensicFlags.length,
    };
  }

  /**
   * Contract D — provinces, categories, market context and the OCPO
   * restricted-supplier overlay.
   *
   * **`name` is sent, never `slug`.** The route accepts both, but its `slug`
   * branch deslugifies exactly as naively as contract C
   * (`entity-context/route.ts:19-21`), so passing the slug would reintroduce
   * H2 on a route that offers a way to avoid it.
   *
   * 403 without an active subscription (`entity-context/route.ts:25-35`).
   * That is left to propagate: `describeApiError` turns it into plan language,
   * and a caught-and-emptied 403 would be indistinguishable from a company
   * with no recorded provinces.
   */
  async getEntityContext(
    name: string,
    signal?: AbortSignal,
  ): Promise<SupplierEntityContext> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/tools/forensic-analysis/entity-context",
      query: { mode: "supplier", name },
      schema: entityContextSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      provinces: body.data.provinces,
      categories: body.data.categories,
      intelligence: body.data.intelligence ?? null,
      provinceHealth: body.data.provinceHealth ?? [],
      restriction: body.data.restriction ?? null,
      access: body.meta.access,
    };
  }

  /**
   * Contract F — per-user access flags for this company's report.
   *
   * The route answers **200 with every flag false** for an anonymous user, an
   * unresolvable slug and an internal error alike
   * (`report-access/[slug]/route.ts:47-55,98-101`). `established` records
   * that ambiguity so the screen can show what is true and stay silent about
   * what merely could not be determined (H9).
   */
  async getReportAccess(
    slug: string,
    signal?: AbortSignal,
  ): Promise<ReportAccess> {
    const body = await this.transport.request({
      method: "GET",
      path: `/api/v1/report-access/${encodeURIComponent(slug)}`,
      schema: reportAccessSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      established:
        body.isPro ||
        body.isPurchased ||
        body.isClaimed ||
        body.pendingForCurrentUser ||
        body.hasApprovedClaimForCurrentUser,
      isPro: body.isPro,
      isPurchased: body.isPurchased,
      isClaimed: body.isClaimed,
      pendingForCurrentUser: body.pendingForCurrentUser,
      hasApprovedClaimForCurrentUser: body.hasApprovedClaimForCurrentUser,
    };
  }

  /**
   * Contract G — the only contact-details contract the parent exposes
   * (brief §8.4 "Contact details").
   *
   * 401 without a token, 403 `JV_SUBSCRIPTION_REQUIRED` below Starter
   * (`jv/contacts/route.ts:12-20`); both propagate so the screen can name the
   * plan instead of implying the company has no contacts.
   *
   * A 200 with an empty body means the slug did not resolve, not that the
   * company has no directors (H10) — `resolved` keeps the two apart.
   */
  async getContacts(
    slug: string,
    signal?: AbortSignal,
  ): Promise<SupplierContacts> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/jv/contacts",
      query: { target: slug },
      schema: contactsSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return {
      directors: body.directors,
      contactEmail: body.contactEmail,
      resolved: body.directors.length > 0 || body.contactEmail !== null,
    };
  }

  /**
   * Contract H — the featured showcase directory, filtered to this slug.
   *
   * A **bare array** with no wrapper, and at most 20 entries. Its `slug` is a
   * `CompanyShowcaseProfile.slug` — a different namespace from the
   * award-derived slug (H13) — so a match is reported as "this company also
   * appears in the showcase", never merged into the award record.
   *
   * `null` for "no entry": absence from a 20-row featured list says nothing
   * about a company, and the screen renders no panel at all for it (R-S15).
   */
  async getShowcaseEntry(
    slug: string,
    signal?: AbortSignal,
  ): Promise<ShowcaseEntry | null> {
    const body = await this.transport.request({
      method: "GET",
      path: "/api/public/featured-user-companies",
      query: { limit: SHOWCASE_LIMIT },
      schema: showcaseListSchema,
      headers: await this.authHeaders(),
      signal,
    });

    return body.find((entry) => entry.slug === slug) ?? null;
  }
}

/** Accepts the Decimal-as-string form without guessing which one arrives. */
function normaliseCipc(
  data: z.infer<typeof cipcDataSchema> | null,
): CipcData | null {
  if (!data) return null;
  const { complianceScore, ...rest } = data;
  const parsed =
    typeof complianceScore === "string"
      ? Number.parseFloat(complianceScore)
      : complianceScore;
  return {
    ...rest,
    complianceScore:
      typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null,
  };
}
