import { performance } from 'node:perf_hooks';
import { buildSettingsReadModel } from '../src/application/readModels/settingsReadModel.js';

function fixture(size = 100) {
  const personalReferences = [];
  const sharedReferences = [];
  const people = [];
  for (let index = 0; index < size; index += 1) {
    const macro = `Macro ${index % 50}`;
    people.push({ id: `p-${index}`, type: 'pessoa', person: `Pessoa ${index}`, salary_base: 3000 + index, owner_uid: 'uid-a' });
    personalReferences.push({ id: `m-${index}`, type: 'macro', macro_category: macro, shared_scope: 'personal', owner_uid: 'uid-a' });
    personalReferences.push({ id: `c-${index}`, type: 'categoria', macro_category: macro, category_name: `Categoria ${index}`, shared_scope: 'personal', owner_uid: 'uid-a' });
    if (index % 10 === 0) sharedReferences.push({ id: `g-${index}`, type: 'macro', macro_category: `Global ${index}`, shared_scope: 'global' });
  }
  return {
    personalReferences,
    sharedReferences,
    localSettings: {},
    percentageRules: [],
    taxParameters: [],
    people,
    userProfile: { uid: 'uid-a', status: 'active', role: 'user' },
    permissions: {},
    options: { generatedAt: '2026-09-04T00:00:00.000Z' }
  };
}

const results = [100, 1000, 5000].map((size) => {
  const input = fixture(size);
  const start = performance.now();
  const model = buildSettingsReadModel(input);
  const elapsedMs = Number((performance.now() - start).toFixed(3));
  return {
    refs: size,
    elapsedMs,
    people: model.people.length,
    personalReferences: model.metadata.counts.personalReferences,
    sharedReferences: model.metadata.counts.sharedReferences,
    warnings: model.warnings.length
  };
});

console.log(JSON.stringify({ ok: true, wrote: false, results }, null, 2));
