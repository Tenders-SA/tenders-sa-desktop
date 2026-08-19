# Desktop — App Updater — INTEGRATION_EVAL

- **Spec**: `desktop-app-updater`
- **Status**: T1–T8 complete; T9 (human verification) outstanding
- **Date**: 2026-08-18
- **SPEC_CONTRACT**: `APPROVED` (user, 2026-08-18)

---

## Findings

_Record corrections to the brief or spec discovered during implementation,
with file:line evidence, in the style of the supplier-profile slice
(e.g. F1–Fn)._

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | `tauri-plugin-updater` 2.10.1 default features are `["rustls-tls", "zip"]` — no feature flags needed; the brief's implicit native-tls assumption was avoided by keeping defaults. | crates.io API, read 2026-08-18 | spec R-U1 / design §3 |
| F2 | Both NSIS and MSI are updateable in v2 (MSI via `.msi.zip`); the brief's targets list needs no change. | tauri-plugin-updater source `updater.rs` (`Installer::Msi`); v2.tauri.app updater docs | DEC-2 |
| RSK1 | `src/tests/draft-stage.test.tsx:123` ("opens a full-screen workbench…") exceeded its 10 s budget once during the full-suite run under machine load; passes in isolation in 6.8 s. Unrelated to this spec — no updater code in that tree. Pre-existing flakiness, not a regression. | full `vitest run` 2026-08-18 vs `vitest run -t` isolation run | record only, no fix in this spec |

---

## Task evidence

| Task | State | Evidence |
|---|---|---|
| T1 Signing keypair (user) | done | keypair generated at `~\.tauri\tenders-sa-desktop.key` (+ `.pub`); GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set and verified via `gh secret list`; pubkey in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| T2 Dependencies | done | `Cargo.toml`: `tauri-plugin-updater 2.10.1` (default features), `tauri-plugin-process 2.3.1`; `package.json`: `@tauri-apps/plugin-updater 2.10.1`, `@tauri-apps/plugin-process 2.3.1` |
| T3 Registration + capabilities + config | done | `src-tauri/src/lib.rs` registers both plugins; `capabilities/default.json` += `updater:default`, `process:allow-restart` (nothing else); `tauri.conf.json` += `bundle.createUpdaterArtifacts: true` + `plugins.updater.endpoints` (GitHub Releases latest.json). Verified: `pnpm rust:check` green (~4 m 46 s, tauri-build validated the pubkey); `capability-scope.test.ts` 20/20 green unedited |
| T4 Check hook | done | `src/hooks/use-updater.ts`: check on mount + 6 h interval, silent catch, `install()` = `downloadAndInstall()` → `relaunch()`; statuses idle/downloading/ready; failure → idle. 7 hook tests in `src/tests/updater.test.tsx` |
| T5 Banner + mount | done | `src/features/updates/UpdateBanner.tsx` (fixed bottom-right, `role="status"`, primary theme) mounted in `src/App.tsx` inside `<AppProviders>` outside `<BrowserRouter>`. 4 banner tests in `updater.test.tsx` (11 total green) |
| T6 Config retirement | done | `update` block removed from `src/app/config/schema.ts` + `load-config.ts`; `VITE_UPDATE_*` fixtures removed from `src/tests/config.test.ts` (9/9 green); `.env.example` block replaced with pointer comment; `src/vite-env.d.ts` keys removed; repo-wide grep clean. Regression fix: `app-boot.test.tsx` now mocks `@tauri-apps/plugin-updater` (check → null) + `@tauri-apps/plugin-process` (relaunch) — real plugin's `Update extends Resource` cannot evaluate under jsdom with the mocked core; test green |
| T7 Release workflow | done | `.github/workflows/release.yml`: `workflow_dispatch` (inputs `tag` required, `apiBaseUrl` optional), `permissions: contents: write`, `tauri-apps/tauri-action@v0` with signing secrets set unconditionally, `includeUpdaterJson: true`, `prerelease: false`, `args --target nsis,msi`. Both workflow YAMLs parse clean. `windows-package.yml` unmodified |
| T8 Docs + changelog + gates | done | `CHANGELOG.md` Unreleased/Added entry (signed automatic updates); `docs/release.md` rewritten (signed release + Updater sections); `docs/architecture/security.md` updater section updated. Gates: see table below |
| T9 Human verification (user) | **outstanding** | see record below |

---

## Gate results

| Gate | Result |
|---|---|
| `pnpm exec vitest run` | 1181/1182 passed (68 files). 1 failure: `draft-stage.test.tsx:123` timed out at 10 s under load; passes in isolation (6.8 s) — pre-existing, unrelated (RSK1) |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors |
| `npx prettier --check .` | touched files clean; `src/tests/eligibility-endpoint.test.ts` flagged (pre-existing, untouched by this spec) |
| `pnpm rust:check` | green (~4 m 46 s) |
| `capability-scope.test.ts` (unedited) | 20/20 passed |
| workflow YAML parse | both `release.yml` + `windows-package.yml` parse (yaml 2.x) |

---

## Human verification record (T9)

_To be filled by the user. Evidence to record: the `release.yml` run URL,
the release URL (`releases/latest` must resolve), the installed-before /
installed-after versions on the Windows device, banner appearance timing,
update + relaunch outcome, and the no-network run outcome._