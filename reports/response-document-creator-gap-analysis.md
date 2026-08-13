# Response Documents Creator — Gap Analysis

- **Date**: 2026-08-13
- **Scope**: Desktop application — the "response documents creator" reachable through the **Draft** stage of the tender application assistance workflow (`Understand → Qualify → Plan → Draft → Review & Export`).
- **Author**: desktop-application agent (analysis only; no code changed)
- **Method**: Read the live desktop source and its Slice 3/4/5/6 specs, then diffed the shipped behaviour against the parent API contract and the desktop's own rules (`AGENTS.md`, `describe-error.ts` docblock, SQLite boundary).

## 1. What "the response documents creator" actually is

There are **two** authoring surfaces, and the gap analysis has to account for both:

1. **The full-screen editor** — `DraftStage.tsx` renders `ResponseDocumentEditor.tsx` in a modal overlay, with `ResponseDocumentNavigator.tsx` (left list) and `DraftDocumentReferences.tsx` (right brief + official-file downloads). Reached by:
   - the **Draft** stage link (`WorkflowNavigation.tsx` → `/applications/:id/draft`), and
   - the **Edit** action on a row in the Response Blueprint panel (`PlanStage.tsx:54` → `draftDocumentPath`).
2. **The inline row editor** — `ResponseBlueprintDocRow.tsx`, the per-document Generate / Edit / Save / Regenerate / Retry actions embedded in `ResponseBlueprintPanel.tsx` (Plan stage).

Both drive the same two parent mutations (`applications.ts`): `POST /assist/generate-response-doc` (`generateResponseDocument`, line 1061) and `PUT /assist/response-doc` (`saveResponseDocument`, line 1089), and both read state from `GET /assist/response-blueprint` via the shared `useResponseBlueprintWorkspace` hook.

## 2. What already works (for calibration)

The authoring flow is not greenfield. These are in place and correct:

- Dirty-state guard with a real decision dialog (`UnsavedChangesDialog.tsx`), `beforeunload` warning, Escape handling and a focus trap (`DraftStage.tsx:84-114`).
- Ctrl/Cmd+S save, silent Cancel-discard, no auto-save of mutations (R-W-7).
- Bounded follow-up refresh after a 202 — 4 s ticks × 15, stops when no key is `generating`, direct fetch with no loading flash (`use-response-blueprint-workspace.ts:50-79`).
- Stale-document-key recovery (does not silently substitute the first document, `DraftStage.tsx:154-208`).
- Entitlement/precondition honesty — but **only in the inline row** (`ResponseBlueprintDocRow.tsx:216-221`, `describe-error.ts:59-66`).

The gaps below are what is _missing or inconsistent_ on top of that foundation.

---

## 3. Gaps, ranked by severity

### G1 — Generate failures are silently swallowed in the full-screen editor (CRITICAL)

The full-screen editor's Generate button invokes the mutation with no error handling:

- `ResponseDocumentEditor.tsx:100` → `onClick={() => void onGenerate()}`
- `DraftStage.tsx:247` → `onGenerate={() => workspace.generate(key)}`
- `use-response-blueprint-workspace.ts:81-90` → `generate()` awaits the POST and only sets the `"generating"` overlay on success. A rejection (402 `SUBSCRIPTION_REQUIRED`, 409 `PRECONDITIONS_NOT_MET`, 401/403/500) propagates out of `generate()` and is discarded by `void`.

Result: in the full-screen editor, a 402 (upgrade required) or a 409 (required additional info unfilled) is a **complete no-op** — no message, no state change. The inline row handles both (`ResponseBlueprintDocRow.tsx:65-74` + `describeGenerateError`, tested in `module-screens.test.tsx:1430-1470`); the full-screen editor does **not**, and no test covers a failing generate in `DraftStage` (`draft-stage.test.tsx` mocks `generateResponseDocument` to resolve in every case).

The fix path is the same one the row already uses: catch in the editor and surface `describeGenerateError` (409 → "Complete the required additional information before generating.", 402 → "…needs a paid plan.").

### G2 — Generation outcome is not surfaced in the full-screen editor (HIGH)

`ResponseDocStatus` carries `error`, `isFallback` and `unresolvedPlaceholders` (`applications.ts:648-657`), and the parent can land a document in `state: "failed"`. The full-screen editor consumes **only** `state === "generating"` (`DraftStage.tsx:245`):

