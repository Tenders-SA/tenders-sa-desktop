# Development

## Prerequisites

- **Node 22** and **pnpm** (the repository pins its lockfile to pnpm).
- **Rust stable** with `rustfmt` and `clippy`.
- **Windows 10 version 1709 or later, or Windows 11**, 64-bit, for a real
  product run. Windows is the only supported platform for v1 — macOS and
  Linux packaging are explicit non-goals of the current contract. See
  `requirements.md` §Supported platforms for why that floor, and note the
  installer embeds the WebView2 offline installer (~127MB) so it works
  without internet access.

### Working on Linux or macOS

You can run every check on Linux or macOS even though the product
targets Windows. `cargo check` compiles Tauri's Linux backend, which
needs system libraries that are not part of the shipped product:

```bash
sudo apt-get install -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

Without these, `cargo check` fails on `gdk-sys` with a `pkg-config`
error. That failure is about your machine, not the code.

## Setup

```bash
pnpm install
cp .env.example .env      # then edit; it holds no secrets, see below
```

## Verification commands

These are exactly what CI runs (`.github/workflows/ci.yml`), so a
green local run means a green CI run:

```bash
pnpm run format:check   # Prettier
pnpm run lint           # ESLint (incl. jsx-a11y)
pnpm run typecheck      # tsc --noEmit, strict
pnpm run test           # Vitest
pnpm run build          # production frontend build

cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the app in development with `pnpm run tauri dev`.

## Configuration and secrets

`.env` is a **developer input, not a secret store**. `src/app/config/`
builds its configuration from an explicit allowlist of `VITE_`-prefixed
keys, so anything else you put in that file is ignored rather than
silently shipped to the webview — but do not put credentials there
regardless. Invalid or missing required values fail startup closed with
a clear error.

Signing keys never live in the repository or in `.env`. See
[release.md](release.md).

## Repository conventions

- This repository follows the spec-driven workflow in
  [`AGENTS.md`](../AGENTS.md). Implementation follows
  `docs/specifications/desktop-procurement-workspace/tasks.md` **in
  order**, and each task's pre-check and verification must be completed
  before it is ticked.
- Architecture decisions live in [`docs/architecture/`](architecture/).
  Read the relevant ADR before changing security, local data, sync, the
  API transport, the design system, or logging.
- Components reference **semantic design tokens** (`bg-card`,
  `text-muted-foreground`) rather than raw colour utilities. The design
  system is dark-only; there is no light theme and adding one is a spec
  change. See [architecture/design-system.md](architecture/design-system.md).
- Never log raw values. Use the logger in `src/services/observability/`,
  which redacts by allowlist. See
  [architecture/observability.md](architecture/observability.md).

## What CI does and does not do

CI runs the non-build checks above on every push and pull request.

It **does not** build or package the application automatically. A
Windows release build is a human- or approved-CI gate under
`AGENTS.md`, so packaging lives in a separate, manually-triggered
workflow. See [release.md](release.md).
