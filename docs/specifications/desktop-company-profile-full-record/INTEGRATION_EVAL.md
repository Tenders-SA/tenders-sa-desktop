# Desktop — Company Profile Full Record — INTEGRATION_EVAL (Slice 11)

- **Status**: not started — `SPEC_CONTRACT.md` is `PENDING APPROVAL`
- **Spec**: `desktop-company-profile-full-record/` (requirements R-C1..R-C15,
  design, tasks T1–T9)

## Parent contract audit (read from parent source, 2026-08-16)

Recorded here because these are the findings the slice exists to correct, and
because three of them are easy to rediscover the hard way.

| # | Finding | Evidence |
|---|---|---|
| F1 | The extended payload is fetched and then stripped — the desktop schema is a non-passthrough `z.object` keeping 8 of ~25 fields, and the Company Profile screen never calls it at all | `src/services/api/endpoints/company.ts:65-80`; `src/features/radar/TenderRadar.tsx:176` is the only caller |
| F2 | `GET /api/v1/company/profile/cidb` **does not exist** — the route exports only `POST`, so the desktop's call gets 405, which `kindForStatus` maps to `validation`, not `not-found`; the CIDB panel therefore errors on every load | parent `src/app/api/v1/company/profile/cidb/route.ts:19`; desktop `company.ts:249-266`, `errors.ts:95-103` |
| F3 | Experience contract value never renders — the desktop reads `value`/`endDate`, the parent sends `contractValue`/`completionDate`; the fields are `.optional()`, so nothing throws | desktop `company.ts:111-122` vs `prisma/user-domain.prisma:394-429`; broken render at `CompanyProfile.tsx:277` |
| F4 | Personnel qualifications never render — desktop reads `qualification`, parent sends `qualifications` | desktop `company.ts:126-135` vs `prisma/user-domain.prisma:439`; broken render at `CompanyProfile.tsx:307` |
| F5 | `POST /profile/extended` is a full replace: all seven profile fields are written unconditionally, so an omitted field is nulled | parent `extended/route.ts:184-218` |
| F6 | `PUT` validates more strictly than `POST` — bad email/URL/`clientType` is coerced to `null` on create but 400s on update | parent `experiences/route.ts:28-58` vs `experiences/[id]/route.ts:38-49` |
| F7 | `PUT` cannot clear a date — a falsy date maps to `undefined`, which Prisma ignores | parent `experiences/[id]/route.ts:101-102` |
| F8 | `POST /experiences` and `POST /personnel` 400 when no `CompanyProfile` row exists, so the UI must gate on it | parent `experiences/route.ts:97-103`, `personnel/route.ts:88-94` |
| F9 | Personnel writes return the singular key `person`; the list returns `personnel` | parent `personnel/route.ts:70,126-129` |
| F10 | `Company.contactEmail`, `contactPhone`, `website`, `openToJv`, `Company.directors` and `CompanyProfile.lastAssessedAt` are in the schema but serialised by **no** `/api/v1` route; `PUT /profile` ignores keys outside its eleven-field destructure | `prisma/user-domain.prisma:219-233,378`; parent `profile/route.ts:64-76` |

F10 is a limitation this slice documents rather than fixes: closing it needs a
parent change, which is a separately assigned task.

## Gates

| Gate | Task | Evidence | Date |
|---|---|---|---|
| Full extended schema + radar narrowing | T1 | — | — |
| Corrected experience/personnel fields | T2 | — | — |
| Dead CIDB call removed, write added | T3 | — | — |
| Write methods (extended, experience, personnel) | T4 | — | — |
| Shared stricter-bar validation | T5 | — | — |
| Read-path display (eight panels) | T6 | — | — |
| Mutation UI | T7 | — | — |
| Full suite + static gates | T8 | — | — |
| Live human verification | T9 | — | — |
