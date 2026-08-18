# Desktop — Company Profile Full Record — SPEC_CONTRACT (Slice 11)

- **Status**: `APPROVED`
- **Date**: 2026-08-16
- **Scope**: Slice 11 — surface the entire company record and add record CRUD
  (R-C1..R-C15).
- **Approved by**: user (in-session directive, 2026-08-16)
- **Approval date**: 2026-08-16

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Full extended schema | `extendedRecordSchema` names every field `/api/v1/company/profile/extended` serialises; `Json?` columns parsed tolerantly; nothing silently stripped |
| C2 | Radar invariance | `getExtendedProfile()` signature and `RadarExtendedProfile` shape unchanged, derived by narrowing; `radar-workspace-model.ts`, `TenderRadar.tsx` and their test assertions **not edited** |
| C3 | Corrected record fields | experiences use `contractValue`/`completionDate`/`projectName` and drop `value`/`endDate`/`title`; personnel use `qualifications` and drop `name`; both carry the parent's full field set |
| C4 | Dead CIDB call removed | `getCidb()` and its `GET /profile/cidb` deleted; grading read from `extended.profile.cidbGrading`; writes go through `POST /profile/cidb`, never the full-replace route |
| C5 | Full-replace safety | `saveExtendedProfile` takes an all-fields-required body with mandatory `companyType`; no partial body to `POST /profile/extended` is representable in the type |
| C6 | Record CRUD | create/update/delete for experiences and personnel on the existing parent routes; write responses read the singular `person` / `experience` keys; `DELETE` triggers a re-read, never a local patch |
| C7 | Stricter-bar validation | one shared validation module applied to create **and** update (email, URL, `clientType` enum, non-negative integer); empty omits the key rather than sending `null`; no date-clearing affordance |
| C8 | Empty-state discrimination | 404 → "finish account setup on the web app"; `profile: null` → "set up your company profile", with add-affordances for experience and personnel gated behind an existing profile |
| C9 | Display completeness | `completenessScore` shown with an explicit `missingFields` checklist |
| C10 | Refresh + error copy | every mutation reloads the extended record; `ApiError.message` / parent `error` strings never shown verbatim — `describeApiError` only |
| C11 | Verification gates | full `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .` — zero errors |
| C12 | Human verification | user confirms against a real account: all fields present, completeness correct, CIDB renders, contract values and qualifications render, add/edit/delete round-trips; recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

Parent-repository changes of any kind (including adding the missing `GET`
handler to the cidb route); file **upload** for `profileDocument`, `cvUrl`,
`completionCertUrl`, `referenceLetterUrl` — URLs are typed, not uploaded;
offline queueing of company mutations; local SQLite caching of the company
record; the Radar completeness card's layout; company logo and showcase
profile; company-level contact fields and directors (see "Known limitations").

## Known limitations carried forward

`Company.contactEmail`, `contactPhone`, `website`, `openToJv`,
`Company.directors` and `CompanyProfile.lastAssessedAt` exist in the parent
schema but **no `/api/v1` route serialises them**, and `PUT /profile` ignores
any key outside its eleven-field destructure. The desktop documents this and
does not display or write them. Resolving it would require a parent change,
which is a separately assigned task.

## Non-negotiable constraints

- **No partial body to `POST /api/v1/company/profile/extended`.** It writes all
  seven profile fields unconditionally; an omitted field is nulled. Every save
  carries complete state merged from the loaded record.
- **Client-side validation meets the `PUT` bar on create.** The parent's `POST`
  coerces bad input to `null` while `PUT` 400s on it; validating only to the
  `POST` bar yields records that cannot afterwards be edited.
- **Dates cannot be cleared through `PUT`** — the route maps a falsy date to
  `undefined`. The UI must not imply otherwise.
- The parent backend stays the source of truth; no second store, no derived
  copy of the company record in local SQLite.
- No new Tauri capability; no `shell:`, no `opener:`, no widened http scope.
- No `npm run build` / `next build` / prisma migrations (repo rule).
