# Desktop — App Updater — Tasks

> Read `requirements.md` and `design.md` before starting. Complete tasks in
> order; the contract checklist (`SPEC_CONTRACT.md`) must mirror this list.

## Status (2026-08-18)

- T1–T8: complete. T9 is the user's. Evidence per task, and the gate
  results, are recorded in `INTEGRATION_EVAL.md`.

| Task | State |
|---|---|
| T1 Signing keypair (user) | done — generated on behalf per user request; key file + secrets + pubkey in place |
| T2 Dependencies | done — updater 2.10.1 (default rustls-tls + zip), process 2.3.1; JS 2.10.1 / 2.3.1 |
| T3 Registration + capabilities + config | done — `cargo check` green, `capability-scope.test.ts` 20/20 unedited |
| T4 Check hook | done — 7 hook tests in `updater.test.tsx` |
| T5 Banner + mount | done — 4 banner tests; mounted in `App.tsx` inside `AppProviders` |
| T6 Config retirement | done — `VITE_UPDATE_*` removed everywhere; `vite-env.d.ts` + `config.test.ts` updated; app-boot regression fixed by mocking the new plugin modules |
| T7 Release workflow | done — `release.yml` parses; secrets by name only; `prerelease: false`; `contents: write` scoped to this file; `windows-package.yml` unmodified |
| T8 Docs + changelog + gates | done — vitest 1181/1182 (1 pre-existing flaky under load, passes in isolation — see `INTEGRATION_EVAL.md` RSK1), tsc 0, lint 0, prettier clean on touched files (1 pre-existing unrelated failure), rust:check green |
| T9 Human verification | **outstanding — for the user** |

## Tasks

