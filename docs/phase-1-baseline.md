# Phase 1 Baseline

Captured for the legacy-to-modules migration freeze.

## Commands

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
```

## Results

| Check | Result | Notes |
| --- | --- | --- |
| Unit/domain tests | Passed | 9 test files, 30 tests passed. |
| Production build | Passed | Vite build completed successfully. |
| Browser smoke | Passed | Chrome headless opened the app and validated the minimum flows. |

## Smoke Coverage

The smoke script is available at `tests/smoke/smoke.mjs` and can be run with:

```powershell
npm.cmd run smoke
```

It starts a local Vite server automatically and checks:

- app opens
- login screen appears
- critical globals are present
- dashboard renders
- changing month updates dashboard chart title
- tab switching works
- new record form opens
- export PDF does not throw

The smoke script uses the local Chrome executable. If Chrome is installed in a non-standard path, set:

```powershell
$env:PLAYWRIGHT_CHROME_EXECUTABLE="C:\Path\To\chrome.exe"
```

## Known Build Warnings

The build still reports warnings for classic scripts without `type="module"`, for example:

```text
<script src="src/legacy-globals.js"> in "/index.html" can't be bundled without type="module" attribute
<script src="src/legacy/inline/part-XX.js"> in "/index.html" can't be bundled without type="module" attribute
```

These warnings are expected in Phase 1. They are the migration target, not a current failure.

## Critical Globals Frozen

These functions must remain available until the migration provides explicit imports or a compatibility bridge:

- `renderDashboard`
- `renderEntradas`
- `renderSaidas`
- `switchTab`
- `handleSubmit`
- `consolidarEntradaMensal`
- `calcularINSS`
- `calcularIRRF`
- `calcularLiquido`
- `openEntryDetailModal`
- `exportPDF`

The full inventory is in `docs/global-api-inventory.md`.
