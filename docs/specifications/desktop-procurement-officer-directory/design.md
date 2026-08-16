# Desktop — Procurement Officer Directory — Design

## Architecture

```
Parent API (read-only, source of truth)
  ├─ GET /procurement-officers/sync?cursor=…   ──► Sync runner ──► SQLite FTS5 local index
  ├─ GET /procurement-officers/search?q=…      ──► Server refresh (masked summaries)
  ├─ GET /procurement-officers/{id}            ──► Detail refresh
  ├─ GET /procurement-officers/{id}/tenders    ──► Related tenders
  └─ POST /procurement-officers/{id}/corrections ─► Dispute → local pending suppression

Desktop layers (all under desktop/tenders-sa-desktop/**):
  endpoints/procurement-officers.ts  → zod boundary (REQ-A12, INT-A2)
  features/procurement-officers/     → screen, search, detail, actions, states
  db/repositories/procurement-officers.ts → FTS5 + tables (owner-scoped)
  services/sync/procurement-officers-sync.ts → incremental runner (cursor)
```

The parent remains authoritative. The desktop never resolves identity, never computes
officialness, never re-derives suppressed state: it ingests, indexes and presents what
the feed and the read contracts expose. The feed is the only unmasked source, so the
local index is the single place official values live; every other surface stays masked
on the wire.

## Contract layer (`src/services/api/endpoints/procurement-officers.ts`)

Follows `tenders.ts` conventions: one module per feature, zod schemas per endpoint,
`bearerHeader` transport, parse at the boundary. Encode exactly:

- **search**: `{data: {rows: OfficerSummary[], meta}}` — summary contact fields are
  **masked strings** (`t***@dwa.gov.za`, `0***789`); keep them typed `string | null`
  and render as-is.
- **detail**: masked `contactPoints`, headline `assignments[0]` ordered `isCurrent desc`,
  `currentOrganisation` with `name` + `physicalAddress` only.
- **tenders**: paginated rows through evidence.
- **sync**: `{data: {rows: OfficerSyncRow[], nextCursor, hasMore, meta}}`;
  `OfficerSyncRow.contactPoints` and `.assignments` are **unmasked**; a tombstone row has
  `suppressed: true` with **empty** `contactPoints`/`assignments`.
- **corrections**: POST `{field, reason}` → `{status: 'pending'}`.

`ApiClients` gains `procurementOfficers` (wired in `auth-wiring.ts` like the other
clients).

## Local schema (migration `0005_procurement_officers.sql`)

All tables owner-scoped (`owner_id`), mirroring `sync-operations.ts` conventions:

```sql
CREATE TABLE procurement_officers (
  owner_id TEXT NOT NULL, id TEXT NOT NULL,
  canonical_name TEXT NOT NULL, first_name TEXT, last_name TEXT,
  current_title TEXT, current_organisation_id TEXT, province TEXT,
  kind TEXT NOT NULL, status TEXT NOT NULL,
  confidence_score REAL, first_seen_at TEXT, last_seen_at TEXT,
  verified_at TEXT, suppressed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE officer_contact_points (
  owner_id TEXT NOT NULL, officer_id TEXT NOT NULL, id TEXT NOT NULL,
  type TEXT NOT NULL, value TEXT NOT NULL,
  is_role_based INTEGER NOT NULL DEFAULT 0, is_official INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE officer_assignments (
  owner_id TEXT NOT NULL, officer_id TEXT NOT NULL, id TEXT NOT NULL,
  organisation_id TEXT, organisation_name TEXT, title TEXT,
  valid_from TEXT, valid_to TEXT, is_current INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL,
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE officer_tender_links (
  owner_id TEXT NOT NULL, officer_id TEXT NOT NULL, tender_id TEXT NOT NULL,
  source_field TEXT, observed_at TEXT, PRIMARY KEY (owner_id, officer_id, tender_id)
);
CREATE TABLE saved_officers (
  owner_id TEXT NOT NULL, officer_id TEXT NOT NULL, saved_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, officer_id)
);
CREATE TABLE officer_notes (
  owner_id TEXT NOT NULL, officer_id TEXT NOT NULL,
  note TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, officer_id)
);
CREATE TABLE procurement_officer_sync_state (
  owner_id TEXT PRIMARY KEY, cursor TEXT, last_sync_at TEXT
);
CREATE INDEX idx_officer_contacts_officer ON officer_contact_points(owner_id, officer_id);
CREATE INDEX idx_officer_assignments_officer ON officer_assignments(owner_id, officer_id);
CREATE INDEX idx_officer_tenders_officer ON officer_tender_links(owner_id, officer_id);
```

**FTS5** (external content over `procurement_officers`, plus denormalised join text):

```sql
CREATE VIRTUAL TABLE procurement_officers_fts USING fts5(
  owner_id UNINDEXED, officer_id UNINDEXED,
  search_text, content='', tokenize='porter unicode61'
);
```

