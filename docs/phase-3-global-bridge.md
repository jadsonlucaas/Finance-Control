# Phase 3 Global Compatibility Bridge

Phase 3 introduces one official compatibility point for pure helpers that still need to be available on `window` while legacy scripts are migrated.

## Bridge

The bridge lives at:

```text
src/legacy/globalBridge.js
```

It exports:

- `GLOBAL_BRIDGE_API`
- `installGlobalBridge(target)`

`src/app.js` installs it during bootstrap:

```js
installGlobalBridge(globalThis);
```

`installCoreGlobals(target)` remains as a backwards-compatible alias and delegates to `installGlobalBridge(target)`.

## Current Scope

The bridge exposes pure `core` and `domain` helpers, including:

- money/date/import normalization helpers
- hour calculations
- tax calculations
- dashboard aggregation helpers
- monthly entry consolidation helpers
- DSR helpers
- percentage rule helpers

It also preserves `financeDomain` aliases used by legacy scripts.

## Important Migration Rule

During the migration, do not introduce new direct global assignments for pure helpers from scattered scripts.

Prefer:

```js
import { installGlobalBridge } from './legacy/globalBridge.js';

installGlobalBridge(window);
```

Avoid:

```js
window.calcularINSS = calcularINSS;
```

outside the bridge.

## Validation

The bridge is covered by:

```text
tests/legacy/globalBridge.test.js
```

The smoke test also confirms `window.financeGlobalBridge` exists in the running browser.
