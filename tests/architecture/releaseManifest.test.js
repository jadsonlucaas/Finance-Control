import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertNoLocalSecrets, sha256Text } from '../../scripts/generate-release-manifest.mjs';

describe('release candidate manifest', () => {
  it('uses deterministic hashes for tracked artifact metadata', () => {
    expect(sha256Text('finance-control')).toBe(sha256Text('finance-control'));
    expect(sha256Text('finance-control')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('records staging safety constraints without local secrets or production actions', () => {
    const manifest = JSON.parse(readFileSync('docs/release-candidate-manifest.json', 'utf8'));

    expect(manifest.constraints.deployExecuted).toBe(false);
    expect(manifest.constraints.firebaseRealTouched).toBe(false);
    expect(manifest.constraints.restoreRealEnabled).toBe(false);
    expect(manifest.constraints.adminSdkInClient).toBe(false);
    expect(manifest.firebase.requiredStagingProject).toBe('finance-control-staging-260919');
    expect(manifest.firebase.stagingProjectNumber).toBe('945561850688');
    expect(manifest.firebase.stagingValidationStatus).toBe('not_validated');
    expect(manifest.firebase.emulatorProjectForRehearsal).toBe('demo-finance-control-local-e2e');
    expect(manifest.firebase.rulesFile.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.packageLock.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(assertNoLocalSecrets(manifest)).toBe(true);
  });
});
