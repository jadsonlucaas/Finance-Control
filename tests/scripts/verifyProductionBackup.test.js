import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyProductionBackup } from '../../scripts/verify-production-backup.mjs';

describe('production backup verifier', () => {
  it('validates counts and checksums without reading payload fields', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'finance-backup-'));
    const content = '{"document_path":"users/synthetic/finance_records/one","fields":{}}\n';
    await writeFile(join(dir, 'finance_records.jsonl'), content);
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({
      project_id: 'finance-control-cce4f',
      files: { 'finance_records.jsonl': { count: 1, sha256: createHash('sha256').update(content).digest('hex') } }
    }));
    await expect(verifyProductionBackup({ backupDir: dir })).resolves.toMatchObject({ ok: true });
  });

  it('rejects duplicate document paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'finance-backup-'));
    const row = '{"document_path":"users/synthetic/finance_records/one","fields":{}}\n';
    const content = row + row;
    await writeFile(join(dir, 'finance_records.jsonl'), content);
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ project_id: 'finance-control-cce4f', files: { 'finance_records.jsonl': { count: 2, sha256: createHash('sha256').update(content).digest('hex') } } }));
    await expect(verifyProductionBackup({ backupDir: dir })).rejects.toThrow('DUPLICATE_DOCUMENT');
  });
});
