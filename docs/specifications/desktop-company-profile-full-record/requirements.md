# Desktop — Company Profile Full Record — Requirements (Slice 11)

**Context**: The Company Profile screen
(`src/features/company/CompanyProfile.tsx`) presents a *fraction* of the
company record the parent already serves. Three separate defects cause it,
and all three are in desktop code:

1. **The richest read contract is fetched, then discarded.**
   `GET /api/v1/company/profile/extended` returns company + `profile` +
   `experiences` + `keyPersonnel` + `completeness`. The desktop's
   `radarExtendedProfileSchema` (`src/services/api/endpoints/company.ts:65-80`)
   is a **non-passthrough** zod object that keeps 8 fields and strips the rest,
   and the Company Profile screen never calls it at all — only
   `TenderRadar.tsx:176` does. Invisible on desktop today: `companyType`,
   `profileText`, `profileDocument`, `equipmentAssets`, `operationalCapacity`,
   `professionalBodies`, `completenessScore`, `missingFields`.

2. **The CIDB panel calls a route with no `GET` handler.**
   `getCidb()` (`company.ts:249-266`) issues `GET /api/v1/company/profile/cidb`,
   but that route file exports **only `POST`**
   (`src/app/api/v1/company/profile/cidb/route.ts:19`). Next.js answers 405,
   which `kindForStatus` maps to `"validation"` (`errors.ts:95-103`) — not
   `not-found` — so the endpoint's 404 guard does not swallow it and the panel
   renders an error on every load. The real value is already in hand at
   `extended.profile.cidbGrading`.

3. **Experience and personnel field names do not match the parent, so data
   silently vanishes.** The desktop declares `value`, `endDate`, `title`
   (`company.ts:111-122`) where the parent returns `contractValue`,
   `completionDate`, `projectName`; and `qualification` (singular,
   `company.ts:126-135`) where the parent returns `qualifications`. Because the
   fields are `.optional()`, nothing throws — the values are simply always
   `undefined`, so the ZAR contract value at `CompanyProfile.tsx:277` and the
   qualification suffix at `CompanyProfile.tsx:307` **never render**.

Beyond display, the parent exposes complete write contracts for this data that
the desktop does not use at all: the extended profile, project experience and
key personnel can each be created, updated and deleted.

## Parent contracts (read from parent source today, 2026-08-16)

| Route | Methods | Notes |
|---|---|---|
| `/api/v1/company/profile` | `GET`, `PUT` | Bare company record. `GET` 404s when the user has no Company. Only source of company `createdAt`/`updatedAt`. |
| `/api/v1/company/profile/extended` | `GET`, `POST` | Full record. `GET` 404s only when **no Company** exists; when a Company exists without a `CompanyProfile` row it returns `profile: null`, `experiences: []`, `keyPersonnel: []`. |
| `/api/v1/company/profile/cidb` | `POST` **only** | No `GET`. Single-field write of `cidbGrading`; 400 when no `CompanyProfile` row. |
| `/api/v1/company/experiences` | `GET`, `POST` | List returns `{ experiences }`. `POST` 400s with *"Company profile not found…"* when no `CompanyProfile` row. |
| `/api/v1/company/experiences/[id]` | `GET`, `PUT`, `DELETE` | Returns `{ experience }` / `{ message }`. |
| `/api/v1/company/personnel` | `GET`, `POST` | List returns `{ personnel }`; **`POST` returns `{ person }`** (singular key). |
| `/api/v1/company/personnel/[id]` | `GET`, `PUT`, `DELETE` | Returns `{ person }` / `{ message }`. |

### Contract hazards this slice must respect

- **H1 — `POST /profile/extended` is a full replace, not a patch.** It writes
  all seven profile fields unconditionally (`extended/route.ts:184-218`). A
  body that omits `profileText` nulls `profileText`. Every save must carry the
  complete current profile state.
- **H2 — `companyType` is required** by that route's schema
  (`z.nativeEnum(CompanyType)`, not `.optional()`,
  `extended/route.ts:33`). Enum: `SOLE_PROPRIETOR`, `CLOSE_CORPORATION`,
  `PTY_LTD`, `PUBLIC_COMPANY`, `NPO`, `COOPERATIVE`, `JOINT_VENTURE`, `OTHER`.
- **H3 — `PUT` validates more strictly than `POST`.** On create, an invalid
  `referenceEmail`, `clientType` or URL is coerced to `null`
  (`experiences/route.ts:28-58`); on update the same value is a **400**
  (`experiences/[id]/route.ts:38-49`). Client-side validation must therefore
  meet the stricter `PUT` bar on create too, or a record can be created that
  can never be edited.
- **H4 — `PUT` cannot clear a date.** `startDate: validatedData.startDate ?
  new Date(...) : undefined` (`experiences/[id]/route.ts:101-102`) — sending
  `null` leaves the stored value untouched.
