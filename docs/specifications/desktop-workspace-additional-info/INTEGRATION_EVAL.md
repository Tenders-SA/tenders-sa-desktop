# Desktop Workspace — Additional-Info Q&A — INTEGRATION_EVAL (Slice 2)

- **Status**: pending
- **Date**: 2026-08-08

## Live verification checklist

| # | Check | Result |
|---|---|---|
| 1 | Q&A panel renders the live tender's fields (probe app: 6) with labels/placeholders/help | pending |
| 2 | Saved answers pre-fill on reload (GET returns `values`) | pending |
| 3 | Filling all required fields + "Save answers" → PUT `{values}` → "Saved" badge, `unfilledRequired` reflects completion | pending |
| 4 | Forced PUT failure → "Not saved" badge, answers retained in the panel | pending |
| 5 | Forced GET failure → only this panel degrades | pending |
| 6 | No auto-save fires without a press (network log shows no PUT on typing alone) | pending |

## Sign-off

- **User**: pending
- **Date**: pending
