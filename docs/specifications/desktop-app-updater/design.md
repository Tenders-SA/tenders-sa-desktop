# Desktop — App Updater — Design

> Read `requirements.md` first. This document fixes the implementation
> strategy; `tasks.md` executes it in order. Requirements are cited as R-U#.

---

## 1. Transport and containment — why nothing security-pinned changes

`@tauri-apps/plugin-updater` invokes the Rust plugin over Tauri IPC; the
Rust plugin does its own HTTP with its own TLS stack. Consequences:

- **No CSP change.** `connect-src` stays `'self' ipc: http://ipc.localhost`
  (`tauri.conf.json:23`). The `ipc:` source already covers the JS↔Rust
  calls. `capability-scope.test.ts:224-235` (connect-src must not grow) and
  `:217-222` (script-src `'self'`) pass unedited.
- **No `http:` capability widening.** The updater's fetch never routes
  through `tauri-plugin-http`, so the audited three-origin allow-list
  (`capabilities/default.json:18-25`) is untouched.
- **The only capability additions** are `"updater:default"` (check +
  download + install + download-and-install — the exact surface the UI
  needs) and `"process:allow-restart"` (the relaunch after install). Two
  string entries; nothing structural.

This is the whole reason the slice is cheap: the security boundary the repo
pins hardest is the one the updater cannot disturb, because it never uses
the webview network stack.

## 2. Key lifecycle — one private key, one public key, one location each

```
pnpm tauri signer generate -w ~/.tauri/tenders-sa-desktop.key   (USER, T1)
        │
        ├── private key + password ──► GitHub secrets (names already in
        │                               windows-package.yml:68-69, read by
        │                               release.yml too)
        │
        └── public key (publickey.pem) ──► tauri.conf.json plugins.updater.pubkey
```

Rules, pinned by tests and review:

1. The **private** key and its password exist in exactly one place outside
   the user's machine: the two GitHub secrets. No workflow prints them, no
   file in the repo references their values, and the workflow files cite
   them **by secret name only** (the pattern already in
   `windows-package.yml:68-69` — `${{ inputs.sign && secrets.X || '' }}`).
2. The **public** key exists in exactly one repo location:
   `tauri.conf.json → plugins.updater.pubkey`. It is non-secret by design
   (it is shipped inside every installer). The frontend `VITE_UPDATE_*`
   placeholders are deleted (DEC-5, R-U9) so a second, drifting "key"
   location cannot reappear.
3. Losing the private key or its password means **no future signed
   release** — the pubkey in tauri.conf.json only verifies signatures made
   by its pair. The release workflow cannot recover it. This is stated in
   `docs/release.md`.

## 3. Config wiring (R-U3, R-U5)

`src-tauri/src/lib.rs` — two registrations, added beside the existing
plugins (order irrelevant, comments name the slice):

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

`src-tauri/Cargo.toml`:

```toml
# Update transport (R-U1). Default features are rustls-tls + zip — the
# rustls TLS backend matches tauri-plugin-http's choice (Cargo.toml:43),
# and the zip feature is what installs the downloaded NSIS/MSI package.
tauri-plugin-updater = "2"
# Relaunch after a successful update install (R-U7). Least privilege:
# only process:allow-restart is granted in capabilities/default.json.
tauri-plugin-process = "2"
```

`src-tauri/tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "createUpdaterArtifacts": true,
  "targets": ["nsis", "msi"],
  ...
},
"plugins": {
  "updater": {
    "pubkey": "<public key from T1, verbatim>",
    "endpoints": [
      "https://github.com/Tenders-SA/tenders-sa-desktop/releases/latest/download/latest.json"
    ]
  }
}
```

Notes:

- `createUpdaterArtifacts: true` (not `"always"`) — artifacts are generated
  for release builds only; dev builds stay unencumbered. Both `nsis` and
  `msi` receive update artifacts (DEC-2; the MSI update package is
  `<app>_<version>_x64.msi.zip`, produced by tauri-bundler).
- `pubkey` is mandatory once the plugin is in Cargo.toml (H1): tauri-build
  validates the config at compile time and errors without it. T1 precedes
  all code tasks.
- The endpoint is a static JSON document — no `{{target}}`/`{{arch}}`
  templates needed; one manifest serves every client. This is the URL form
  the Tauri docs explicitly sanction for GitHub-hosted updates.

## 4. Release publishing (R-U10, R-U11) — the missing half of the pipeline

The brief's "one gap" is real: without a published `latest.json`, the
updater has nothing to check against. `windows-package.yml` uploads to
Actions artifacts only, and its `sign` input is for test builds. The new
`release.yml` closes the loop:

```yaml
name: Release (signed)

on:
  workflow_dispatch:
    inputs:
      tag:
        description: "Version tag to release (e.g. v0.1.1). Must exist and must not be a prerelease."
        required: true
      apiBaseUrl:
        description: "API origin to build against. Blank = production."
        required: false
        default: ""

permissions:
  contents: write   # create/upload the GitHub Release — the ONLY elevated scope

jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.tag }}
      - pnpm/action-setup, setup-node (node 22, cache pnpm), dtolnay/rust-toolchain,
        Swatinem/rust-cache — identical to windows-package.yml
      - pnpm install --frozen-lockfile
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          VITE_API_BASE_URL: ${{ inputs.apiBaseUrl }}
        with:
          tagName: ${{ inputs.tag }}
          releaseName: "Tenders-SA Desktop ${{ inputs.tag }}"
          releaseBody: "…"     # short, from a fixed template
          includeUpdaterJson: true
          prerelease: false     # H3 — never invisible to clients
          args: --target nsis,msi   # explicit, mirroring tauri.conf.json targets
```

