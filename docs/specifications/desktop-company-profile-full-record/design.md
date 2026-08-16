# Desktop — Company Profile Full Record — Design (Slice 11)

> Read `requirements.md` first. Hazard references (H1–H6) and requirement
> references (R-C1–R-C15) are defined there.

## 1. Shape of the change

Nothing new is built. The screen already exists, the endpoint class already
exists, and the parent already serves everything this slice displays. Three
things change:

1. `CompanyEndpoint` stops discarding the extended payload and gains the write
   methods for contracts it already knows about.
2. `CompanyProfileScreen` reads one rich record instead of four thin ones.
3. Two record editors (experience, personnel) and one profile editor are added
   next to the existing `CompanyProfileEditor`, which is left alone.

## 2. Read path — one call, not four

Today the screen fires four parallel `useAsync` loads: `getProfile`,
`getExperiences`, `getPersonnel`, `getCidb` (`CompanyProfile.tsx:25-37`). Three
of them are redundant and one of them is broken.

`GET /profile/extended` already returns company, profile, experiences,
keyPersonnel and completeness in a single response
(`extended/route.ts:102-134`). The screen switches to:

| Read | Purpose |
|---|---|
| `getExtendedRecord()` | the whole record (R-C1) |
| `getProfile()` | retained **solely** for company `createdAt`/`updatedAt`, which the extended route does not serialise (R-C4) |

`getExperiences()` and `getPersonnel()` remain on the endpoint — they are the
list reads the mutation flows re-read after a write — but the screen no longer
calls them on first paint. `getCidb()` is **deleted** (R-C8): its route has no
`GET` handler, so every call was a 405 rendered as an error panel.

### Empty-state discrimination (R-C2)

The extended route separates two states the current screen conflates:

```
404                     -> no Company row at all
{ profile: null, ... }  -> Company exists, no CompanyProfile row
```

The first is an account-setup problem the desktop cannot solve and directs the
user to the web app. The second is actionable here: it is what `POST
/profile/extended` creates, and it is also why `POST /experiences` and `POST
/personnel` would answer 400 (R-C13). The screen therefore gates the two "Add"
affordances on `profile !== null` and offers "Set up company profile" instead.

## 3. Schemas

### 3.1 Why the current one loses data

`radarExtendedProfileSchema` (`company.ts:65-80`) is a plain `z.object`. Zod
strips unknown keys by default, so every field it does not name is gone before
any consumer sees it — silently, because stripping is not an error.

The replacement is one `extendedRecordSchema` that names every serialised
field. `RadarExtendedProfile` is **kept as a derived narrowing** so
`radar-workspace-model.ts` and its tests are untouched (R-C15):

```ts
export type ExtendedCompanyRecord = z.infer<typeof extendedRecordSchema>;

/** The six signals the Radar completeness card reads. Unchanged shape. */
export type RadarExtendedProfile = {
  company: Pick<..., "id" | "name" | "registrationNumber" | "bbbeeLevel"
                   | "industryCodes" | "annualTurnover">;
  profile: { companyType?: ...; cidbGrading?: ... } | null;
};
```

`getExtendedProfile()` keeps its exact current signature and projects the
narrow shape out of the full parse, so the Radar contract is preserved by
construction rather than by convention.

### 3.2 Tolerant JSON columns (H5)

`equipmentAssets`, `operationalCapacity`, `professionalBodies` and
`missingFields` are `Json?`. The documented shapes are parsed when they match;
anything else is preserved as `unknown` and rendered by the existing
`KeyValues`-style fallback rather than dropped:

```ts
const jsonRecord = z.unknown().nullable().optional();
```

Typed accessors (`equipmentAssetList`, `operationalCapacityFields`,
`professionalBodyList`) do the narrowing at the display boundary and return
`[]`/`undefined` for shapes they do not recognise. A malformed row degrades to
"shown as raw values", never to a crash or a blank panel — the same principle
as the existing `stringList` tolerance (`company.ts:34-42`).

### 3.3 Corrected record schemas (R-C6, R-C7)

`experienceSchema` gains the parent's real field names and loses the three that
never existed:

| Removed (never sent) | Added |
|---|---|
| `value`, `endDate`, `title` | `contractValue`, `completionDate`, `clientType`, `currency`, `referenceContact`, `referenceEmail`, `categoryRelevance`, `provinceRelevance`, `completionCertUrl`, `referenceLetterUrl`, `createdAt`, `updatedAt` |

`personnelSchema` likewise: `qualification` → `qualifications`, drop `name`,
add `department`, `certifications`, `cvUrl`, `email`, `phone`, timestamps.

`experienceTitle()` and `personnelName()` keep their names and their
"unnamed" fallbacks; only the dead alias branch goes. Both stay
`.passthrough()`.

## 4. Write path

### 4.1 The full-replace hazard (H1) — one method, complete bodies

`POST /profile/extended` writes all seven profile fields unconditionally. A
"just save the CIDB grade" call that omits `profileText` **erases**
`profileText`. This is the single most dangerous fact in the slice, so the
design removes the opportunity to get it wrong:

```ts
saveExtendedProfile(profile: ExtendedProfileWrite): Promise<...>
```

`ExtendedProfileWrite` requires **all seven** fields — no `Partial`, no
optional keys beyond what the parent itself allows to be null. Callers build it
by spreading the loaded profile and overriding what changed, so a field can
only be nulled deliberately. `companyType` is non-optional in the type, which
enforces H2 at compile time.