`search_text` is built at ingest: `canonical_name | organisation_name | title | province |
all contact values | tender ids`. Insert/update/delete triggers are avoided; the
repository rebuilds the FTS row for an officer transactionally in the same ingest
(`delete officer_id row → insert`), keeping index and table consistent under the
existing `SqlExecutor` model. **Pre-check (TASK-1.2)**: verify the bundled SQLite
reports FTS5 (`pragma compile_options`); if absent, fall back to `LIKE` over the four
indexes above and record the deviation — never block on it.

## Repository layer (`src/db/repositories/procurement-officers.ts`)

Pure functions over `SqlExecutor`, matching `cache-entries.ts`/`sync-operations.ts`:

- `upsertOfficer(ownerId, row)` — insert-or-replace officer + its contact points +
  assignments + tender links in one transaction; rebuild the FTS row from the joined
  text.
- `applyTombstone(ownerId, officerId)` — delete officer + contacts + assignments +
  tender links + FTS row (POPIA: disputed facts do not persist locally).
- `searchOfficers(ownerId, {q, province, organisation, title, kind, status})` — FTS5
  MATCH with column filters; organisation/title/kind/status as indexed equality
  predicates.
- `getOfficer(ownerId, id)` / `getOfficerTenders(ownerId, id)` / `getOfficerAssignments`.
- `saveOfficer` / `listSavedOfficers` / `setOfficerNote` / `getOfficerNote` /
  `listRecentOfficerSearches` (via `local_preferences`).
- `getSyncState(ownerId)` / `setSyncState(ownerId, cursor)`.

## Sync runner (`src/services/sync/procurement-officers-sync.ts`)

- Trigger: app boot when signed in + every 15 minutes while online + manual "Sync now".
- Loop: read `sync_state.cursor` → `GET sync?cursor=&limit=200` → `setSyncState` on
  each page → repeat until `hasMore: false`; update `last_sync_at`.
- Tombstone rows → `applyTombstone`; regular rows → `upsertOfficer`.
- 404 → mark feature-off state (`featureState: 'off'`); 403 → mark
  `featureState: 'entitlement-missing'` and stop (keep the last good index, read-only).
- Never writes local audit rows: the parent audits every feed page; the desktop does
  not duplicate an audit trail it cannot keep authoritative.
- Runs via the existing `WorkspaceSyncCoordinator` pattern: a `useOfficerSync` hook
  exposes `{state, lastSyncAt, featureState, refresh}` and drives the single runner
  instance.

## UI (`src/features/procurement-officers/`)

- `ProcurementOfficerDirectory.tsx` — route component: search bar, filter row, result
  list, detail panel; assembles local + server results (`useOfficerSearch`).
- `use-officer-search.ts` — 150–250 ms debounce; local FTS5 query first; server refresh
  in flight; merged rows dedupe by id (server row wins for `status`/`lastSeenAt`,
  local row wins for contact values).
- `OfficerResultRow.tsx` — name, current title + organisation, province, data-quality
  label chip, freshness (from `lastSeenAt`), saved indicator.
- `OfficerDetailPanel.tsx` — headline assignment (isCurrent), organisation +
  physicalAddress, official contact points, related tenders, actions toolbar.
- `OfficerActions.tsx` — copy email/telephone (clipboard), mailto, save officer, notes
  editor, organisation profile link (existing company screen), related tenders.
- `CorrectionDialog.tsx` — field + reason; posts corrections; on success marks the
  field suppressed locally (`officerSuppressedFields` per account in
  `local_preferences`) and keeps it hidden until a later sync no longer carries it.
- `QualityLabel.tsx` — pure mapping of `status` + `lastSeenAt` → Verified /
  Recently observed (≤12 mo) / Historical (12–24 mo) / Unverified (>24 mo, or
  unverified status); thresholds are display constants.
- States: `FeatureOff.tsx` (parent 404), `EntitlementMissing.tsx` (403 banner, read-only
  index), `OfflineBanner.tsx` (last sync time). Nav item stays enabled; screens are
  honest (REQ-16).

## POPIA surface

- Only values the parent already classified official reach the UI: the feed's
  POPIA-filtered, unmasked official values in the local index; masked summaries from
  search/detail.
- Suppressed officer → tombstone → immediately removed locally. Disputed field →
  correction → locally hidden until the server resolves.
- No bulk export, no "export all", no CSV/JSON dump; single-contact copy/mailto only.
- Directory data never feeds marketing surfaces; the screen carries no consent language.

## Performance

- Local FTS5 `MATCH` first page ≤ 50 rows; server refresh debounced 150–250 ms and
  coalesced (latest query wins); sync pages bounded (`limit: 200`); one runner, no
  overlapping syncs (`last_sync_at` guard).