- **H5 — `equipmentAssets`, `operationalCapacity`, `professionalBodies` and
  `missingFields` are `Json?` columns** (`prisma/user-domain.prisma:368-377`).
  Rows written by other paths may hold shapes the documented schema does not
  describe.
- **H6 — `PreviousExperience.currency` is a free string** defaulting to `ZAR`
  (`prisma/user-domain.prisma:405`); amounts must be formatted with the
  record's own currency.

## Requirements

| # | Requirement | Verification |
|---|---|---|
| R-C1 | The screen reads the **full** extended payload: every `company`, `profile`, `experiences`, `keyPersonnel` and `completeness` field the route serialises is parsed and reachable in typed form. No field the parent sends is dropped by the schema. | endpoint contract test asserts a full fixture round-trips field-for-field |
| R-C2 | Distinguish the two empty states the route distinguishes: 404 → no Company ("finish account setup on the web app"); `profile: null` → Company without an extended profile ("set up your company profile"), offering the create path. | endpoint + screen tests for both |
| R-C3 | Display completeness as `completenessScore` plus an explicit checklist of `missingFields`, so the user sees what is still absent rather than only a number. | screen test asserts score and each missing label render |
| R-C4 | Display every company-record field, including the ones never shown today: `bbbeeCertificateUrl`, `createdAt`, `updatedAt` (the latter two from the bare `/profile` read, the only route that serialises them). | screen test |
| R-C5 | Display every extended-profile field: `companyType`, `cidbGrading`, `profileText`, `profileDocument`, `operationalCapacity` (staff, vehicles, premises owned, premises size), `equipmentAssets` (name/quantity/value) and `professionalBodies` (name/membership number/expiry). Unrecognised JSON shapes render as readable key/value rather than crashing or being hidden (H5). | screen tests incl. a malformed-JSON fixture |
| R-C6 | Correct the experience field mapping to the parent's real names (`contractValue`, `completionDate`, `projectName`; drop the dead `value`/`endDate`/`title` aliases) and display the whole record: client name, client type, value in the record's own currency (H6), start and completion dates, description, reference contact and email, category and province relevance, completion-certificate and reference-letter URLs. | endpoint test pins names; screen test asserts a full row |
| R-C7 | Correct the personnel field mapping (`qualifications`; drop the dead `name` alias) and display the whole record: full name, role, department, qualifications, certifications, years of experience, CV URL, email, phone. | endpoint + screen tests |
| R-C8 | Remove `getCidb()` and its dead `GET /profile/cidb` call; CIDB grading is read from `extended.profile.cidbGrading`. | endpoint test asserts no request is made to that path on load |
| R-C9 | Create, update and delete **project experience** records through the parent's existing routes, with client-side validation at the stricter `PUT` bar (H3) and no date-clearing affordance (H4). | endpoint tests per verb; screen tests for add/edit/delete |
| R-C10 | Create, update and delete **key personnel** records likewise, reading the singular `person` key on write responses. | endpoint + screen tests |
| R-C11 | Save the extended profile through `POST /profile/extended` as a **complete** body merged from loaded state, never a partial one (H1), with `companyType` always present (H2). | endpoint test asserts an unmodified field survives a single-field edit |
| R-C12 | Write `cidbGrading` through the dedicated `POST /profile/cidb` route rather than the full-replace extended route, so a CIDB edit cannot clobber the rest of the profile. | endpoint test |
| R-C13 | Adding experience or personnel is gated behind an existing `CompanyProfile` row and routes the user to profile setup first, rather than letting the parent answer 400. | screen test with `profile: null` |
| R-C14 | Every mutation refreshes the record so completeness and the lists stay truthful; failures surface through `describeApiError` and never show a parent `error` string verbatim. | screen tests for success and failure |
| R-C15 | `TenderRadar`'s existing consumption of `getExtendedProfile` keeps working unchanged — the six Radar signals and `radar-workspace-model` behaviour are invariant. | existing radar tests stay green without edits to their assertions |

## Known limitations (documented, not fixed here)

Per the desktop role contract, the parent is read-only for this slice. The
following exist in `prisma/user-domain.prisma` but **no `/api/v1` route
serialises them**, so the desktop cannot show them and will not gain a parent
change to do so:

- `Company.contactEmail`, `Company.contactPhone`, `Company.website`,
  `Company.openToJv` (`user-domain.prisma:219-224`)
- `Company.directors` (`Director[]`, `user-domain.prisma:233`) — no
  `/api/v1/company/directors` route exists
- `CompanyProfile.lastAssessedAt` (`user-domain.prisma:378`) — held but not
  serialised by the extended route

`PUT /profile` (bare) also silently ignores any company field outside its
eleven-key destructure, so company-level contact details cannot be written
either.

## Explicitly out of scope

Parent-repository changes of any kind; document upload for `profileDocument`,
`cvUrl`, `completionCertUrl` or `referenceLetterUrl` (URLs are entered, not
uploaded — upload is the Document Vault's concern); offline queueing of these
mutations; the Radar completeness card's own layout; company logo or showcase
profile.
