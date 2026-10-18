import {
  createMutationAttemptContext as defaultCreateMutationAttemptContext,
  payloadMatchesMutationAttempt as defaultPayloadMatchesMutationAttempt,
  safeAttemptForStorage
} from '../../application/resilience/mutationAttemptContext.js';

export function createMemoryMutationAttemptStore(options = {}) {
  const createMutationAttemptContext = options.createMutationAttemptContext || defaultCreateMutationAttemptContext;
  const payloadMatchesMutationAttempt = options.payloadMatchesMutationAttempt || defaultPayloadMatchesMutationAttempt;
  const attempts = new Map();

  function getOrCreate({ key = 'record-form', commandName = '', payload = {}, authContext = {}, sourceReferenceId = '' } = {}) {
    const stored = attempts.get(key) || null;
    const attemptInput = { commandName, payload, context: authContext, sourceChannel: 'web' };
    if (stored?.commandName === commandName && payloadMatchesMutationAttempt(stored, attemptInput)) {
      return stored;
    }
    const attempt = createMutationAttemptContext({
      commandName,
      sourceChannel: 'web',
      payload,
      context: authContext,
      details: { sourceReferenceId }
    }, options);
    attempts.set(key, safeAttemptForStorage(attempt));
    return attempts.get(key);
  }

  return {
    getOrCreate,
    peek: (key = 'record-form') => attempts.get(key) || null,
    clear: (key = 'record-form') => attempts.delete(key),
    clearAll: () => attempts.clear()
  };
}