- No "failed" signal in the editor itself — the left navigator shows a "Failed" label (`ResponseDocumentNavigator.tsx:27-33`) but the editing pane offers no Retry affordance and no error text.
- `unresolvedPlaceholders` (the parent flags `{{...}}` tokens left in generated text) is never shown anywhere in the desktop.
- `isFallback` ("template" rather than AI content) is shown only as a chip in the inline row (`ResponseBlueprintDocRow.tsx:202`, "Saved · template"); the full-screen editor never tells the user whether they are looking at an AI draft or a template.

A user working in the full-screen editor therefore cannot tell whether their content is complete, templated, or contains unresolved placeholders.

### G3 — A stuck "Generating…" state locks the editor with no recovery (MEDIUM)

The refresh window is bounded at ~60 s (`POLL_INTERVAL_MS = 4000`, `POLL_MAX_TICKS = 15`, `use-response-blueprint-workspace.ts:10-11`). When generation outlives the window — or a poll tick's GET fails silently (`.catch(() => {})`, line 74) — `pendingKeys` clears while the overlay status stays `"generating"`. The editor then keeps `readOnly={generating}` (`ResponseDocumentEditor.tsx:129`) and disables every control, with no refresh/retry button in the full-screen editor. Recovery is only possible by leaving the stage and re-entering.

### G4 — No local draft persistence or offline editing, despite the sync infra existing (MEDIUM)

The desktop's SQLite boundary explicitly allows "offline workspace state … and pending sync operations" (`desktop AGENTS.md`), and the schema + repository exist (`db/schema/types.ts:46-59` `SyncOperationRow`, `db/repositories/sync-operations.ts`). But nothing in `features/applications` uses them — `enqueueSyncOperation` is referenced only by `tests/db-repositories.test.ts`.

The editor keeps its draft in React state alone (`ResponseDocumentEditor.tsx:21`) and saves via a direct synchronous PUT (`use-response-blueprint-workspace.ts:92-98`). Consequences:

- A crash / force-close loses all unsaved edits (the `beforeunload` guard only _warns_).
- There is no offline authoring; a lost connection makes the creator read-only in practice.

This is a "find it before you build it" observation: the local-first plumbing exists and is simply not wired to this surface.

### G5 — Two divergent editors implement the same actions inconsistently (MEDIUM)

`ResponseBlueprintDocRow.tsx` (inline) and `ResponseDocumentEditor.tsx` (full-screen) are two implementations of the same Generate/Save/Edit contract with different behaviour:

| Concern                   | Inline row                    | Full-screen editor                               |
| ------------------------- | ----------------------------- | ------------------------------------------------ |
| 402/409 generate handling | Yes (`describeGenerateError`) | **No** (G1)                                      |
| Failed-status Retry       | "Retry" label on `failed`     | No Retry; button still reads Generate/Regenerate |
| `isFallback` chip         | "Saved · template"            | Never shown                                      |
| Save UX                   | Save+Cancel buttons           | Save+Revert, dirty indicator, Ctrl+S             |

This is the same "parallel implementation" smell the parent `AGENTS.md` warns about, reproduced _inside_ the desktop app. One of the two should be the single owner of these rules, or the shared `useResponseBlueprintWorkspace` hook should own them.

### G6 — Raw server string rendered verbatim in the inline row (LOW)

`ResponseBlueprintDocRow.tsx:104-106` renders `status.error` directly — the parent's `__responseDocStatus[key].error` string. This conflicts with the desktop's own copy rule (`describe-error.ts:10-14`: "ApiError.message … and the parent's error string are never shown verbatim"). The same value is intentionally kept out of the full-screen editor (G2); the row should describe it, not echo it.

### G7 — No "regenerate with custom prompt" (LOW, deferred)

The parent mutation already accepts `prompt` (`applications.ts:1061-1078`), and Slice 4 explicitly deferred "regenerate with custom prompt" (`requirements.md:137`). Neither editor exposes the field, so the accepted contract is unused. Documented as an open opportunity, not a defect.

### G8 — No recovery of a prior generation (LOW)

Regenerate overwrites the saved content with no version history. "Revert" only discards _unsaved editor edits_ (`ResponseDocumentEditor.tsx:92-97`), not a completed regeneration. A worse AI draft cannot be rolled back to the previous saved version.

