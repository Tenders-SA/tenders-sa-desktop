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

## Updater

No updater plugin is wired up yet. `src/app/config/schema.ts` reserves
`update.channel` and `update.publicKey`; the endpoint and rollout
policy are a later, separately approved decision. See
[architecture/security.md](architecture/security.md).
