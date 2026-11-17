# RepTrack

A mobile-first, local-first workout PWA built with React, TypeScript, Vite, Dexie (IndexedDB), and Workbox. It includes your Push, Pull, and Legs routines, 19 local movement illustrations, set logging, configurable double progression, history corrections, customization, and portable JSON backups.

## Develop and build

Use Node 22 LTS (22.12+) or Node 24 LTS and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview -- --port 4317
```

The production output is `dist/`. It supports both a domain root and a project subdirectory using `VITE_BASE_PATH`. The PWA service worker is enabled in production builds, not the development server. Use a dedicated preview origin; a different app's existing service worker can intercept localhost requests on reused ports.

## GitHub Pages — no sign-in

RepTrack is a static app with no authentication, API keys, or backend. Its GitHub Pages address is `https://miickii.github.io/RepTrack/` once deployment completes.

The included `.github/workflows/deploy-pages.yml` workflow tests, builds, and publishes pushes to `main`. In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The workflow reads the actual Pages base path, so it also supports a root site or custom domain without hard-coding the repository name in application data.

For a matching local production preview:

```sh
VITE_BASE_PATH=/RepTrack/ npm run build
VITE_BASE_PATH=/RepTrack/ npm run preview -- --port 4317
```

Open `http://localhost:4317/RepTrack/`. To run mobile acceptance tests against that deployment path:

```sh
VITE_BASE_PATH=/RepTrack/ npm run test:e2e
```

On iPhone, open the published GitHub Pages address in Safari and choose **Share → Add to Home Screen**. No ChatGPT or GitHub account is needed to use the app. You only need GitHub access to change/publish its source.

The public source and app include the original routine defaults; newly logged workouts and uploaded exercise pictures stay in the current browser's IndexedDB. They are not uploaded to GitHub. If you already logged workouts on the previous hosting address, export a JSON backup there and import it on the Pages address: browser storage does not move between origins.

This follows the [Vite Pages deployment guide](https://vite.dev/guide/static-deploy#github-pages) and [GitHub's workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Data and progression

- Versioned IndexedDB database `reptrack`, currently schema v2. Exercise definitions, templates, session snapshots, and application preferences are separate tables/records.
- Every completed action is validated and committed in a transaction before the UI confirms a save. Live queries refresh other tabs. Undo refuses to overwrite intervening changes.
- Defaults are initialized only once. Existing unmarked data triggers a recovery error rather than destructive reseeding.
- Active workouts and focus are restored on reopening. Rest deadlines survive backgrounding.
- Suggested sets are never completed automatically. Warm-ups are excluded from progression. A clean completed working set is required for every prescribed set; lower reps, changed weights, technique flags, or skipped exercises prevent automatic advancement.
- Weight changes always require an explicit action. No machine increments are invented. Configure a list of available weights or an increment per exercise. A configured list takes priority.
- The initial note summaries have unknown dates and are not synthetic historical workouts. Their original weights remain in the legacy summary even after changing the current working weight. Equipment and weight conventions start unconfirmed.
- Changing units converts the display; the underlying weight is stored canonically in kg. This does not interpret total/per-dumbbell/plates-per-side conventions.
- Settings changes apply to future workouts. Existing sessions retain their original names, targets, actual sets, and dates.
- Exercise removal from templates preserves the exercise library and session history.

## Backup and recovery

Export all data from Settings. Save the JSON file outside browser-managed storage, for example in iCloud Drive or another backup location. An export timestamp means the download was requested, not that an external backup was verified.

Imports validate the version, schema, numeric bounds, unique identifiers, references, and active-session consistency before an atomic write. A preview and explicit confirmation precede either mode:

- **Merge:** add missing IDs only; keep all existing records and settings. Repeated merges do not duplicate records. Conflicting active sessions are rejected.
- **Restore:** replace the full dataset only after explicit confirmation. Export the current state before doing this.

The local backup format is version 1. `src/backup.ts` is the boundary for a future authenticated cloud-backup adapter; no cloud account, backend, or automatic synchronization is implemented. Browser storage is not a guaranteed permanent backup.

## PWA installation and updates

Open the production HTTPS URL in Safari on your iPhone. Choose Share → Add to Home Screen. Allow the first production load to finish before going offline. App shell, icons, and exercise illustrations are precached; custom pictures are in IndexedDB.

Updates are prompted and never forced during an active workout. Finish or discard the active session before applying a waiting update. Deployment should continue using the same origin because each origin has its own database.

## Tests

Unit tests cover initialization, exact seeds, progression exclusions, unit conversion, active recovery, v1→v2 migration, transaction rollback, backup validation, restore, merge idempotency, and conflicts.

The Playwright suite exercises the production build, mobile set logging, reload recovery, offline navigation and imagery, history correction, export/merge, routine reorder, and malformed imports.

```sh
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

See `QA.md` for verification results and physical iPhone acceptance checks.

## Artwork

All 19 exercise illustrations and icons are original local assets; see `ASSETS.md`. The incline exercise preserves the supplied ambiguous designation and initially uses a barbell diagram with the equipment explicitly marked for confirmation. Custom exercises show an image placeholder until an appropriate illustration is selected or uploaded.
