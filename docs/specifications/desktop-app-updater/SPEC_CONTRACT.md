# Desktop — App Updater — SPEC_CONTRACT

- **Status**: `APPROVED`
- **Date**: 2026-08-18
- **Scope**: signed automatic updates for the Windows desktop app —
  `tauri-plugin-updater` + `tauri-plugin-process`, GitHub-Releases-hosted
  `latest.json`, check-on-launch/6 h hook, update banner, config
  placeholder retirement, and the signed release workflow.
- **Approved by**: user (in-session directive)
- **Approval date**: 2026-08-18

## Contract checklist (mirrors tasks.md)

| # | Item | Contract |
|---|---|---|
| C1 | Signing key (user task) | User runs `pnpm tauri signer generate -w ~/.tauri/tenders-sa-desktop.key`; private key + password exist **only** as GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; public key pasted into `tauri.conf.json → plugins.updater.pubkey`; repo grep finds no key material |
| C2 | Dependencies | `tauri-plugin-updater` (default features `rustls-tls` + `zip` — matching the http plugin's TLS choice, comment in Cargo.toml) and `tauri-plugin-process` in `src-tauri/Cargo.toml`; `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` in `package.json` |
| C3 | Registration, capabilities, config | both plugins registered in `src-tauri/src/lib.rs`; `capabilities/default.json` gains **exactly** `"updater:default"` and `"process:allow-restart"` (two-line diff, nothing else); `tauri.conf.json` gains `bundle.createUpdaterArtifacts: true` (not `"always"`), `plugins.updater.pubkey` (real key) and the endpoint `https://github.com/Tenders-SA/tenders-sa-desktop/releases/latest/download/latest.json`; `targets` stays `["nsis", "msi"]`; CSP untouched |
| C4 | Check hook | `src/hooks/use-updater.ts` — `check()` on mount + 6 h interval; every failure caught and silent (never rendered as "no update"); `install()` = `downloadAndInstall()` → `relaunch()`, statuses `idle`/`downloading`/`ready`, failure returns to `idle` without relaunching |
| C5 | Banner | `src/features/updates/UpdateBanner.tsx` renders only when an update exists; version shown; button label follows status and is disabled while not `idle`; mounted in `App.tsx` inside `AppProviders`, outside `BrowserRouter` — works with or without a session; fixed, unobtrusive, `role="status"`, light theme |
| C6 | Config retirement | `update` block deleted from `schema.ts:40-46`, `load-config.ts:68-75` and `.env.example:21-25` (replaced by a pointer line); `config.test.ts` drops the two `VITE_UPDATE_*` fixtures; `tauri.conf.json` is the **only** key location left |
| C7 | Release workflow | new `.github/workflows/release.yml` — `workflow_dispatch`-only with required `tag` input; checkout the tag; signing secrets set **unconditionally**; `tauri-apps/tauri-action` with `includeUpdaterJson: true` and `prerelease: false`; `contents: write` scoped to this workflow; `windows-package.yml` unmodified (unsigned test path) |
| C8 | Version discipline | release pre-check: `tauri.conf.json` / `package.json` / `Cargo.toml` versions agree; manifest version newer than installed; tag is non-prerelease |
| C9 | Docs + changelog | `docs/release.md` Updater section rewritten to the live flow (endpoint, key locations, publish steps, prerelease warning, key-loss warning); `docs/architecture/security.md:110-116` updated; `CHANGELOG.md` entry for the banner |
| C10 | Verification gates | full `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .`, `pnpm rust:check` — zero errors; `capability-scope.test.ts` passes **unedited** |
| C11 | Human verification | user cuts a real signed release and confirms on Windows: banner appears within one launch/6 h; Update & Restart downloads, verifies, installs, relaunches into the new version; no-network run shows no banner and no error; a prerelease tag is never offered. Recorded in `INTEGRATION_EVAL.md` |

## Explicitly out of contract

- **Any parent-repository change** — the metadata endpoint is a GitHub
  Release asset precisely so no parent endpoint, route or deployment moves
  (DEC-1).
- Changes to `windows-package.yml`, CSP, the `http:` allow-list, or any
  `shell:` / `opener:` / filesystem permission.
- Delta updates, channels/rollouts, auto-download, silent install, forced
  restart, dismiss persistence, manual "check now" affordance, progress UI,
  macOS/Linux targets, Authenticode code-signing.
- `createUpdaterArtifacts: "always"`.

## Known limitations carried forward

- **L1 — update payload is the full ~399 MB offline NSIS installer**
  (H6). Downloads happen only on the user's click. Delta updates are a
  future slice.
- **L2 — GitHub `releases/latest` ignores prereleases** (H3). If the team
  ever wants a beta channel, it needs its own manifest URL (e.g. a
  `latest-beta.json` asset or a dedicated release tag pattern) — a separate
  decision.
- **L3 — losing the private key or password ends future signed releases**
  (H2). The pubkey in `tauri.conf.json` only verifies its own pair. No
  recovery path exists; stated in `docs/release.md`.
- **L4 — a failed check is indistinguishable from "no update" in the UI**
  (H5, by design): no banner, no error. Users on a broken network are never
  falsely told they are current, but also never told they might not be.
- **L5 — MSI updates via msiexec may require elevation** when the app was
  installed per-machine. The plugin's default install mode applies; a
  per-machine install policy is an organisational decision, not an updater
  setting.

## Non-negotiable constraints

- The private signing key and password exist only in GitHub secrets; the
  public key only in `tauri.conf.json`. Never commit, print or log either.
- The updater never uses the webview network stack — CSP `connect-src` and
  the `http:` capability allow-list are inviolate and `capability-scope.test.ts`
  passes unedited.
- Nothing downloads, installs or relaunches without the user's click.
- Releasing is a human act: `workflow_dispatch`-only, actor logged, never
  push-triggered; unsigned or prerelease artifacts are never a release.
- No parent-repository change; desktop role contract applies throughout.
- No `npm run build` / `next build` / prisma migrations (repo rule).