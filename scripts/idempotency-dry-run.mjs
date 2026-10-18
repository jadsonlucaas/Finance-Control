import { readFile } from 'node:fs/promises';
import { buildOperationFingerprint } from '../src/application/gateway/idempotency.js';
import { validateOperationMetadata } from '../src/application/gateway/operationMetadata.js';

async function readCommands(path) {
  if (!path) return [];
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.commands || [];
}

function commandKey(command = {}) {
  return [
    command.ownerUid || command.owner_uid || command.authContext?.ownerUid || '',
    command.commandName || '',
    command.source?.channel || command.sourceChannel || 'web',
    command.idempotencyKey || ''
  ].join('|');
}

function analyze(commands = []) {
  const fingerprints = new Map();
  const findings = [];
  commands.forEach((command, index) => {
    const ownerUid = command.ownerUid || command.owner_uid || command.authContext?.ownerUid || '';
    const sourceChannel = command.source?.channel || command.sourceChannel || 'web';
    const idempotencyKey = command.idempotencyKey || '';
    const metadata = validateOperationMetadata({
      source_channel: sourceChannel,
      source_reference_id: command.source?.referenceId || command.sourceReferenceId || '',
      idempotency_key: idempotencyKey,
      correlation_id: command.correlationId || ''
    });
    const fingerprint = buildOperationFingerprint({
      ownerUid,
      commandName: command.commandName || '',
      sourceChannel,
      payload: command.payload || {}
    });
    const key = commandKey(command);

    if (!idempotencyKey) findings.push({ index, type: 'MISSING_IDEMPOTENCY_KEY', commandName: command.commandName || '' });
    if (!command.correlationId) findings.push({ index, type: 'MISSING_CORRELATION_ID', commandName: command.commandName || '' });
    if (!sourceChannel) findings.push({ index, type: 'MISSING_SOURCE_CHANNEL', commandName: command.commandName || '' });
    metadata.errors.forEach((error) => findings.push({ index, type: 'INVALID_METADATA', field: error.field, code: error.code }));

    const previous = fingerprints.get(key);
    if (previous && previous !== fingerprint) {
      findings.push({ index, type: 'FINGERPRINT_CONFLICT', key });
    }
    if (previous && previous === fingerprint) {
      findings.push({ index, type: 'POSSIBLE_DUPLICATE', key });
    }
    fingerprints.set(key, fingerprint);
  });
  return {
    wrote: false,
    commands: commands.length,
    findings,
    fingerprints: [...fingerprints.entries()].map(([key, fingerprint]) => ({ key, fingerprint }))
  };
}

const path = process.argv[2] || '';
const result = analyze(await readCommands(path));
console.log(JSON.stringify(result, null, 2));
