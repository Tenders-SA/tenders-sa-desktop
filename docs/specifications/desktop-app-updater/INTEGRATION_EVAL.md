# Desktop — App Updater — INTEGRATION_EVAL

- **Spec**: `desktop-app-updater`
- **Status**: NOT STARTED
- **Date**: 2026-08-18
- **SPEC_CONTRACT**: `PENDING APPROVAL`

---

## Findings

_Record corrections to the brief or spec discovered during implementation,
with file:line evidence, in the style of the supplier-profile slice
(e.g. F1–Fn)._

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | `tauri-plugin-updater` 2.10.1 default features are `["rustls-tls", "zip"]` — no feature flags needed; the brief's implicit native-tls assumption was avoided by keeping defaults. | crates.io API, read 2026-08-18 | spec R-U1 / design §3 |
| F2 | Both NSIS and MSI are updateable in v2 (MSI via `.msi.zip`); the brief's targets list needs no change. | tauri-plugin-updater source `updater.rs` (`Installer::Msi`); v2.tauri.app updater docs | DEC-2 |

---

## Task evidence

| Task | State | Evidence |
|---|---|---|
| T1 Signing keypair (user) | outstanding | — |
| T2 Dependencies | outstanding | — |
| T3 Registration + capabilities + config | outstanding | — |
| T4 Check hook | outstanding | — |
| T5 Banner + mount | outstanding | — |
| T6 Config retirement | outstanding | — |
| T7 Release workflow | outstanding | — |
| T8 Docs + changelog + gates | outstanding | — |
| T9 Human verification (user) | outstanding | — |

---

## Gate results

| Gate | Result |
|---|---|
| `pnpm exec vitest run` | _not run_ |
| `npx tsc --noEmit` | _not run_ |
| `npm run lint` | _not run_ |
| `npx prettier --check .` | _not run_ |
| `pnpm rust:check` | _not run_ |
| `capability-scope.test.ts` (unedited) | _not run_ |

---

## Human verification record (T9)

_To be filled by the user. Evidence to record: the `release.yml` run URL,
the release URL (`releases/latest` must resolve), the installed-before /
installed-after versions on the Windows device, banner appearance timing,
update + relaunch outcome, and the no-network run outcome._