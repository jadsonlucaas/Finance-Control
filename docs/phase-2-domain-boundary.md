# Phase 2 Domain Boundary

Phase 2 separates calculation/data modules from UI concerns.

## Pure Module Scope

These directories are treated as pure logic:

- `src/core`
- `src/domain`

Pure modules may import other pure modules, receive data through parameters, and return data. They must not read the DOM, mutate UI, access browser globals directly, render charts, or schedule icon work.

## Forbidden In Pure Modules

- `document.getElementById(...)`
- `document.querySelector(...)`
- `window.someApi`
- `localStorage`
- `Chart`
- `lucide`

If a rule needs storage, DOM state, chart instances, authenticated user data, or current form values, that dependency belongs in a UI/service adapter that calls the pure function with explicit parameters.

## Enforcement

The boundary is enforced by:

```powershell
npm.cmd test
```

Specifically:

- `tests/architecture/domain-purity.test.js` scans `src/core` and `src/domain` for forbidden browser/UI dependencies.
- Existing domain tests cover taxes, entries, dashboard aggregation, hours, DSR, percentage rules, dates and money.
- `tests/domain/imports.test.js` adds coverage for import normalization.

## Migration Rule

Prefer this shape:

```js
buildDashboardEntradasSummary(entradas);
```

Avoid this shape in `src/core` or `src/domain`:

```js
function buildDashboardEntradasSummary() {
  const person = document.getElementById('f-person').value;
}
```

UI modules are responsible for collecting form/filter state and passing plain values into domain modules.