### G9 — No batch generate (LOW)

Each unsaved document needs an individual Generate press. There is no "generate all remaining" action, despite the Draft stage's purpose being coverage of every response document (`ReviewStage.tsx` already reports "N of M prepared").

### G10 — Document-references sidebar disappears on narrower windows (LOW)

`DraftDocumentReferences.tsx:66` renders `max-lg:hidden`, and the editor grid collapses the third column at `max-lg` (`DraftStage.tsx:231`) with **no alternative access** to the drafting brief, the "required by" info, or the official-file download buttons.

### G11 — Naive substring matching for related documents (LOW)

`relatedDocuments` (`DraftDocumentReferences.tsx:24-41`) matches `name.includes(term)` over kind/title terms, and returns _all_ documents when no terms match (line 34). This both over-matches ("quality" hits any filename containing that substring) and under-matches, and the "all documents" fallback defeats the "Likely related tender files" framing.

### G12 — The Draft stage is not a real "drafts menu" (LOW)

Navigating to `/applications/:id/draft` opens the **first** document full-screen immediately (`DraftStage.tsx:135-136`). There is no list/index landing view that shows every draft and its status at a glance; the only list is the navigator sidebar _inside_ the modal. For a workflow stage named "Draft", users land in a document rather than on a draft list.

---

## 4. Summary table

| #   | Severity | Gap                                                                           | Primary evidence                                                              |
| --- | -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| G1  | CRITICAL | Silent generate failure (402/409) in full-screen editor                       | `ResponseDocumentEditor.tsx:100`, `use-response-blueprint-workspace.ts:81-90` |
| G2  | HIGH     | Generation outcome (failed / fallback / unresolved placeholders) not surfaced | `DraftStage.tsx:245`, `applications.ts:648-657`                               |
| G3  | MEDIUM   | Stuck "Generating…" locks editor, no refresh                                  | `use-response-blueprint-workspace.ts:10-11,74`                                |
| G4  | MEDIUM   | No local draft / offline editing; sync infra unused                           | `ResponseDocumentEditor.tsx:21`, `db/repositories/sync-operations.ts`         |
| G5  | MEDIUM   | Two divergent editors for one contract                                        | `ResponseBlueprintDocRow.tsx` vs `ResponseDocumentEditor.tsx`                 |
| G6  | LOW      | Raw server error string shown verbatim                                        | `ResponseBlueprintDocRow.tsx:104-106`                                         |
| G7  | LOW      | `prompt` contract unused ("regenerate with custom prompt")                    | `applications.ts:1061-1078`, `requirements.md:137`                            |
| G8  | LOW      | No rollback of a regeneration                                                 | `ResponseDocumentEditor.tsx:92-97`                                            |
| G9  | LOW      | No batch generate                                                             | `ResponseBlueprintPanel.tsx:286-314`                                          |
| G10 | LOW      | References sidebar hidden below `lg`                                          | `DraftDocumentReferences.tsx:66`                                              |
| G11 | LOW      | Naive substring document matching                                             | `DraftDocumentReferences.tsx:24-41`                                           |
| G12 | LOW      | No draft-list landing view                                                    | `DraftStage.tsx:135-136`                                                      |

## 5. Recommended next steps

Consistent with maintenance mode ("fix/extend in place, don't build a parallel path"):

1. **G1 first** — it is a real silent work-loss / silent-blocker defect and is a one-file change in `ResponseDocumentEditor.tsx` (catch `onGenerate` rejection, reuse `describeGenerateError`), plus a `draft-stage.test.tsx` case for a failing generate.
2. **G2 + G6 together** — surface `failed`/`isFallback`/`unresolvedPlaceholders` in the full-screen editor using component-owned copy, and stop echoing `status.error` in the row.
3. **G5 as the structural fix** — decide a single owner for Generate/Save error rules (the shared `use-response-blueprint-workspace` hook is the natural place) so the two surfaces cannot drift again.
4. **G3** — add a refresh/retry affordance in the full-screen editor for a stale or failed status.
5. **G4** — evaluate wiring the existing `sync_operations` queue to the editor for local draft persistence; this is a feature (new behaviour) and per the desktop `AGENTS.md` would need a short spec before implementation.

G7–G12 are opportunitistic and should be triaged by the user; G7 and G9 in particular are feature-shaped and belong in a spec, not a quick fix.
