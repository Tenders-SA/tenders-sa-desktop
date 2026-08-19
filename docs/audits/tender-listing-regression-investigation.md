# Tender listing regression — investigation report

**Date**: 2026-08-18 · **Investigator**: agent session · **Scope**: desktop application
(`desktop/tenders-sa-desktop`) only; parent repository consulted read-only.

## Finding

**No reproducible defect in the tender-listing path exists in the current
working tree.** The listing pipeline was verified working end-to-end today at
20:59 SAST (successful fetch + validation + cache write), and a fresh launch of
the current build boots cleanly. The one concrete defect present is a
test-only type error in the in-progress updater feature (`pnpm typecheck`
fails at `src/tests/updater.test.tsx:35`). The user-visible breakage the user
reported could not be reproduced from code, cache, or logs — the decisive
observation (exact symptom, which app, when) was never captured anywhere.

## Evidence chain

### 1. The listing pipeline worked today at 20:59 SAST

Local SQLite cache (`%APPDATA%\com.tendersa.desktop\tenders-sa-desktop.db`,
`cache_entries`): key `tenders:{"limit":20,"page":1,...}` has
`updated_at = 2026-08-18T18:59:43Z` (= 20:59:43 SAST), `expires_at =
2026-08-25T18:59:42Z`. A cache write happens only after: HTTP 200 from
`GET https://www.tenders-sa.org/api/tenders` (Bearer token from keychain) →
zod parse against `tenderListResponseSchema` → encrypt → store
(`src/services/storage/local-first-query.ts`, `workspace-cache.ts`). Sibling
writes at 20:56 (radar) and 21:04 (applications) confirm the whole session
20:52–21:05 was healthy. The WAL's last write is 21:05:33 — **no successful
fetch has been recorded since**, including at 22:31 during this investigation.

### 2. The parent contract is stable and matches

- `src/app/api/tenders/route.ts` (parent) last changed **2026-07-27**
  (`be09f9d51`) — before the installed app (08-07) and before today. Current
  response `{tenders[], pagination, debug}` matches the desktop schema;
  `estimatedValue` is Prisma `Float?` (not Decimal — no zod mismatch).
- Parent middleware gates `/api/tenders` behind JWT (not in
  `PUBLIC_API_ROUTES`); the desktop sends the token per request via
  `tauri-plugin-http`. Proven working at 20:59 today.

### 3. The 21:46 "updater build" could not have broken the listing

Reconstructed timeline (2026-08-18, SAST):

| Time | Event |
|---|---|
| 17:17 | Pre-updater binary built |
| 20:52–21:05 | App session, fully healthy (cache writes 20:56, 20:59:43, 21:04) |
| 21:11–21:20 | Updater spec docs written (`docs/specifications/desktop-app-updater/`) |
| 21:28–21:36 | `package.json`, `Cargo.toml`, `lib.rs`, `capabilities/default.json`, `tauri.conf.json` edited |
| 21:46:14 | Binary rebuilt; 21:46:40 app launched (last line of `tauri-dev.stderr.log`) |
| 21:47:31 | App opened the DB (SHM touched) |
| 21:57–22:08 | **Frontend updater files created/edited** — `use-updater.ts` created 21:57:09, `UpdateBanner.tsx` 22:02:40, `App.tsx` modified 22:03:19, `schema.ts`/`load-config.ts` 22:05 |

**The 21:46 launch contained none of the updater frontend** (those files did
not exist until 21:57+). Its frontend was identical to the healthy 20:52
session; the only delta was inert Rust plugin registration. Nothing in that
delta can fail a webview fetch.

### 4. Current tree verified healthy (all gates except typecheck)

- `pnpm test`: **68 files, 1182 tests passed** — includes `app-boot.test.tsx`
  (renders `<App />` with no env; guards the documented module-scope
  `loadConfig` "empty window" regression), `updater.test.tsx`,
  `config.test.ts`, `capability-scope.test.ts`, `tenders-endpoint.test.ts`,
  `tauri-http-transport.test.ts`.
