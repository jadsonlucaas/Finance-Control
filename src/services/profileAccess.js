import { captureError, captureMessage } from './observability/index.js';
import {
  getProfileAccessTelemetryEvent,
  normalizeProfileAccessError
} from './profileAccessErrors.js';

export function createProfileAccessService({ authService, userAdminService }) {
  async function load(user, { retry = false } = {}) {
    const context = { operation: retry ? 'profile.retry' : 'profile.load', authenticated: true };
    if (retry) captureMessage('profile.retry', context);
    captureMessage('profile.load.start', context);

    let claims;
    try {
      claims = await authService.getClaims(true) || {};
    } catch (error) {
      const normalized = normalizeProfileAccessError(error, { stage: 'claims' });
      captureError(error, { ...context, error_code: normalized.code, stage: 'claims' });
      captureMessage(retry ? 'profile.retry.failure' : 'profile.load.failure', { ...context, error_code: normalized.code });
      throw normalized;
    }

    try {
      const profile = retry
        ? await userAdminService.getProfile(user.uid)
        : await userAdminService.ensureProfile(user);
      if (!profile) throw Object.assign(new Error('PROFILE_NOT_FOUND'), { code: 'not-found' });
      captureMessage('profile.load.success', { ...context, account_status: profile?.status || 'unknown' });
      if (retry) captureMessage('profile.retry.success', { ...context, account_status: profile?.status || 'unknown' });
      return { claims, profile };
    } catch (error) {
      const normalized = normalizeProfileAccessError(error, { stage: 'profile' });
      captureError(error, { ...context, error_code: normalized.code, stage: 'profile' });
      captureMessage(getProfileAccessTelemetryEvent(normalized), { ...context, error_code: normalized.code });
      if (retry) captureMessage('profile.retry.failure', { ...context, error_code: normalized.code });
      throw normalized;
    }
  }

  return { load };
}
