# Tenders-SA Desktop Icon Set

## Desktop identity

Every desktop asset in this pack uses **Tenders-SA Desktop Teal**:

- Background: `#073A43` (deep teal)
- Graph mark: `#40D6C4` (aqua teal)
- Website icon remains: light surface with blue graph mark

The unchanged graph geometry keeps the Tenders-SA identity recognizable, while the teal colour system distinguishes the desktop application in launchers, taskbars, shortcuts, installers, and operating-system search results.

## Included

- `desktop-teal-preview.png` — web-versus-desktop comparison at full and taskbar sizes
- `windows/icon.ico` — multi-resolution native Windows icon
- `macos/icon.icns` and `macos/AppIcon.iconset/` — native macOS assets
- `linux/` — freedesktop-compatible icons from 16px to 512px
- `electron-tauri/` — drop-in `icon.ico`, `icon.icns`, and `icon.png`
- `source/` — teal production masters

## Usage

For Electron/electron-builder, point each platform at the matching file in `electron-tauri/`.

## How this pack is integrated here (Tauri)

This directory is the **source pack**, not a build input. It deliberately sits outside
`public/`, because Vite copies `public/` verbatim into `dist/` and Tauri bundles `dist/`
into the installer — shipping `.icns`, `.ico` and the macOS iconset would put ~250KB of
native formats the webview cannot render inside the app.

Two consumers, both generated from `source/desktop-icon-1024.png`:

1. **Native bundle icons** — `src-tauri/icons/`, regenerated with
   `pnpm tauri icon design/icons/source/desktop-icon-1024.png`. This produces every file
   listed under `bundle.icon` in `src-tauri/tauri.conf.json` plus the Windows Store
   logos, so no stale icon of a previous colourway can survive in that directory.
   Delete the `android/` and `ios/` output it also emits — this app bundles `nsis`/`msi`.
2. **Webview icon** — `public/app-icon.png` (128px), used by the `index.html` favicon and
   the sidebar wordmark. `public/` holds this one file only.

Re-run step 1 after changing the master; do not hand-copy individual files.
