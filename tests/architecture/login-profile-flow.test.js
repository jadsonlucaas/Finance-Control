import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getProfileAccessErrorMessage, PROFILE_ACCESS_ERROR } from '../../src/services/profileAccessErrors.js';

const source = readFileSync('src/legacy/inline/part-28.js', 'utf8');

describe('login/profile UI wiring', () => {
  it('retries profile access with the current user and never signs in again', () => {
    const refresh = source.slice(
      source.indexOf('async function refreshAccountStatus()'),
      source.indexOf('async function applyAuthState')
    );
    expect(refresh).toContain('applyAuthState(currentUser, { retry: true })');
    expect(refresh).not.toMatch(/\.signIn\s*\(/);
  });

  it('keeps financial UI closed while profile access is loading or failed', () => {
    const apply = source.slice(
      source.indexOf('async function applyAuthState'),
      source.indexOf('async function handleAuthSubmit')
    );
    expect(apply).toContain("profileState = 'loading'");
    expect(apply).toContain("profileState = 'error'");
    expect(apply).toContain("accessState = 'error'");
    expect(apply).toContain("app.classList.add('hidden')");
    expect(apply).not.toMatch(/\.signOut\s*\(/);
  });

  it('reserves password wording for Auth errors', () => {
    for (const code of Object.values(PROFILE_ACCESS_ERROR)) {
      expect(getProfileAccessErrorMessage({ code })).not.toMatch(/senha/i);
    }
  });
});