### 4.2 CIDB writes go through the dedicated route (R-C12)

`POST /profile/cidb` writes exactly `cidbGrading` and touches nothing else. For
a CIDB-only edit that is strictly safer than the full-replace route, so
`setCidbGrading(grade)` uses it. It 400s when no `CompanyProfile` row exists,
which the profile gate (§2) already prevents.

### 4.3 Validation at the stricter bar (H3)

`POST` coerces bad input to `null`; `PUT` rejects it with 400. Validating only
to the `POST` bar produces records that can be created and then never edited.
Client-side validation therefore uses one shared module applied to **both**
create and update:

| Field | Rule |
|---|---|
| `referenceEmail`, `email` | must match the parent's email test or be empty |
| `completionCertUrl`, `referenceLetterUrl`, `cvUrl`, `profileDocument` | must parse as a `URL` or be empty |
| `clientType` | exactly `Government` \| `Private` \| `SOE` or empty |
| `yearsExperience` | non-negative integer or empty |

Empty means "omit the key", not "send `null`" — see H4.

### 4.4 Dates cannot be cleared on update (H4)

`PUT` maps a falsy date to `undefined`, which Prisma ignores, so a stored date
survives any attempt to clear it. The edit form does not offer a clear
affordance for `startDate`/`completionDate`; the field help states that a date
can be changed but not removed from the desktop. This is an honest surfacing of
the parent contract, not a workaround.

### 4.5 Response keys

`POST`/`PUT /personnel*` return `{ person }`; the list returns `{ personnel }`
(H-note in requirements). `POST`/`PUT /experiences*` return `{ experience }`;
the list returns `{ experiences }`. `DELETE` returns `{ message }` only, so the
caller re-reads rather than patching local state from the response.

### 4.6 Refresh after mutation (R-C14)

Every mutation calls the screen's `reload()` for the extended record. That is
one extra request per save, deliberately: `completenessScore` and
`missingFields` are computed server-side from the very rows just changed
(`extended/route.ts:56-84`), so a locally patched list would show a stale
completeness figure next to fresh data. Correctness beats the round trip.

Failures render through `describeApiError(error, subject)` — the parent's
`error` strings are never shown verbatim (established rule, Slice 7 §7).

## 5. Screen composition

`ProfileOverview` grows from five panels to eight. Existing components
(`Panel`, `AsyncSection`, `Row`, `ListOrEmpty`, `notRecorded`) are reused as-is.

| Panel | Source | New? |
|---|---|---|
| Completeness header | `completeness.score` + `missingFields` checklist | **new** (R-C3) |
| Company record | `company.*` + timestamps from bare `/profile` | extended (R-C4) |
| Industries & certifications | `company.industryCodes`, `certifications` | unchanged |
| Company profile | `companyType`, `cidbGrading`, `profileText`, `profileDocument` | **new** (R-C5) |
| Operational capacity | `profile.operationalCapacity` | **new** (R-C5) |
| Equipment & assets | `profile.equipmentAssets` | **new** (R-C5) |
| Professional bodies | `profile.professionalBodies` | **new** (R-C5) |
| Project experience | full record + add/edit/delete | extended (R-C6, R-C9) |
| Key personnel | full record + add/edit/delete | extended (R-C7, R-C10) |

The CIDB panel is not removed — it moves into "Company profile", fed by
`profile.cidbGrading` instead of the dead `GET` (R-C8).

`CompanyProfileEditor` is untouched. It edits the eleven company-level fields
`PUT /profile` accepts, and that route ignores anything else, so widening it
would be a lie. The new profile editor is a separate component targeting
`POST /profile/extended`.

Record editors are inline forms within their panel rather than modals,
matching the existing `AdditionalInfoPanel` pattern, and deletes ask for
confirmation inline — no browser `confirm()`, which is blocked in the Tauri
webview by policy.

## 6. Files

| File | Change |
|---|---|
| `src/services/api/endpoints/company.ts` | full extended schema, corrected record schemas, `saveExtendedProfile`, `setCidbGrading`, experience + personnel create/update/delete, delete `getCidb` |
| `src/features/company/CompanyProfile.tsx` | single extended read, eight panels, mutation wiring |
| `src/features/company/company-record-validation.ts` | **new** — shared create/update validation (§4.3) |
| `src/features/company/ExperienceEditor.tsx` | **new** |
| `src/features/company/PersonnelEditor.tsx` | **new** |
| `src/features/company/ExtendedProfileEditor.tsx` | **new** |
| `src/tests/fixtures/api-clients.ts` | new endpoint members |
| `src/tests/module-endpoints.test.ts` | contract tests per verb |
| `src/tests/module-screens.test.tsx` | display + mutation tests |

`radar-workspace-model.ts`, `TenderRadar.tsx` and their tests are **not**
edited (R-C15).

## 7. What this design refuses to do

- No parent-repository change, including the missing `GET /profile/cidb`
  handler — the value is available from the extended route, so the desktop does
  not need it.
- No local SQLite caching of the company record. It is canonical parent state,
  and the local store is limited to cache/offline-workspace state; a mutation
  flow that could diverge from the server's computed completeness is worse than
  a network round trip.
- No offline queueing of these writes. Company profile edits feed tender
  matching recalculation server-side (`extended/route.ts` and both record
  routes trigger it); deferring them would silently defer matching.
- No new Tauri capability. Every call is an ordinary authenticated request to
  the already-allowed API origin.
