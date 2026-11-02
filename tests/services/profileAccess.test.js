import { describe, expect, it, vi } from 'vitest';
import { createProfileAccessService } from '../../src/services/profileAccess.js';
import {
  getProfileAccessErrorMessage,
  normalizeProfileAccessError,
  PROFILE_ACCESS_ERROR
} from '../../src/services/profileAccessErrors.js';

const user = Object.freeze({ uid: 'user-test', email: 'user@example.test' });

function firebaseError(code) {
  return Object.assign(new Error('internal detail'), { code });
}

function setup({ claims = {}, profile = { uid: user.uid, status: 'active' } } = {}) {
  const authService = {
    signIn: vi.fn(),
    getClaims: vi.fn(async () => claims)
  };
  const userAdminService = {
    ensureProfile: vi.fn(async () => profile),
    getProfile: vi.fn(async () => profile)
  };
  return {
    authService,
    userAdminService,
    service: createProfileAccessService({ authService, userAdminService })
  };
}

describe('profile access error normalization', () => {
  it.each([
    ['resource-exhausted', PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED],
    ['firestore/unavailable', PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE],
    ['permission-denied', PROFILE_ACCESS_ERROR.PERMISSION_DENIED],
    ['unauthenticated', PROFILE_ACCESS_ERROR.SESSION_INVALID],
    ['not-found', PROFILE_ACCESS_ERROR.NOT_FOUND],
    ['unexpected', PROFILE_ACCESS_ERROR.LOAD_FAILED]
  ])('maps %s to %s', (source, expected) => {
    expect(normalizeProfileAccessError(firebaseError(source)).code).toBe(expected);
  });

  it('maps claims failures independently and exposes no internal detail in the UI', () => {
    const error = normalizeProfileAccessError(firebaseError('auth/network-request-failed'), { stage: 'claims' });
    expect(error.code).toBe(PROFILE_ACCESS_ERROR.CLAIMS_FAILED);
    expect(getProfileAccessErrorMessage(error)).not.toContain('internal detail');
  });

  it('uses the required post-login messages', () => {
    expect(getProfileAccessErrorMessage({ code: PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED }))
      .toContain('Seu login foi realizado');
    expect(getProfileAccessErrorMessage({ code: PROFILE_ACCESS_ERROR.PERMISSION_DENIED }))
      .toContain('não possui permissão');
    expect(getProfileAccessErrorMessage({ code: PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE }))
      .toContain('temporariamente indisponível');
  });
});

describe('profile access orchestration', () => {
  it.each(['active', 'pending', 'inactive'])('returns the %s profile without changing authorization', async (status) => {
    const { service } = setup({ profile: { uid: user.uid, status } });
    await expect(service.load(user)).resolves.toEqual({
      claims: {},
      profile: { uid: user.uid, status }
    });
  });

  it.each([
    ['resource-exhausted', PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED],
    ['unavailable', PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE],
    ['permission-denied', PROFILE_ACCESS_ERROR.PERMISSION_DENIED]
  ])('keeps a successful Auth session distinct from profile error %s', async (source, expected) => {
    const { service, userAdminService } = setup();
    userAdminService.ensureProfile.mockRejectedValue(firebaseError(source));
    await expect(service.load(user)).rejects.toMatchObject({ code: expected, stage: 'profile' });
  });

  it('distinguishes getClaims failure from profile loading', async () => {
    const { service, authService, userAdminService } = setup();
    authService.getClaims.mockRejectedValue(firebaseError('auth/network-request-failed'));
    await expect(service.load(user)).rejects.toMatchObject({ code: PROFILE_ACCESS_ERROR.CLAIMS_FAILED });
    expect(userAdminService.ensureProfile).not.toHaveBeenCalled();
  });

  it('recovers on manual profile retry without another signIn', async () => {
    const { service, authService, userAdminService } = setup();
    userAdminService.ensureProfile.mockRejectedValueOnce(firebaseError('resource-exhausted'));
    userAdminService.getProfile.mockResolvedValueOnce({ uid: user.uid, status: 'active' });

    await expect(service.load(user)).rejects.toMatchObject({ code: PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED });
    await expect(service.load(user, { retry: true })).resolves.toMatchObject({ profile: { status: 'active' } });
    expect(authService.signIn).not.toHaveBeenCalled();
    expect(authService.getClaims).toHaveBeenCalledTimes(2);
    expect(userAdminService.ensureProfile).toHaveBeenCalledTimes(1);
    expect(userAdminService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('does not create a profile during retry when it is absent', async () => {
    const { service, userAdminService } = setup();
    userAdminService.getProfile.mockResolvedValue(null);

    await expect(service.load(user, { retry: true }))
      .rejects.toMatchObject({ code: PROFILE_ACCESS_ERROR.NOT_FOUND });
    expect(userAdminService.ensureProfile).not.toHaveBeenCalled();
  });
});
