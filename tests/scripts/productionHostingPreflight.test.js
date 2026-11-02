import { describe, expect, it } from 'vitest';
import { evaluateHostingPreflight } from '../../scripts/production-hosting-preflight.mjs';

const valid = () => ({
  env: { VITE_FINANCE_ENV: 'production', VITE_FINANCE_USE_FIREBASE_EMULATORS: 'false', VITE_FIREBASE_API_KEY: 'public-web-key', VITE_FIREBASE_AUTH_DOMAIN: 'finance-control-cce4f.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'finance-control-cce4f', VITE_FIREBASE_STORAGE_BUCKET: 'bucket', VITE_FIREBASE_MESSAGING_SENDER_ID: '1050867234579', VITE_FIREBASE_APP_ID: 'app-id', VITE_DATA_BACKEND: 'firebase', VITE_DATA_DUAL_WRITE: 'false', VITE_DATA_SHADOW_READ: 'false' },
  deployment: { project: 'finance-control-cce4f', only: 'hosting' },
  repository: { branch: 'main', clean: true, head: 'new', expectedCommit: 'new', ciStatus: 'success', rollbackCommit: 'old', rollbackIsAncestor: true },
  build: { exists: true, publicDirectory: 'dist', forbiddenFindings: [], productionProjectOccurrences: 1, productionRuntimeMarkers: 1, stagingEndpointOccurrences: 0, stagingContractOccurrences: 1 }
});

describe('production Hosting preflight', () => {
  it('allows only proved static Hosting and treats missing Sentry as warning', () => {
    const result = evaluateHostingPreflight(valid());
    expect(result.decision).toBe('HOSTING DEPLOY GO');
    expect(result.approvedCommand).toBe('firebase deploy --only hosting --project finance-control-cce4f');
    expect(result.warnings).toContain('OPTIONAL_OBSERVABILITY:SENTRY_NOOP');
  });
  it.each([
    ['non-hosting scope', (x) => { x.deployment.only = 'hosting,firestore'; }], ['wrong target', (x) => { x.deployment.project = 'finance-control-staging-260919'; }],
    ['emulators', (x) => { x.env.VITE_FINANCE_USE_FIREBASE_EMULATORS = 'true'; }], ['concurrent backend', (x) => { x.env.VITE_DATA_BACKEND = 'supabase'; }],
    ['dual write', (x) => { x.env.VITE_DATA_DUAL_WRITE = 'true'; }], ['dirty tree', (x) => { x.repository.clean = false; }],
    ['wrong branch', (x) => { x.repository.branch = 'release/x'; }], ['red CI', (x) => { x.repository.ciStatus = 'failure'; }],
    ['missing rollback', (x) => { x.repository.rollbackCommit = ''; }], ['missing runtime markers', (x) => { x.build.productionRuntimeMarkers = 0; }], ['staging endpoint', (x) => { x.build.stagingEndpointOccurrences = 1; }],
    ['bundle secret', (x) => { x.build.forbiddenFindings = ['PRIVATE_KEY:assets/app.js']; }]
  ])('rejects %s', (_name, mutate) => { const input = valid(); mutate(input); expect(evaluateHostingPreflight(input).decision).toBe('NO-GO'); });
});
