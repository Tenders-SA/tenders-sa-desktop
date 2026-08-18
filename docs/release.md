# Release and packaging

## Packaging is a deliberate human action

A Windows release package is a **human- or approved-CI gate** under
[`AGENTS.md`](../AGENTS.md) and `SPEC_CONTRACT.md`. Coding agents do
not run it, and CI does not run it automatically on push — that would
defeat the gate.

Packaging therefore lives in `.github/workflows/windows-package.yml`,
which is `workflow_dispatch` only: a person starts it, and the run logs
who did.

## Producing a Windows package

1. Open **Actions → Windows package → Run workflow** on the branch or
   tag you want.
2. Leave **sign** unchecked for a test build; tick it for a release
   that must carry signed updater metadata.
3. Download the `tenders-sa-desktop-windows` artifact, which contains
   the NSIS `.exe` and MSI `.msi` installers.

Bundle targets are restricted to `nsis` and `msi` in
`src-tauri/tauri.conf.json`. macOS and Linux targets are an explicit
non-goal of the current contract.

### Installer size

`webviewInstallMode` is set to `offlineInstaller`, which embeds the full
WebView2 runtime so the application installs with no internet connection
at all.

**Measured, not estimated:**

| Packaging run | Commit | Artifact |
|---|---|---|
| [30313966903](https://github.com/Tenders-SA/tenders-sa-desktop/actions/runs/30313966903) (download bootstrapper) | `e0cd4c9` | 7.8 MB |
| [30335441194](https://github.com/Tenders-SA/tenders-sa-desktop/actions/runs/30335441194) (offline installer) | `ea02e08` | 399 MB |

The artifact contains **both** the NSIS and MSI installers, and each
embeds its own copy of the WebView2 runtime — which is why the increase
is around +391 MB rather than the ~127 MB a single embedded runtime
would cost. If that is too large, the options are to drop one installer
format (halving the embedded payload) or to move to `embedBootstrapper`,
which is far smaller but requires internet at install time.

WebView2 already ships with Windows 11 and is present on most Windows 10
devices, so the embedded runtime is insurance for the minority that lack
it, not the common path.

## Signing secrets (SEC-4)

Signing material exists **only** in repository secrets. It is never
committed, never placed in `.env`, and never printed by a workflow.
The workflow references these by name:

| Secret name | Purpose |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Private key for signing updater metadata |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that key |

The corresponding **public** key is non-secret and belongs in
configuration (`VITE_UPDATE_PUBLIC_KEY`), where the client uses it to
verify signed update metadata.

When `sign` is not selected, these resolve to empty and Tauri produces
unsigned artifacts — the correct default for a test package. Do not
distribute unsigned artifacts as a release.

## Evidence for the Phase 0 gate

`TASK-0.13` requires that a human, or an approved CI run, confirms the
application packages and launches on Windows, and that the evidence is
recorded. A successful run of this workflow plus a confirmed launch on
the agreed Windows 11 reference device is that evidence. Attach:

- the workflow run URL and the commit SHA it built;
- confirmation that the installed application launches;
- measured cold and warm start times, for the PERF-1 targets (3s cold,
  1.5s warm), which are defined **against that reference device** —
  numbers from CI or a developer laptop do not satisfy PERF-1.

Until that evidence exists, TASK-0.13 stays incomplete. That is by
design, not an oversight.

## Producing a signed release (auto-update)

Signed releases are cut through **Actions → Release (signed)**,
`workflow_dispatch`-only, exactly like the test package above — the
updater does not weaken the gate, it removes the manual installer
hand-off.

Before starting the run:

1. Bump the version in **all three** places so they agree:
   `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`.
   The updater compares SemVer, so a release whose version is not newer
   than what clients already run is never offered — silently.
2. Commit the bump, tag it (`git tag v0.1.1`), push tag and branch.
3. Run **Release (signed)** with `tag` = that tag. Leave `apiBaseUrl`
   blank for the production build.

The workflow builds signed (the signing secrets are always set on this
path), uploads the NSIS installer, the MSI and their signatures, and
publishes `latest.json` as a release asset — the exact URL the
application polls. It never marks the release `prerelease`: GitHub's
`releases/latest` pointer skips prereleases, so a prerelease tag would be
invisible to every installed client.

Installed clients are offered the release within one launch (or six
hours) of the release being published.

## Updater

The updater is wired up (spec:
`docs/specifications/desktop-app-updater/`):

- **Endpoint**: `https://github.com/Tenders-SA/tenders-sa-desktop/releases/latest/download/latest.json`,
  a static `latest.json` published by the **Release (signed)** workflow.
- **Public key**: `src-tauri/tauri.conf.json → plugins.updater.pubkey` —
  the only place the key lives in the repository. It verifies the
  signature of every downloaded payload; there is no unverified mode.
- **Private key + password**: GitHub secrets `TAURI_SIGNING_PRIVATE_KEY`
  and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, by name only. **If either is
  lost, no future release can be signed** — the public key in
  `tauri.conf.json` only accepts signatures from its own pair. Keep a
  backup of the key file (`~/.tauri/tenders-sa-desktop.key`) and the
  password in a password manager.
- Update payloads are the full offline NSIS/MSI packages (~399 MB per
  `docs/release.md` measurements above); delta updates are a future
  slice. Nothing downloads until the user clicks **Update & Restart**.
- A failed check (offline, service down) is silent by design: the app
  behaves exactly as it did before the updater existed, and is never
  falsely told it is up to date.
