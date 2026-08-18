# Desktop — Procurement Officer Directory — Requirements

> **Slice label**: `desktop-procurement-officer-directory`
> **Type**: Feature (full specification workflow)
> **Status**: see `SPEC_CONTRACT.md` (PENDING APPROVAL)

## Context

The parent platform (tenders-sa.org) now stores consolidated procurement contact
records against tender data: named officers, role mailboxes and procurement offices,
with entity resolution, confidence/freshness scoring, an admin review queue and POPIA
controls (suppression, corrections, audit). The feature research is in
`reports/procurement-officers.md`; the parent implementation lives in the main repo's
`.kiro/specs/procurement-officer-directory-main/`.

The desktop application should surface this as **Procurement Officers** — a searchable,
partially offline directory built on the existing parent read contracts, exactly as
`reports/procurement-officers.md` prescribes: central database authoritative, desktop
carries a compact local index with fast search-as-you-type.

## Parent contracts consumed (existing, read-only)

All routes are JWT-gated and additionally gated by a parent application setting
(`procurementOfficerDirectory`); when the setting is off every route returns **404**.

| Contract | Purpose | Key shapes |
|---|---|---|
| `GET /api/v1/procurement-officers/search?q=&province=&kind=&status=&page=&limit=` | Search | Paginated `{rows, meta}`; contact values **masked** in the summary (`contactSummary`); `total` of matches |
| `GET /api/v1/procurement-officers/{id}` | Detail | Headline assignment (`isCurrent` desc), organisation + physical address, contact points **masked**, data-quality `status`, `kind`, `confidenceScore`, `lastSeenAt` |
| `GET /api/v1/procurement-officers/{id}/tenders` | Related tenders | Paginated tender rows through evidence |
| `GET /api/v1/procurement-officers/sync?cursor=&since=&page=&limit=` | Bulk feed | **apiAccess entitlement required** (403 without); **unmasked official values**; suppressed officers arrive as **tombstones** (`suppressed: true`, empty `contactPoints`/`assignments`); cursor pagination; every page is server-audited |
| `POST /api/v1/procurement-officers/{id}/corrections` | Dispute | `{field, reason}`; creates pending review + suppresses the disputed data server-side |

The sync feed is the entitlement-gated **export path** the desktop local index is built
from. Search/detail stay masked on the wire; the local index holds the unmasked official
values the feed provides.

## Requirements

### Part A — Navigation and route

- **R-P1 — Nav item.** Add primary-navigation item **"Procurement Officers"** (icon
  `UserSearch`, path `/procurement-officers`, `available: true`) in the **Company and
  intelligence** group below "Supplier Intelligence" (`navigation-items.ts`).
- **R-P2 — Route + screen.** Register `/procurement-officers` in `routes.tsx`
  (REQ-16: every advertised path must exist); feature code lives in
  `src/features/procurement-officers/`.

### Part B — Contract layer

- **R-P3 — Endpoint module.** `src/services/api/endpoints/procurement-officers.ts`
  following the `tenders.ts` pattern (zod schemas per endpoint, validated at the
  boundary — REQ-A12, INT-A2): search, detail, tenders, sync, corrections. Schemas must
  encode the parent shapes exactly: masked summaries, tombstones (`suppressed` flag with
  empty arrays), cursor pagination, envelope wrappers.

### Part C — Local index and synchronisation

- **R-P4 — SQLite tables + FTS5.** New migration `0005_procurement_officers.sql`:
  `procurement_officers`, `officer_contact_points`, `officer_assignments`,
  `officer_tender_links`, `saved_officers`, `officer_notes`, `procurement_officer_sync_state`,
  and a `procurement_officers_fts` FTS5 index over name, organisation, title, email,
  telephone, province and tender references. **Pre-check**: confirm the bundled SQLite
  has FTS5 enabled; if not, fall back to LIKE + indexes and record the deviation in
  `INTEGRATION_EVAL.md` before building.
- **R-P5 — Incremental sync runner.** Consume the sync feed on a background cadence,
  persisting `cursor` (per account) in `procurement_officer_sync_state`; resume on next
  run. Suppressed tombstones **drop** the officer and all linked rows from the local
  index immediately (POPIA: disputed facts never persist locally). Handle 403
  (no apiAccess entitlement → feature unavailable state) and 404 (beta off) as distinct
  states, not errors.