- `pnpm typecheck`: **FAILS** — `src/tests/updater.test.tsx(35,49)`: TS2493
  (mock tuple typing). Test-only; runtime unaffected (esbuild does not
  typecheck). This is the in-progress updater feature's unfinished test.
- Live launch (22:31:23, pid 6152, current build): booted, ran 60s, no crash,
  no errors. The app emits **no stderr output at boot or on idle** — the
  empty `tauri-dev.stderr.log` after the user's 21:46 launch is normal
  behaviour, not evidence of a crash.
- Capabilities: additive only (`updater:default`, `process:allow-restart`);
  the `http:default` allow-list with the Tenders-SA API and document origins
  is intact (`src-tauri/capabilities/default.json:19-25`).
- Config: no `.env` exists and none is required — every field has a working
  default (`src/app/config/load-config.ts:50-83`); the schema's `.strict()`
  object matches the candidate exactly; no module-scope throw.
- Updater hook: `check()` on mount + every 6h, every failure silently caught
  (H5); `UpdateBanner` renders nothing without an update. Inert by design.

## What was ruled out

- **Capability regression** (http scope lost) — diff is additive; scope intact.
- **Config/empty-window regression** (the `app-boot` pattern) — all defaults;
  live boot renders.
- **Parent contract drift** — route unchanged since 07-27; fetched OK today.
- **Session/JWT expiry** — a valid token fetched at 20:59 today.
- **Updater plugin breaking fetches** — frontend updater code did not exist at
  the 21:46 launch; capabilities additive; Rust registered and booting.
- **App crash on launch** — DB opened at 21:47:31; live run boots and stays up.

## Assessment

`DEC1`: The most plausible source of what the user saw is the **mid-implementation
editing window (21:57–22:08)** — files saved every few minutes while the app
was open (vite HMR re-imports module-scope config and re-mounts `App`),
producing transient blank/error states that are **not present in the current
tree**. A relaunch today should show listings (cached 20:59 data is valid
until 08-25, and refreshes work).

`RSK1`: medium — `pnpm typecheck` is red on `src/tests/updater.test.tsx:35`
(in-progress updater feature). Fix before the updater feature is committed.

`RSK2`: low — no runtime log evidence exists for anything the user saw after
21:46 (the app logs no boot/fetch events to stderr); the user-visible symptom
is unverified.

## Open questions

- `Q1`: Which app showed the failure — the dev build (`pnpm tauri dev`) or
  the installed "Tenders-SA Desktop" v0.1.0 (installed 2026-08-07,
  `C:\Program Files\Tenders-SA Desktop\`)?
- `Q2`: What exactly shows — an error message (text?), an endless spinner, a
  blank panel, or an empty list?
- `Q3`: When did it last work — before today? Today before ~21:05?

## Repro checklist (when convenient)

1. Start the app (`pnpm tauri dev` in the desktop repo, or the installed app).
2. Open **Tender Discovery**; if an error appears, capture the exact message.
3. After closing, send `tauri-dev.stderr.log` tail (or note the time) — a
   successful load writes a `tenders:` cache row within seconds.

## References

- `src/features/tenders/TenderList.tsx` — listing UI state machine
- `src/services/api/endpoints/tenders.ts` — schema + endpoint contract
- `src/services/api/transport.ts`, `tauri-http-transport.ts` — request policy
- `src/services/storage/local-first-query.ts`, `workspace-cache.ts` — cache flow
- `src/hooks/use-updater.ts`, `src/features/updates/UpdateBanner.tsx` — updater (new)
- `src-tauri/capabilities/default.json` — capability allow-lists
- `src/app/config/load-config.ts`, `schema.ts` — runtime config
- `src/tests/app-boot.test.tsx` — documented empty-window regression guard
- Parent (read-only): `src/app/api/tenders/route.ts`, `src/middleware.ts`
- Cache DB: `%APPDATA%\com.tendersa.desktop\tenders-sa-desktop.db`