import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function firebaseCliCredential() {
  const auth = require('firebase-tools/lib/auth');
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('FIREBASE_CLI_CREDENTIAL_REQUIRED');
  return {
    async getAccessToken() {
      const tokens = await auth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes);
      if (!tokens?.access_token) throw new Error('FIREBASE_CLI_ACCESS_TOKEN_UNAVAILABLE');
      return { access_token: tokens.access_token, expires_in: Number(tokens.expires_in || 3600) };
    }
  };
}

export async function firebaseCliApplicationDefaultPath() {
  const auth = require('firebase-tools/lib/auth');
  const defaults = require('firebase-tools/lib/defaultCredentials');
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error('FIREBASE_CLI_CREDENTIAL_REQUIRED');
  const path = await defaults.getCredentialPathAsync(account);
  if (!path) throw new Error('APPLICATION_DEFAULT_CREDENTIAL_UNAVAILABLE');
  return path;
}
