# Desktop — Company Profile Full Record — Tasks (Slice 11)

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status (2026-08-16)

- T1–T8: NOT STARTED — `SPEC_CONTRACT.md` is `PENDING APPROVAL`.

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | **Schemas** — replace `radarExtendedProfileSchema` with a full `extendedRecordSchema` covering every field the extended route serialises; keep `RadarExtendedProfile` as a derived narrowing and `getExtendedProfile()`'s signature identical; tolerant `Json?` handling for `equipmentAssets`, `operationalCapacity`, `professionalBodies`, `missingFields` (H5) | full suite green at HEAD | `vitest module-endpoints` — full-fixture round-trip; existing radar tests pass **unedited** |
| T2 | **Corrected record schemas** — `experienceSchema`: add `contractValue`, `completionDate`, `clientType`, `currency`, `referenceContact`, `referenceEmail`, `categoryRelevance`, `provinceRelevance`, `completionCertUrl`, `referenceLetterUrl`, timestamps; drop `value`/`endDate`/`title`. `personnelSchema`: `qualification` → `qualifications`; drop `name`; add `department`, `certifications`, `cvUrl`, `email`, `phone`, timestamps | T1 green | `vitest module-endpoints` — a parent-shaped fixture yields a populated contract value and qualifications |
| T3 | **Delete `getCidb`** and its `GET /api/v1/company/profile/cidb` call; add `setCidbGrading(grade)` on `POST /profile/cidb`; remove `getCidb` from fixtures and from the screen | T2 green | `vitest` — no request to that path on load; `setCidbGrading` pins method + path |
| T4 | **Write methods** — `saveExtendedProfile(complete)` on `POST /profile/extended` with an all-fields-required type (H1, H2); `createExperience`/`updateExperience`/`deleteExperience`; `createPersonnel`/`updatePersonnel`/`deletePersonnel`, reading the singular `person` key on writes | T3 green | `vitest module-endpoints` — one case per verb; a single-field extended edit provably re-sends untouched fields |
| T5 | **Shared validation** — `company-record-validation.ts` enforcing the stricter `PUT` bar (email, URL, `clientType` enum, non-negative integer) on **both** create and update; empty means omit the key, never send `null` (H3, H4) | T4 green | unit tests per rule |
| T6 | **Read-path display** — single extended read + bare `/profile` for company timestamps; the two empty states discriminated (R-C2); eight panels incl. completeness score + missing-field checklist, extended profile, operational capacity, equipment, professional bodies, full experience and personnel records | T5 green | `vitest module-screens` — full-record fixture asserts each field; malformed-JSON fixture degrades gracefully |
| T7 | **Mutation UI** — `ExtendedProfileEditor`, `ExperienceEditor`, `PersonnelEditor`; inline confirm on delete (no `confirm()`); add-affordances gated on `profile !== null` (R-C13); every mutation reloads the record; errors via `describeApiError` | T6 green | `vitest module-screens` — add/edit/delete per record type, gated state, failure copy |
| T8 | **Gates + docs** — fixtures updated; full `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .`; update `tasks.md` + `INTEGRATION_EVAL.md` in the same commit; commit + push | T7 green | zero errors |
| T9 | **Human verification** — user opens Company Profile against a real account and confirms: every stored field appears, completeness score and missing list are right, CIDB shows instead of erroring, contract values and qualifications render, and add/edit/delete round-trips for an experience and a personnel record | T8 shipped | recorded in `INTEGRATION_EVAL.md` |

## Ordering rationale

T1–T2 are pure schema widening and are independently verifiable: after them the
data is *reachable* even though nothing renders it yet. T3 removes the broken
call before any new UI depends on its panel. T4–T5 land the write path with its
validation before any form can call it, so no form can be built against an
unvalidated method. Only then does UI land (T6 read, T7 write), which keeps
every screen test written against a settled contract.

## Do not

- Edit `radar-workspace-model.ts`, `TenderRadar.tsx`, or their test assertions
  (R-C15). If a radar test fails, T1's narrowing is wrong — fix the narrowing.
- Send a partial body to `POST /profile/extended` (H1).
- Add a `GET` handler to the parent's cidb route, or any other parent change.
- Run `npm run build` / `next build` / prisma migrations.
