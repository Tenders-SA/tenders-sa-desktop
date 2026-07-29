# Tenders-SA Desktop

Tenders-SA Desktop is the native procurement operations workspace for the Tenders-SA platform. It is a separate Tauri 2 application that consumes the existing Tenders-SA backend as its system of record.

**Status: working application.** Authentication is live and eleven of the sixteen navigation modules read real data from the Tenders-SA platform — tender search and detail, Tender Radar matching, saved Opportunities, Application Workspaces, Calendar, Tasks, Company Profile, Document Vault, Supplier Intelligence, Notifications and Settings. Proposals, JV and Partner Network, Buyer and Award Intelligence, and Reports are not built and are shown as unavailable rather than as links that go nowhere.

## Supported Windows versions

**Windows 10 version 1709 or later (including the Enterprise/IoT LTSC editions) and Windows 11, 64-bit.** Both are equally supported — there is nothing in the application that requires Windows 11.

Tauri renders with the Microsoft WebView2 runtime. That is part of Windows 11 and already present on most Windows 10 machines, but not all, so **the installer embeds the WebView2 offline installer**: installation never needs an internet connection and never asks you to fetch a runtime separately. The cost is installer size (see `docs/development.md`).

The published start-up and input-latency figures were measured on a Windows 11 reference machine. That is where the *numbers* come from, not a minimum requirement — it says nothing about whether the application runs on Windows 10, and it does.

## Running it

### From an installer

Download the `.exe` (NSIS) or `.msi` from the packaging workflow's artifacts and run it. No configuration is required: the application defaults to the live Tenders-SA platform at `https://www.tenders-sa.org` and prompts you to sign in with your normal Tenders-SA account.

### From source

**pnpm is required, not optional.** `src-tauri/tauri.conf.json` invokes `pnpm dev` and `pnpm build` directly, so `npm install` on its own will not produce a working `tauri dev`.

```bash
npm install -g pnpm      # if you do not have it
pnpm install
pnpm run tauri dev
```

You also need the Rust toolchain and, on Windows, the MSVC C++ build tools — `tauri dev` compiles a native binary. See [`docs/development.md`](docs/development.md) for the full prerequisite list and every verification command.

No `.env` file is needed to start. Copy `.env.example` to `.env` only to point the application somewhere other than production, for example a local backend on `http://localhost:3000`. If configuration is ever invalid the application shows a screen naming the problem rather than opening an empty window.

macOS and Linux run every check and test, but packaging for them is an explicit non-goal of the current contract.

## What exists today

| Area | State |
|---|---|
| Tauri 2 + React 19 + strict TypeScript + Vite workspace | Implemented |
| Quality gates (Prettier, ESLint + jsx-a11y, Vitest, Rust fmt/clippy) | Implemented |
| Validated runtime configuration, fail-closed | Implemented |
| Native security boundary (OS keychain, AES-256-GCM, least-privilege capabilities, CSP) | Implemented |
| Local SQLite cache and migrations | Implemented |
| Offline sync queue and conflict model | Implemented |
| Typed, validated API transport | Implemented |
| Dark-only design system with automated WCAG AA contrast checks | Implemented |
| Structured logging with redaction | Implemented |
| Application shell, navigation, command palette | Implemented; Command Centre is the only real destination |
| Authentication | **Interface shell only, gated off** pending the Phase 1 auth audit |
| Tender discovery, workspaces, proposals, pricing, submission | **Not implemented** — later phases |

## Canonical documents

- Product brief: [`docs/prompts/desktop-procurement-workspace.md`](docs/prompts/desktop-procurement-workspace.md)
- Phase 0–1 specification: [`docs/specifications/desktop-procurement-workspace/`](docs/specifications/desktop-procurement-workspace/)
- Architecture decisions: [`docs/architecture/`](docs/architecture/)
- Development guide: [`docs/development.md`](docs/development.md)
- Release and packaging: [`docs/release.md`](docs/release.md)
- Agent workflow: [`AGENTS.md`](AGENTS.md)

## Verification

CI runs formatting, lint, type, test, and Rust checks on every push and pull request. It deliberately does **not** package the application: a Windows release build is a human- or approved-CI gate, triggered manually. See [`docs/release.md`](docs/release.md).

## Intended parent repository

This repository is attached to the main Tenders-SA repository as the `desktop/tenders-sa-desktop` Git submodule. The main platform remains the source of truth for users, companies, tenders, documents, awards, subscriptions, workspaces, and notifications.
