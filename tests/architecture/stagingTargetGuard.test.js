import { describe, expect, it } from 'vitest';
import { assertStagingTarget } from '../../scripts/assert-staging-target.mjs';

describe('staging target guard', () => {
  it('allows only the explicit staging project allowlist', () => {
    expect(assertStagingTarget('finance-control-staging-260919')).toMatchObject({
      ok: true,
      projectId: 'finance-control-staging-260919'
    });
  });

  it('rejects known production projects', () => {
    expect(() => assertStagingTarget('finance-control-cce4f')).toThrow(
      'STAGING_TARGET_IS_PRODUCTION:finance-control-cce4f'
    );
  });

  it('rejects empty, ambiguous and non-allowlisted targets', () => {
    expect(() => assertStagingTarget('')).toThrow('STAGING_TARGET_REQUIRED');
    expect(() => assertStagingTarget('default')).toThrow('STAGING_TARGET_AMBIGUOUS_ALIAS:default');
    expect(() => assertStagingTarget('finance-control-random')).toThrow(
      'STAGING_TARGET_NOT_ALLOWLISTED:finance-control-random'
    );
  });
});
