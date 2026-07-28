# Tenders-SA Desktop

Tenders-SA Desktop is the native procurement operations workspace for the Tenders-SA platform. It is a separate Tauri 2 application that consumes the existing Tenders-SA backend as its system of record.

**Status: Phase 0 foundation, in progress.** The approved specification covers Phase 0 (foundation) and Phase 1 (parent data/API audit) only. The application shell runs, but no product feature is implemented: there is no tender data, no working authentication, and no workspace functionality. Product phases 2–13 require separately approved specifications.

## Quick start

```bash
pnpm install
pnpm run tauri dev
```

Full setup, verification commands, and platform notes are in [`docs/development.md`](docs/development.md).

Windows is the only supported platform for v1: **Windows 10 version 1709 or later, or Windows 11**, 64-bit. Every check runs on Linux and macOS too, but macOS and Linux packaging are explicit non-goals of the current contract.

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
