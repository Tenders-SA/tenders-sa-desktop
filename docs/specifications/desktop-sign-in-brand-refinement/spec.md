# Desktop sign-in brand refinement

**Status:** Approved by user directive, 2026-08-12
**Type:** Scoped maintenance change to the existing Slice 8 sign-in shell

## Problem

The existing two-column sign-in screen is functionally correct and already
communicates the bid lifecycle, but the introductory column reads like a narrow
feature list. It does not yet convey the authority, focus, and calm expected of
a serious business workspace for preparing tender submissions.

## User task

- **Audience:** South African business owners and bid teams
- **Primary job:** Sign in and continue preparing tender applications
- **Message before sign-in:** This is a focused, private working environment for
  moving from a suitable opportunity to a submission-ready response
- **Primary action:** Sign in
- **Secondary action:** None; the brand panel remains non-interactive

## Approach

Refine the existing `SignInBrandPanel` in place:

- retain the Tenders-SA Desktop identity and the real Discover → Analyse →
  Prepare → Submit workflow;
- replace generic feature bullets with procurement-job language centred on
  qualification, document review, response preparation, and submission control;
- introduce stronger visual hierarchy and restrained business-application
  framing using the existing semantic dark-theme tokens;
- keep the brand panel hidden below the existing `lg` breakpoint;
- preserve the form, auth flow, connectivity footer, keyboard order, and all
  existing sign-in failure behaviour.

## Impact map

| Surface | Change | Risk control |
|---|---|---|
| `SignInBrandPanel.tsx` | Copy and presentation hierarchy | Existing component extended; no new screen or design system |
| `sign-in-shell.test.tsx` | Pin the focused-workspace message | Existing auth tests remain untouched |

No parent API, auth service, Tauri capability, route, storage, schema, or
application-shell behaviour changes. No new dependency or raster asset.

## Acceptance

- The first screen clearly presents the desktop app as a focused tender-response
  workspace rather than a smaller copy of the website.
- Copy speaks to business users and names concrete procurement work.
- No unverified quantity or pre-auth account claim is introduced.
- The brand panel contains no focusable element; the first Tab remains Email.
- Existing semantic tokens, dark-only theme, four-stage mapping, reduced-motion
  behaviour, and responsive fallback remain intact.
- Focused tests, TypeScript, lint, and formatting checks pass.