- **R-P6 — Ownership scoping.** All officer rows are scoped to the signed-in account
  (owner id), matching the workspace-ownership pattern (`workspace-owner.ts`); sync
  state and saved/notes rows carry the owner id.

### Part D — Search and display

- **R-P7 — Search-as-you-type.** 150–250 ms debounce; **local-first**: query FTS5
  immediately, then refresh against the server search contract. Local results render
  from the local index (official, unmasked, already POPIA-filtered by the parent);
  server results render the masked summary when fresher. Merged display must never show
  a value the local index does not have.
- **R-P8 — Filters.** Province, organisation, role/title, kind (officer / role_mailbox /
  procurement_office), verification status.
- **R-P9 — Data-quality labels.** Render one of the parent statuses with the report's
  freshness framing: **Verified / Recently observed / Historical / Unverified**
  (thresholds 12 / 24 months from `lastSeenAt`, display-only).
- **R-P10 — Detail panel.** Officer detail from the local index, refreshed from the
  server; headline current assignment (never a stale assignment — parent `isCurrent`
  ordering), organisation name + physical address only, official contact points,
  related tenders, related organisation profile link.

### Part E — Actions and POPIA surface

- **R-P11 — Actions.** Copy official email, copy telephone, open email client (mailto),
  save officer to workspace, add private desktop notes, open organisation profile, view
  associated tenders.
- **R-P12 — Corrections.** "Report incorrect information" → `POST corrections`; on
  success, suppress the disputed field locally (pending server review) with a clear
  status; never re-show it from a later sync before the server reflects resolution.
- **R-P13 — No bulk export.** Individual contact copy/export only; no "export all"
  affordance anywhere (report: avoid unrestricted bulk contact exports in the first
  release).
- **R-P14 — Marketing separation.** Directory data must never be used for unsolicited
  marketing; the UI may not imply consent (report POPIA section; parent privacy notice
  governs).

### Part F — States and robustness

- **R-P15 — Feature-off state.** Parent 404 (beta off) → screen explains the directory
  is not yet available; nav item may remain visible but the screen is honest about the
  disabled state (REQ-16 honesty).
- **R-P16 — Entitlement state.** Sync 403 → local index stays read-only at its last
  good state; banner explains the export entitlement is missing; search still works
  against the server search contract.
- **R-P17 — Offline.** Local FTS5 search works offline; freshness banner shows the last
  sync time; server refresh silently degrades.
- **R-P18 — Saved officers + recent searches.** Persisted per account via the existing
  `local_preferences` / repository patterns.

## Out of scope

- Any parent change (new endpoints, schema, settings, unmasking search/detail,
  removing the beta gate) — parent-owned, documented dependency only.
- Bulk or unrestricted export, CSV/JSON export of the directory, "mail all" actions.
- Full organisation profile parity (desktop links to the existing company screen only).
- Web-platform parity of the parent's admin review queue — admin tooling stays in the
  parent.
- Phone/email validation or re-resolution of identity on the desktop — the parent is
  the single source of truth.

## Acceptance criteria

1. Sidebar shows "Procurement Officers" (enabled) and `/procurement-officers` renders the
   directory screen.
2. First sync builds the local FTS5 index from the sync feed; a suppressed tombstone
   removes the officer from the local index on the next sync.
3. Search-as-you-type returns local results within 150–250 ms of the debounce; server
   refresh updates freshness; filters work.
4. Detail shows headline assignment, organisation address, official contacts, related
   tenders and the correct data-quality label.
5. "Report incorrect information" posts the correction and suppresses the field locally;
   no bulk export affordance exists anywhere.
6. Beta-off (404) and no-entitlement (403) states render honest, distinct screens; the
   app never crashes on them.
7. Gates green: full `vitest`, `npx tsc --noEmit`, `eslint .`, `prettier --check .` —
   zero errors; `INTEGRATION_EVAL.md` updated; commits per task with the recorded
   subjects; spec status flipped to APPROVED before implementation.