What this does, precisely:

- **Builds signed** — the two secrets are set unconditionally here, unlike
  `windows-package.yml`'s opt-in `sign`. An unsigned release would ship a
  manifest whose signatures cannot be verified and every client would fail
  at download (H2). Signing is not a choice on this path.
- **`includeUpdaterJson: true`** makes tauri-action compute `latest.json`
  from the generated `.sig` files and upload it as a release asset. That
  asset is the exact URL in `plugins.updater.endpoints` —
  `releases/latest/download/latest.json`.
- **`prerelease: false`** is load-bearing (H3): GitHub's `latest` pointer
  ignores prereleases, so a prerelease tag would make every installed
  client check against a manifest that never arrives.
- **`contents: write` is scoped to this one workflow file** and is its only
  elevated scope. `windows-package.yml` keeps `contents: read`.

Pre-conditions, enforced by the workflow input contract and T11's human
verification:

- The tag exists, was created from a commit where
  `tauri.conf.json` / `package.json` / `Cargo.toml` versions agree (R-U11,
  H4) and the version is newer than every already-shipped version.
- Releasing remains a **deliberate human act**: `workflow_dispatch`-only,
  logged actor, never triggered by push.

`windows-package.yml` is deliberately **not** modified — it remains the
unsigned test-package path whose artifact the user inspects before any
release is cut (DEC-6, `docs/release.md:3-13`).

## 5. Frontend — hook and banner (R-U7, R-U8)

`src/hooks/use-updater.ts` (kebab-case per repo convention; the brief's
`useUpdater.ts` is renamed to match):

```ts
import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type UpdateStatus = "idle" | "downloading" | "ready";

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [status, setStatus] = useState<UpdateStatus>("idle");

  useEffect(() => {
    let active = true;
    const run = () => {
      check()
        .then((found) => {
          if (active && found) setUpdate(found);
        })
        .catch(() => { /* H5: silent; never "no update available" */ });
    };
    run();
    const timer = setInterval(run, CHECK_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function install() {
    if (!update || status !== "idle") return;
    setStatus("downloading");
    try {
      await update.downloadAndInstall();
      setStatus("ready");
      await relaunch();
    } catch {
      setStatus("idle"); // failure keeps the app running; banner stays actionable
    }
  }

  return { available: update !== null, version: update?.version, status, install };
}
```

Behaviour pinned by tests:

- check resolves `Update` → banner appears with that version;
- check resolves `null` or **rejects** → banner stays absent (both are
  rendered as "nothing");
- interval fires again at 6 h (fake timers) and can surface a later release
  in a long-running session (DEC-3);
- `install()` fails at either stage → `status` returns to `idle`, no
  relaunch, no crash (H5);
- relaunch only after a successful `downloadAndInstall` (DEC-4).

`src/features/updates/UpdateBanner.tsx`:

```tsx
function UpdateBanner() {
  const { available, version, status, install } = useUpdater();
  if (!available) return null;
  return (
    <aside className="update-banner" role="status">
      <span>Update {version} is available.</span>
      <button onClick={() => void install()} disabled={status !== "idle"}>
        {status === "idle" ? "Update & Restart" :
         status === "downloading" ? "Downloading…" : "Restarting…"}
      </button>
    </aside>
  );
}
```

Mount point — composition root, session-independent (R-U8):
`src/App.tsx`, inside `<AppProviders>` and **outside** `<BrowserRouter>`
(the banner needs no routing state and must render whether or not a session
exists). Styling: a fixed, unobtrusive corner strip using the existing
light-theme tokens; `role="status"`; the button is a plain accessible
control. It never covers interactive content and never blocks startup —
`useUpdater` does not gate or await anything the app renders.

## 6. Config retirement (R-U9, DEC-5)

| File | Change |
|---|---|
| `src/app/config/schema.ts:40-46` | delete the `update` object; `.strict()` keeps working (no other field references it) |
| `src/app/config/load-config.ts:68-75` | delete the `update` block from the candidate |
| `src/tests/config.test.ts:10-11` | drop the two `VITE_UPDATE_*` fixtures (and any assertion reading `update.*`) |
| `.env.example:21-25` | delete the updater block; note that update metadata lives in `src-tauri/tauri.conf.json` |

Rationale: the placeholders' own comments condition them on "when the
updater does ship it will need a real key and its own validation"
(`load-config.ts:72-74`). It has now shipped; the real key is Rust-side
(`tauri.conf.json`), and keeping a second inert copy in client config is
the two-sources-of-truth failure this repo's config tests exist to catch.

## 7. Verification plan

| Gate | Command | Expects |
|---|---|---|
| Unit + screen | `pnpm exec vitest run` | all suites green, including new `src/tests/updater.test.tsx` (mock `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` via `vi.mock`) and updated `config.test.ts`; `capability-scope.test.ts` **unedited** and green |
| Types | `npx tsc --noEmit` | zero errors |
| Lint / format | `npm run lint`, `npx prettier --check .` | clean |
| Rust | `pnpm rust:check` (cargo check) | clean with the two new plugin crates |
| YAML | parse both workflow files | valid; `permissions` audit |
| Human (T11) | real device, real GitHub release | see `tasks.md` T11 |

The one thing agents do not run is the Windows release build itself —
`AGENTS.md` makes it a human gate; `release.yml` is that gate made
repeatable and signed.