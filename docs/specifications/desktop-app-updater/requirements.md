# Desktop — App Updater — Requirements

**Context**: Tenders-SA Desktop has no way to receive a new version. A user
who installed `0.1.0` keeps `0.1.0` until they hear about a release and
re-download an installer by hand. The scaffolding around an updater already
exists but is deliberately inert:

- `src/app/config/schema.ts:40-46` reserves `update.channel` and
  `update.publicKey` — a placeholder, "the updater is not wired up yet".
- `src/app/config/load-config.ts:68-75` defaults `publicKey` to the sentinel
  `"updater-not-configured"`, documented as inert ("Nothing verifies an
  update against this").
- `.env.example:21-25` repeats the placeholder (`VITE_UPDATE_CHANNEL`,
  `VITE_UPDATE_PUBLIC_KEY`) and says the key "verifies nothing today".
- `docs/architecture/security.md:110-116` — "No updater plugin is wired up
  yet — there is no signing key to verify against."
- `docs/release.md:86-91` — "the endpoint and rollout policy are a later,
  separately approved decision". **This specification is that decision.**
- `.github/workflows/windows-package.yml:68-69` already references the two
  signing secrets **by name only** behind an opt-in `sign` input, and
  `docs/release.md:51-68` documents them — the secret plumbing is in place,
  nothing signs anything yet.

The platform is Windows-only (`src-tauri/tauri.conf.json:28` — targets
`nsis` and `msi`), strict-CSP (`tauri.conf.json:22-24`), and the Tauri
capability file is an audited boundary pinned by
`src/tests/capability-scope.test.ts` — the HTTP allow-list may never widen
silently (`capability-scope.test.ts:71-86`).

**Transport fact that makes this slice cheap**: `@tauri-apps/plugin-updater`
talks to the Rust plugin over Tauri IPC (`invoke`), and the Rust plugin
fetches the update manifest and payload with its own HTTP client. Neither the
webview's `fetch` nor the `tauri-plugin-http` allow-list is involved.
`capability-scope.test.ts:224-235` exists precisely because ordinary
`connect-src` must not grow for this — the updater needs **no** CSP change
and **no** http-scope widening. The `ipc:` source already granted in
`connect-src` (`tauri.conf.json:23`) covers the JS↔Rust calls.

---

## Decisions this spec makes (and why)

### DEC-1 — Update metadata is served from GitHub Releases, not from the parent platform

The desktop role contract forbids changing the parent application to make
the desktop work ("Do not add or change parent endpoints … to make the
desktop application work"). A `/desktop/updates/…` route on
www.tenders-sa.org would be exactly that. The Tauri docs explicitly sanction
a static `latest.json` on a GitHub Release:

```
"endpoints": ["https://github.com/Tenders-SA/tenders-sa-desktop/releases/latest/download/latest.json"]
```

This keeps the entire update path inside the desktop repository: the
release workflow creates the release, uploads installers + signatures, and
publishes `latest.json`; the app points at it; nothing in the parent moves.

**Hazard H3**: `releases/latest` resolves to the newest **non-prerelease**
release. A release tagged but marked `prerelease` is invisible to every
installed client — the release task must never mark a release prerelease.

### DEC-2 — Both installer formats are updateable; neither is dropped

The official docs state that on Windows both the NSIS `setup.exe` and the
MSI are "re-used by the updater" (the MSI updates via its `.msi.zip`
package; `tauri-plugin-updater` `updater.rs` implements `Installer::Msi`).
`createUpdaterArtifacts: true` therefore produces update artifacts for both
targets, and `targets: ["nsis", "msi"]` stays untouched. The updater never
favours one format over the other at runtime — it installs whichever
package the manifest names for the platform, and the manifest carries one
entry per release (the release workflow's `latest.json` records the NSIS
entry; see design §4).

**Hazard H6**: the NSIS installer embeds the WebView2 runtime
(`webviewInstallMode: offlineInstaller`, `docs/release.md:29-49`), so an
update downloads the full ~399 MB package. This is accepted for v1 — delta
updates are out of scope (see Non-goals).

### DEC-3 — Update checks run on launch and every 6 hours while the app is open

The window is normally closed and reopened daily, so a launch check alone
would cover most users. A 6-hour `setInterval` additionally covers
long-running sessions at negligible cost (one small GET to GitHub, executed
in Rust, failures silent). Both paths share the same silent-failure rule:
**an update check that fails must never look like "no update available" and
must never interrupt the user** — it simply does nothing.

### DEC-4 — The user's consent is required before any download

The banner offers "Update & Restart". Nothing downloads, installs or
relaunches without that click. There is no auto-download, no silent
install, no forced restart. (The brief's `downloadAndInstall` on click is
kept as-is; a future slice may add a background download.)

### DEC-5 — The frontend updater config placeholders are removed

`update.channel` / `update.publicKey` in `schema.ts` / `load-config.ts` /
`.env.example` have no consumer: the updater plugin reads `pubkey` from
`tauri.conf.json` (Rust-side, build-time) and knows nothing of
`VITE_UPDATE_CHANNEL` (channels were a v1 concept; the v2 plugin has none).
Two documented sources of truth for "the key" is exactly the drift these
placeholders exist to prevent. The single canonical key location becomes
`src-tauri/tauri.conf.json → plugins.updater.pubkey`, and the frontend
fields are deleted with their tests updated in the same commit.

### DEC-6 — The release path is a separate, human-triggered workflow

`windows-package.yml` stays the **unsigned test-package** path exactly as it
is. A new `release.yml` (also `workflow_dispatch`-only, satisfying the
"human- or approved-CI gate" rule in `AGENTS.md` / `docs/release.md:3-8`)
builds **signed**, publishes the GitHub release, and never runs on push.
Releasing stays a deliberate act with a recorded actor — the updater does
not change that rule, it just removes the manual installer hand-off.

---

## Requirements

| # | Requirement | Verification |
|---|---|---|
| R-U1 | **Rust deps**: `tauri-plugin-updater` and `tauri-plugin-process` are added to `src-tauri/Cargo.toml`. The updater plugin keeps its **default features** (`rustls-tls` + `zip` — verified against crates.io 2.10.1: `"default": ["rustls-tls", "zip"]`), so the TLS backend matches the `rustls-tls` choice already pinned for `tauri-plugin-http` (`Cargo.toml:43`) with no feature juggling. The Cargo.toml comment states this. | `cargo tree` shows both crates; comment present |
| R-U2 | **JS deps**: `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` are added to `package.json` dependencies (same major line as the other `@tauri-apps/plugin-*` packages). | `pnpm list` shows both |
| R-U3 | **Plugin registration**: `src-tauri/src/lib.rs` registers `tauri_plugin_updater::Builder::new().build()` and `tauri_plugin_process::init()` alongside the existing plugins, each with a comment naming the slice requirement. | `cargo check`; registration visible in `lib.rs` |
| R-U4 | **Capabilities**: `src-tauri/capabilities/default.json` gains exactly `"updater:default"` and `"process:allow-restart"`. Nothing else is added, moved or widened: no `shell:`, no `opener:`, no http-scope change, no filesystem grant. | `src/tests/capability-scope.test.ts` passes **unedited**; `git diff` of the file shows exactly two added lines |
| R-U5 | **Updater config**: `src-tauri/tauri.conf.json` gains `"bundle": { "createUpdaterArtifacts": true }` (release builds only — not `"always"`) and a `plugins.updater` block with the **real public key** and the endpoint `https://github.com/Tenders-SA/tenders-sa-desktop/releases/latest/download/latest.json`. `targets` stays `["nsis", "msi"]` (DEC-2). The CSP is untouched. | `pnpm tauri build`-adjacent gates (`rust:check`, config parse) pass; `capability-scope.test.ts` CSP assertions pass unedited |
| R-U6 | **Signing key lifecycle**: the private key + password live **only** in GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (already referenced by name at `windows-package.yml:68-69`); the public key lives only in `tauri.conf.json`. Neither key material nor the signer command output is committed, logged or placed in `.env`. | repo grep finds no key material; `docs/release.md` secrets table unchanged |
| R-U7 | **Check hook**: `src/hooks/use-updater.ts` calls `check()` on mount and on a 6-hour interval (DEC-3), stores the returned `Update | null`, and exposes `available`, `version`, `status` (`idle` \| `downloading` \| `ready`) and `install()`. **Every check failure is caught and ignored** — offline, GitHub down, signature server 404: all silent, none rendered as "no update". `install()` runs `downloadAndInstall()` then `relaunch()`, advancing `status` at each step, and surfaces a failure to the banner without relaunching. | unit tests with both plugin modules mocked: check resolves update / resolves null / rejects; interval fires; install failure leaves the app running |
| R-U8 | **Banner**: `UpdateBanner` renders **only** when an update is available: "Update {version} is available" + a button whose label follows `status` (`Update & Restart` / `Downloading…` / `Restarting…`), disabled while `status !== "idle"`. It is mounted in the composition root so it works **with or without a session** — an update is not gated on sign-in. It must not block, obscure or restyle the app (fixed, unobtrusive placement, light-theme styling, keyboard-operable). | screen test: hidden when no update; shows version; click-through states; renders with no session |
| R-U9 | **Config retirement** (DEC-5): `update.channel` and `update.publicKey` are removed from `schema.ts`, `load-config.ts` and `.env.example`; `src/tests/config.test.ts` drops the two `VITE_UPDATE_*` fixtures. `tauri.conf.json`'s `plugins.updater.pubkey` is the **only** key location left in the repo. | full vitest run green; grep finds no remaining `VITE_UPDATE_` reference outside `.env.example`'s removal (and git history) |
| R-U10 | **Release workflow**: new `.github/workflows/release.yml`, `workflow_dispatch`-only, inputs `tag` (existing version tag) and optional `apiBaseUrl` (blank = production), which: checks out the tag; builds with the signing secrets set (always signed — an unsigned release is a contradiction in terms); uploads the NSIS installer + `.sig`, MSI + `.msi.zip` + `.sig` and a generated `latest.json` to the GitHub Release for that tag; never marks the release `prerelease` (H3). `windows-package.yml` is untouched and remains the unsigned test path (DEC-6). | YAML parses; reviewer check: `permissions` includes `contents: write` only for the release job, secrets referenced by name only, `prerelease: false` |
| R-U11 | **Version discipline**: `tauri.conf.json`, `package.json` and `src-tauri/Cargo.toml` share one version, and the release task's pre-check asserts all three agree before tagging. The updater compares SemVer, so a release whose manifest version is not newer than the installed version is not offered — silently. | release pre-check documented in `tasks.md`; `docs/release.md` release steps name the three files |
| R-U12 | **Docs**: `docs/release.md`'s Updater section is rewritten from "not wired up" to the live flow (endpoint, key locations, how to publish a release, H3 warning); `docs/architecture/security.md:110-116` states the updater is wired with the key in `tauri.conf.json` and that the private key remains CI-only; `.env.example` loses the updater block. `CHANGELOG.md` gains an entry for the visible behaviour (update banner). | doc diff review; changelog entry present |

---

## Non-goals (explicitly out of scope)

- **Parent-platform endpoint or any parent change** (role contract; DEC-1).
- **Delta / differential updates** — the full ~399 MB NSIS package is
  downloaded (H6). Differential payloads are a future slice.
- **Rollout channels (stable/beta) or staged rollouts** — the v2 plugin has
  no channels; `VITE_UPDATE_CHANNEL` was always fiction (DEC-5). All stable
  users are offered every release.
- **Auto-download, silent install or forced restart** (DEC-4).
- **Dismiss persistence** for the banner — v1 has no dismiss control; a
  dismissed-but-freshly-checked update would reappear on the next check,
  which is the honest behaviour.
- **macOS / Linux targets** — the product ships Windows-only.
- **Windows code-signing (Authenticode)** — the updater uses Tauri's own
  minisign signatures; Authenticode for the installers themselves is a
  separate trust decision, not required for the updater to verify payloads.
- **In-app "check for updates now" affordance** — the banner appears when a
  check finds something; there is no manual trigger in v1.
- **Progress UI** — the banner's three states are textual; a progress bar
  (the `onChunk` callback) is a future slice.

## Hazards

- **H1 — the pubkey is a build gate, not a suggestion.** Once
  `tauri-plugin-updater` is in `Cargo.toml`, tauri-build validates the
  config at compile time and refuses to build without
  `plugins.updater.pubkey`. Task T1 (user key generation) therefore
  precedes every code task; implementation cannot start before the public
  key exists in `tauri.conf.json`.
- **H2 — a missing/empty pubkey also breaks the runtime.** The plugin reads
  the pubkey from config at runtime to verify the signature of every
  downloaded payload. There is no "unverified update" mode — if the key is
  wrong, updates simply fail, silently, at the download step. Key
  management is correctness, not ceremony.
- **H3 — `releases/latest` skips prereleases.** A release marked
  `prerelease` in GitHub is invisible to every client. The release workflow
  must never create one (R-U10).
- **H4 — version drift between the three version files** (`tauri.conf.json`,
  `package.json`, `Cargo.toml`) produces a manifest whose version does not
  match the tag, or an app that never sees an update because the installed
  version is newer than the manifest. Pre-check in R-U11.
- **H5 — check failures must be silent but not look like "no update".** The
  hook distinguishes "no update found" (render nothing) from "check failed"
  (render nothing, log to console only). Nothing renders an error state in
  v1; the user is never falsely told they are current (DEC-3).
- **H6 — update payload size.** The offline NSIS installer is ~399 MB
  (`docs/release.md:34-45`). The download happens only on the user's click
  (DEC-4) and the banner states the version but not the size in v1.

## Success criteria

1. A user on `0.1.0` sees "Update 0.1.1 is available" within one launch (or
   6 h) of `0.1.1` being published as a non-prerelease release with a
   `latest.json` asset.
2. Clicking "Update & Restart" downloads, verifies against the public key,
   installs and relaunches into `0.1.1`, preserving the user's session
   state (relaunch, not fresh start).
3. With no network, GitHub down, or no update published: the app starts,
   runs and looks exactly as before — no banner, no error, no delay.
4. `src/tests/capability-scope.test.ts` passes **unedited** — no CSP change,
   no http-scope change, no shell/opener grant (R-U4, R-U5).
5. The private key exists only in GitHub secrets; the public key only in
   `tauri.conf.json`; the repo grep is clean (R-U6).