| # | Task | Pre-check | Verification |
|---|---|---|---|
| T1 | **Signing keypair (USER)** — run `pnpm tauri signer generate -w ~/.tauri/tenders-sa-desktop.key` once, on a trusted machine. Store the **private key + password** as GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (the names `windows-package.yml:68-69` and `docs/release.md:59-60` already reserve). Paste the **public key** (`publickey.pem` contents) into `src-tauri/tauri.conf.json → plugins.updater.pubkey` — this is the build gate (H1): tauri-build refuses to compile once the plugin is in Cargo.toml without it. Never commit the private key or password (R-U6) | private key never committed anywhere; secrets set in the GitHub repo settings | `git grep` across the repo finds no key material; `tauri.conf.json` parses with a non-empty `pubkey` |
| T2 | **Dependencies** — `cargo add tauri-plugin-updater tauri-plugin-process` in `src-tauri` and `pnpm add @tauri-apps/plugin-updater @tauri-apps/plugin-process`; add the Cargo.toml comments from design §3 (default features = rustls-tls + zip, matching the http plugin's TLS choice — R-U1, R-U2) | T1 done (pubkey present, or tauri-build will fail H1) | `cargo tree` and `pnpm list` show both crates; `pnpm rust:check` passes |
| T3 | **Plugin registration + capabilities + config** — register both plugins in `src-tauri/src/lib.rs` (design §3); add `"updater:default"` and `"process:allow-restart"` to `src-tauri/capabilities/default.json` (R-U4); add `createUpdaterArtifacts: true` to `bundle` and the `plugins.updater` block (pubkey + GitHub endpoint) to `tauri.conf.json` (R-U5, DEC-1). CSP untouched | T2 green | `pnpm rust:check` passes; `src/tests/capability-scope.test.ts` passes **unedited** (R-U4); `git diff` of `default.json` shows exactly two added lines |
| T4 | **Check hook** — `src/hooks/use-updater.ts` per design §5: `check()` on mount + 6 h interval, silent catch (H5), `install()` with the three statuses and failure recovery (R-U7). New `src/tests/updater.test.tsx` with `vi.mock` of both plugin modules | T3 green | `vitest updater` — resolves-update, resolves-null, rejects (silent), interval refires, install success → relaunch, install failure → back to `idle`, no relaunch |
| T5 | **Banner + mount** — `src/features/updates/UpdateBanner.tsx` per design §5 (R-U8); mount in `src/App.tsx` inside `<AppProviders>`, outside `<BrowserRouter>`, so it renders with or without a session; light-theme fixed corner styling, `role="status"`, accessible button | T4 green | `vitest updater` screen tests — hidden when no update; version shown; button label per status; disabled while not `idle`; renders with no session |
| T6 | **Config retirement** — delete `update` from `src/app/config/schema.ts:40-46` and the candidate in `src/app/config/load-config.ts:68-75`; drop the `VITE_UPDATE_*` fixtures from `src/tests/config.test.ts`; delete the updater block from `.env.example:21-25`, replacing it with a one-line pointer to `tauri.conf.json` (R-U9, DEC-5) | T5 green | full `vitest run` green; grep finds no `VITE_UPDATE_` anywhere outside `.env.example`'s pointer line; `tauri.conf.json` is the only key location |
| T7 | **Release workflow** — new `.github/workflows/release.yml` per design §4: `workflow_dispatch` (inputs `tag` required, `apiBaseUrl` optional), checkout the tag, same toolchain steps as `windows-package.yml`, `tauri-apps/tauri-action` with signing secrets set unconditionally, `includeUpdaterJson: true`, `prerelease: false` (H3), `permissions: contents: write` scoped to this file. `windows-package.yml` **not** modified (DEC-6) | T6 green | both workflow YAMLs parse; reviewer check: secrets by name only, no key material, `prerelease: false`, only the release job carries `contents: write` |
| T8 | **Docs + changelog + gates** — rewrite `docs/release.md` Updater section (`:86-91`) to the live flow (endpoint, key locations, release steps, H3 warning, T1 key-loss warning); update `docs/architecture/security.md:110-116`; `CHANGELOG.md` entry for the visible banner behaviour; run all gates | T7 green | `pnpm exec vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx prettier --check .`, `pnpm rust:check` — zero errors; docs diff review; changelog entry present (R-U12) |
| T9 | **Human verification** — user cuts a real signed release via `release.yml` (e.g. `v0.1.1` from a version-bumped commit), then on a Windows device with `v0.1.0` installed: the banner appears within one launch (or 6 h); "Update & Restart" downloads, verifies, installs, relaunches into the new version; the same device with no network shows no banner and no error; a prerelease tag is confirmed **not** offered (H3 spot-check). Record evidence in `INTEGRATION_EVAL.md` | T8 shipped | recorded in `INTEGRATION_EVAL.md`, with the release URL and device result |

## Ordering rationale

T1 is first because the pubkey is a compile-time gate (H1) — no code task
can compile without it, and the key belongs to the user by definition
(secrets). T2–T3 lay the Rust/config foundation; T3's capability diff is
deliberately two lines so the pinned boundary test is auditable. T4–T5
land the behaviour on top of a working plugin, T4 before T5 because the
banner is a consumer of the hook. T6 is a cleanup whose tests must run
against the retired schema — it comes after the feature works, so a config
failure cannot be misread as an updater failure. T7 is the release half of
the pipeline without which nothing in T4–T5 is observable in production.
T8 aligns the docs that currently promise "a later, separately approved
decision". T9 is the user's, as always.

## Do not

- Run `npm run build` / `next build` / prisma migrations (repo rule) or a
  Windows release build (`AGENTS.md` gate) — T9 is the user's.
- Commit the private key, the password, or the signer output anywhere,
  including `.env`, logs or test fixtures (R-U6).
- Widen CSP `connect-src` or the `http:` allow-list for the updater — it
  fetches in Rust; widening would delete a containment guarantee and fail
  `capability-scope.test.ts` (R-U4, R-U5).
- Add `shell:`, `opener:` or filesystem permissions "for the updater".
- Set `createUpdaterArtifacts` to `"always"` — release builds only (R-U5).
- Mark a release `prerelease` (H3) or publish an unsigned release (H2).
- Modify `windows-package.yml` — it is the unsigned test path (DEC-6).
- Add a manual "check for updates" affordance, dismiss persistence, delta
  updates or channels — explicitly out of scope.
- Edit the parent repository — desktop role contract; the endpoint is
  GitHub Releases for exactly this reason (DEC-1).