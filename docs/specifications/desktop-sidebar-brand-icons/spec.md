# Desktop Sidebar and Brand Icons

## Problem

The existing primary sidebar presents nineteen text-only destinations, making the dense navigation slower to scan. The packaged Tauri application also uses the starter cyan/yellow icon instead of the canonical blue Tenders-SA icon already owned by the main application at `public/icon-512.png`.

## Approach

- Extend the existing `NavigationItem` model with a Lucide icon component and assign one familiar icon to every existing destination.
- Render the icon beside each label in the existing sidebar without changing labels, routes, availability, grouping, or command-palette behaviour.
- Show the canonical Tenders-SA mark in the sidebar brand header.
- Derive the complete Tauri icon set from the same canonical `public/icon-512.png`; do not introduce another logo design.

## Impact map

| Area | Existing owner | Change |
|---|---|---|
| Navigation model | `src/components/navigation/navigation-items.ts` | Add icon metadata only |
| Primary sidebar | `src/components/navigation/Sidebar.tsx` | Render brand and item icons |
| Webview asset | `public/tenders-sa-icon.png` | Local copy of canonical parent asset |
| Native bundle icons | `src-tauri/icons/*` | Regenerated from the canonical asset |
| Navigation tests | `src/tests/app-shell.test.tsx` | Assert every item has an icon and sidebar icons are decorative |

No route, entitlement, backend, storage, auth, or parent-application code changes.

## Verification

- Focused app-shell tests.
- `pnpm typecheck`.
- Scoped ESLint and Prettier checks.
- `cargo check --manifest-path src-tauri/Cargo.toml` if icon regeneration affects Rust packaging metadata.

