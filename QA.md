# Verification

Verified on 13 November 2026:

- Production TypeScript/Vite build passes. Workbox precaches the app shell, app icons, and all bundled illustrations.
- 18 Vitest tests pass: seed fidelity, progression rules, initialization, recovery, migration, rollback, backup validation, restore, and merge safety.
- 8 Playwright acceptance tests pass across mobile Chromium and WebKit: offline recovery and images, logging, history corrections, export/merge, routine reorder, corrupt import rejection, visible storage failure with rollback, and confirmed progression without rewriting session weights.
- Visually inspected the 390 × 844 mobile workout view and 1440 × 1000 desktop overview.
- No known production-dependency advisories after updating validation dependencies. The current package audit still reports six low/moderate advisories in the Workbox build-tool dependency tree (deepmerge/glob/minimatch and their parents). These packages are not shipped as application code; do not expose build tools as a public server. Runtime logging, database, and backup tests pass.

The host runs Node 23, which is outside Vitest's declared supported LTS range; the checks passed here. Use Node 22 or 24 LTS for ongoing development.

## GitHub Pages checks

The project-path build was verified on 13 November 2026 and the completed results were collected on 17 November:

- All 20 unit tests passed, including existing image-path portability and custom image preservation.
- All 10 mobile Chromium/WebKit acceptance tests passed with `VITE_BASE_PATH=/RepTrack/`, including offline reload and session recovery.
- Added checks for manifest start URL/scope, service worker scope, app icons, Apple touch icon, and workout illustrations under `/RepTrack/`.
- The application has no authentication code or runtime dependency on the prior hosting service.

## Physical iPhone acceptance (requires the device)

These checks cannot be certified by desktop emulation. Before relying on RepTrack as the only training record:

- Install from the production HTTPS URL using Safari → Share → Add to Home Screen.
- Log sets, close the installed app, and reopen; verify the same active workout and recorded sets.
- Restart the iPhone and verify recovery again.
- Turn on airplane mode and test launch, illustrations, logging, history, and JSON export.
- Return after several days and verify the data remains present.
- Deploy a new version while a workout is active; verify no forced refresh and persistence after the later update.
- Save an export to Files, verify the file exists, and test restore on a separate test origin/device.
- Confirm the ambiguous incline equipment and all starting weight conventions before using progression suggestions.

Local storage can be evicted or cleared by the browser/device. Keep external JSON backups.
