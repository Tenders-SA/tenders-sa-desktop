# Desktop company profile studio

**Status:** Approved by user directive, 2026-08-12
**Type:** Scoped extension of the existing Company Profile screen

## Problem

The desktop already reads the canonical company profile, project experience,
personnel, and CIDB endpoints, but the screen is deliberately read-only and does
not load CIDB at all. Tender Radar and response preparation depend on these
company inputs, so forcing the user back to the website breaks the desktop
workflow.

## Approach

- Add `CompanyEndpoint.updateProfile()` for the existing authenticated
  `PUT /api/v1/company/profile` contract.
- Replace the read-only summary with a desktop profile studio: Overview and Edit
  modes, section navigation, deliberate Save/Cancel controls, profile completeness
  feedback, and unsaved-change protection inside the screen.
- Edit every field owned by the canonical core route: identity, registration and
  tax numbers, B-BBEE, certificate URL, company size, annual turnover,
  industries, provinces, certifications, and capabilities.
- Preserve arbitrary existing industry/certification values through editable
  newline lists; do not constrain canonical data to a guessed catalogue.
- Align certification entry with the web profile builder: infer or select a
  primary industry, present that industry's required and recommended
  certification options, and retain saved custom/legacy certification values.
- Load and display project experience, personnel, and CIDB alongside the core
  profile. These remain read-only because they have separate endpoint contracts.
- Never autosave. A human explicitly commits profile changes.

## Impact map

| Surface | Change | Risk control |
|---|---|---|
| `company.ts` | Typed PUT adapter | Exact existing parent contract and response schema |
| `CompanyProfile.tsx` | Full profile workspace | Canonical record only; explicit save |
| `CompanyProfileEditor.tsx` | Sectioned desktop editor | Controlled fields and array-safe conversion |
| `company-certification-options.ts` | Desktop presentation of the web builder catalogue | Uses the canonical saved IDs; no API contract change |
| Company endpoint/screen tests | Read/write, cancel, error, CIDB | Prevent matching-input corruption |

No parent repository, database, auth, Tauri capability, schema, local profile
copy, or new dependency.

## Acceptance

- All core profile fields load into the editor without loss.
- Save sends arrays as arrays, optional numbers as numbers/null, and blank
  optional strings as null.
- The saved response becomes the visible profile without a second request.
- Cancel restores the last server-saved values.
- Save errors keep the draft intact and present an actionable error.
- Certification choices change with the primary industry, explain the issuing
  body and requirement status, and never silently discard saved custom values.
- Experience, personnel, and CIDB remain visible and independently retryable.
- No autosave or automated company decision is introduced.
- Focused tests, TypeScript, lint, and formatting pass.
