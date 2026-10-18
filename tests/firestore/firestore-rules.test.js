import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const PROJECT_ID = 'finance-control-local-test';
const NOW = '2026-07-18T00:00:00.000Z';

let testEnv;

function emailFor(uid) {
  return `${uid}@example.test`;
}

function profile(uid, overrides = {}) {
  return {
    uid,
    email: emailFor(uid),
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function initialProfile(uid, overrides = {}) {
  return profile(uid, {
    status: 'pending',
    ...overrides
  });
}

function financeRecord(uid, overrides = {}) {
  return {
    type: 'saida',
    person: 'Pessoa Teste',
    description: 'Despesa teste',
    amount: 123.45,
    status: 'Em aberto',
    competence: '2026-07',
    owner_uid: uid,
    owner_email: emailFor(uid),
    ...overrides
  };
}

function installmentPaymentRecord(uid, overrides = {}) {
  return financeRecord(uid, {
    person: 'Jadson',
    description: 'E2E parcelamento emulator (1/3)',
    purchase_name: 'E2E parcelamento emulator',
    amount: 33.33,
    amount_cents: 3333,
    status: 'Em aberto',
    paid_at: '',
    occurred_date: '2026-09-15',
    due_date: '2026-09-15',
    competence: '2026-09',
    macro_category: 'FIXO',
    subcategory: 'Moradia E2E',
    category_name: 'Moradia E2E',
    payment_method: 'Cartao E2E',
    card: 'Cartao E2E',
    cycle: 'INICIO_MES',
    installment_no: 1,
    total_installments: 3,
    parent_id: 'p_rules_installment_series',
    is_installment: true,
    source_mode: 'installment',
    source_channel: 'web',
    source_reference_id: 'entry-form',
    created_by_type: 'user',
    created_by_id: uid,
    idempotency_key: 'idem-installment-payment',
    correlation_id: 'corr-installment-payment',
    schema_version: 1,
    archived: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  });
}

function canonicalHourRecord(uid, overrides = {}) {
  return {
    type: 'controle_horas',
    owner_uid: uid,
    owner_email: emailFor(uid),
    person: 'Jadson',
    description: 'Banco de horas local',
    amount: 0,
    competence: '2026-06',
    occurred_date: '2026-06-12',
    hour_control_type: 'Banco de Horas',
    hour_entry_type: 'Banco de Horas',
    start_time: '08:00',
    end_time: '17:00',
    horaInicial: '08:00',
    horaFinal: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    break_start_time: '12:00',
    break_end_time: '13:00',
    crosses_midnight: false,
    ended_date: '2026-06-12',
    gross_minutes: 540,
    break_minutes: 60,
    net_minutes: 480,
    quantidadeHoras: 8,
    quantidadeHorasFormatada: '08:00',
    hours_quantity: 8,
    hours_formatted: '08:00',
    valorTotalCalculado: 0,
    financial_total: 0,
    observation: 'Banco de horas local',
    salary_base_snapshot: 5000,
    salary_base_reference: 5000,
    monthly_hours_reference: 220,
    bank_nature: 'Debito',
    bank_minutes: 480,
    overtime_percentage: 0,
    percentualUsado: 0,
    base_hourly_rate_cents: 2273,
    calculated_value_cents: 0,
    financial_hour_value: 0,
    hour_value_base: 22.73,
    valorBaseHora: 22.73,
    valorHoraCalculado: 0,
    calculation_version: 1,
    source_channel: 'web',
    source_reference_id: 'hour-control-form',
    created_by_type: 'user',
    created_by_id: uid,
    idempotency_key: 'idem-hour-create',
    correlation_id: 'corr-hour-create',
    schema_version: 1,
    archived: false,
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  };
}

function localStorageRecord(uid, key = 'finance-control-theme-v1', overrides = {}) {
  return {
    key,
    value: 'dark',
    updated_at: NOW,
    owner_uid: uid,
    owner_email: emailFor(uid),
    ...overrides
  };
}

function auditLog(uid, overrides = {}) {
  return {
    action: 'finance_record.create',
    actor_uid: uid,
    actor_email: emailFor(uid),
    created_at: NOW,
    status: 'success',
    source: 'web',
    details: { record_id: 'record-1' },
    ...overrides
  };
}

function canonicalAuditLog(uid, overrides = {}) {
  return {
    event_id: 'audit-canonical-1',
    event_type: 'EXPENSE_CREATED',
    category: 'financial',
    event_version: 1,
    occurred_at: NOW,
    actor_uid: uid,
    actor_type: 'user',
    actor_role: 'user',
    owner_uid: uid,
    source_channel: 'web',
    operation: 'finance_record.create',
    entity_type: 'finance_record',
    entity_id: 'record-1',
    entity_ids: [],
    correlation_id: 'corr-audit-1',
    idempotency_key_hash: 'fnv1a32:audit',
    command_name: 'CreateExpenseCommand',
    result_status: 'success',
    result_code: '',
    before: null,
    after: { amount: 123.45, status: 'Em aberto' },
    metadata: { source_reference_id: 'manual' },
    schema_version: 1,
    action: 'finance_record.create',
    created_at: NOW,
    status: 'success',
    source: 'web',
    details: { entity_id: 'record-1' },
    ...overrides
  };
}

function idempotencyReceipt(uid, overrides = {}) {
  return {
    owner_uid: uid,
    command_name: 'CreateExpenseCommand',
    source_channel: 'web',
    idempotency_key: 'idem-1',
    request_fingerprint: 'fnv1a32:test',
    status: 'processing',
    entity_id: '',
    entity_ids: [],
    result_code: '',
    correlation_id: 'corr-1',
    created_at: NOW,
    completed_at: '',
    failed_at: '',
    schema_version: 1,
    ...overrides
  };
}

function taxParameter(overrides = {}) {
  return {
    id: 'legacy-unverified-inss-app-baseline',
    tax_type: 'inss',
    version: 'legacy-unverified-inss-app-baseline',
    valid_from: '2026-01',
    valid_to: '',
    status: 'active',
    source_name: 'baseline legado sem fonte',
    source_reference: 'Valores hardcoded existentes no app antes do versionamento.',
    source_published_at: '',
    notes: 'Nao utilizar como tabela oficial sem validacao externa.',
    brackets: [
      { from_cents: 0, to_cents: 162100, rate: 0.075, deduction_cents: 0, order: 1 },
      { from_cents: 162101, to_cents: 290284, rate: 0.09, deduction_cents: 2432, order: 2 }
    ],
    deductions: {},
    ceiling_cents: 847555,
    created_at: NOW,
    updated_at: NOW,
    schema_version: 1,
    ...overrides
  };
}

function sharedMacro(ownerUid = 'admin-user', overrides = {}) {
  return {
    type: 'macro',
    macro_id: 'macro_fixo',
    macro_category: 'FIXO',
    shared_scope: 'global',
    owner_uid: ownerUid,
    owner_email: emailFor(ownerUid),
    ...overrides
  };
}

function sharedCategory(ownerUid = 'admin-user', overrides = {}) {
  return {
    type: 'categoria',
    category_id: 'cat_fixo_moradia',
    macro_id: 'macro_fixo',
    macro_category: 'FIXO',
    category_name: 'Moradia',
    category_color: '#38bdf8',
    category_icon: 'home',
    shared_scope: 'global',
    owner_uid: ownerUid,
    owner_email: emailFor(ownerUid),
    ...overrides
  };
}

function personalMacro(uid = 'active-user', overrides = {}) {
  return {
    ...sharedMacro(uid, {
      macro_id: 'macro_pessoal',
      macro_category: 'PESSOAL',
      shared_scope: 'personal',
      ...overrides
    })
  };
}

function personalCategory(uid = 'active-user', overrides = {}) {
  return {
    ...sharedCategory(uid, {
      category_id: 'cat_pessoal_casa',
      macro_id: 'macro_pessoal',
      macro_category: 'PESSOAL',
      category_name: 'Casa',
      shared_scope: 'personal',
      ...overrides
    })
  };
}

function dbFor(uid, token = {}) {
  return testEnv.authenticatedContext(uid, {
    email: emailFor(uid),
    ...token
  }).firestore();
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function seedProfiles() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/active-user'), profile('active-user'));
    await setDoc(doc(db, 'users/pending-user'), profile('pending-user', { status: 'pending' }));
    await setDoc(doc(db, 'users/inactive-user'), profile('inactive-user', { status: 'inactive' }));
    await setDoc(doc(db, 'users/user-a'), profile('user-a'));
    await setDoc(doc(db, 'users/user-b'), profile('user-b'));
    await setDoc(doc(db, 'users/admin-user'), profile('admin-user', { role: 'admin' }));
    await setDoc(doc(db, 'users/owner-user'), profile('owner-user', { role: 'owner' }));
    await setDoc(doc(db, 'users/inactive-admin'), profile('inactive-admin', { role: 'admin', status: 'inactive' }));
  });
}

async function seedPrivateData(uid = 'active-user') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `users/${uid}/finance_records/record-1`), financeRecord(uid));
    await setDoc(doc(db, `users/${uid}/local_storage/finance-control-theme-v1`), localStorageRecord(uid));
    await setDoc(doc(db, `users/${uid}/audit_logs/audit-1`), auditLog(uid));
  });
}

async function seedSharedData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'shared_macros/macro-fixo'), sharedMacro());
    await setDoc(doc(db, 'shared_categories/cat-moradia'), sharedCategory());
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Rules - usuario ativo', () => {
  it('01 usuario ativo le o proprio perfil', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'users/active-user')));
  });

  it('02 usuario ativo le os proprios finance_records', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'users/active-user/finance_records/record-1')));
  });

  it('03 usuario ativo cria finance_record valido', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(
      doc(db, 'users/active-user/finance_records/new-record'),
      financeRecord('active-user')
    ));
  });

  it('04 usuario ativo atualiza finance_record proprio', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertSucceeds(updateDoc(doc(db, 'users/active-user/finance_records/record-1'), {
      ...financeRecord('active-user'),
      amount: 200
    }));
  });

  it('05 usuario ativo exclui finance_record proprio', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertSucceeds(deleteDoc(doc(db, 'users/active-user/finance_records/record-1')));
  });

  it('06 usuario ativo le local_storage proprio', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'users/active-user/local_storage/finance-control-theme-v1')));
  });

  it('07 usuario ativo grava local_storage proprio', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(
      doc(db, 'users/active-user/local_storage/finance-control-theme-v1'),
      localStorageRecord('active-user')
    ));
  });

  it('08 usuario ativo cria audit_log proprio valido', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(
      doc(db, 'users/active-user/audit_logs/audit-new'),
      auditLog('active-user')
    ));
  });

  it('08A usuario ativo cria audit_log canonico proprio append-only', async () => {
    await seedProfiles();
    const db = dbFor('active-user');
    const ref = doc(db, 'users/active-user/audit_logs/audit-canonical');

    await assertSucceeds(setDoc(ref, canonicalAuditLog('active-user')));
    await assertFails(updateDoc(ref, { result_status: 'failure' }));
    await assertFails(deleteDoc(ref));
  });

  it('08B audit_log canonico rejeita ator cruzado, fonte invalida, correlacao ausente e campos sensiveis', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/audit_logs/audit-cross-actor'),
      canonicalAuditLog('user-b')
    ));
    await assertFails(setDoc(
      doc(db, 'users/active-user/audit_logs/audit-bad-source'),
      canonicalAuditLog('active-user', { source_channel: 'whatsapp', source: 'whatsapp' })
    ));
    await assertFails(setDoc(
      doc(db, 'users/active-user/audit_logs/audit-no-corr'),
      canonicalAuditLog('active-user', { correlation_id: '' })
    ));
    await assertFails(setDoc(
      doc(db, 'users/active-user/audit_logs/audit-sensitive'),
      canonicalAuditLog('active-user', { phone: '55999999999' })
    ));
  });

  it('09 usuario ativo le os proprios audit_logs quando permitido', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'users/active-user/audit_logs/audit-1')));
  });
});

describe('Firestore Rules - usuario inativo', () => {
  it('10 usuario inativo nao le finance_records', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-user');
    const db = dbFor('inactive-user');

    await assertFails(getDoc(doc(db, 'users/inactive-user/finance_records/record-1')));
  });

  it('11 usuario inativo nao cria finance_records', async () => {
    await seedProfiles();
    const db = dbFor('inactive-user');

    await assertFails(setDoc(
      doc(db, 'users/inactive-user/finance_records/new-record'),
      financeRecord('inactive-user')
    ));
  });

  it('12 usuario inativo nao atualiza finance_records', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-user');
    const db = dbFor('inactive-user');

    await assertFails(updateDoc(doc(db, 'users/inactive-user/finance_records/record-1'), {
      ...financeRecord('inactive-user'),
      amount: 200
    }));
  });

  it('13 usuario inativo nao exclui finance_records', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-user');
    const db = dbFor('inactive-user');

    await assertFails(deleteDoc(doc(db, 'users/inactive-user/finance_records/record-1')));
  });

  it('14 usuario inativo nao le local_storage', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-user');
    const db = dbFor('inactive-user');

    await assertFails(getDoc(doc(db, 'users/inactive-user/local_storage/finance-control-theme-v1')));
  });

  it('15 usuario inativo nao grava local_storage', async () => {
    await seedProfiles();
    const db = dbFor('inactive-user');

    await assertFails(setDoc(
      doc(db, 'users/inactive-user/local_storage/finance-control-theme-v1'),
      localStorageRecord('inactive-user')
    ));
  });

  it('16 usuario inativo nao le audit_logs', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-user');
    const db = dbFor('inactive-user');

    await assertFails(getDoc(doc(db, 'users/inactive-user/audit_logs/audit-1')));
  });

  it('17 usuario inativo nao cria audit_logs', async () => {
    await seedProfiles();
    const db = dbFor('inactive-user');

    await assertFails(setDoc(
      doc(db, 'users/inactive-user/audit_logs/audit-new'),
      auditLog('inactive-user')
    ));
  });
});

describe('Firestore Rules - isolamento entre usuarios', () => {
  it('18 usuario A nao le finance_records do usuario B', async () => {
    await seedProfiles();
    await seedPrivateData('user-b');
    const db = dbFor('user-a');

    await assertFails(getDoc(doc(db, 'users/user-b/finance_records/record-1')));
  });

  it('19 usuario A nao cria registros no caminho do usuario B', async () => {
    await seedProfiles();
    const db = dbFor('user-a');

    await assertFails(setDoc(doc(db, 'users/user-b/finance_records/new-record'), financeRecord('user-b')));
  });

  it('20 usuario A nao atualiza registros do usuario B', async () => {
    await seedProfiles();
    await seedPrivateData('user-b');
    const db = dbFor('user-a');

    await assertFails(updateDoc(doc(db, 'users/user-b/finance_records/record-1'), {
      ...financeRecord('user-b'),
      amount: 500
    }));
  });

  it('21 usuario A nao exclui registros do usuario B', async () => {
    await seedProfiles();
    await seedPrivateData('user-b');
    const db = dbFor('user-a');

    await assertFails(deleteDoc(doc(db, 'users/user-b/finance_records/record-1')));
  });

  it('22 usuario A nao acessa local_storage do usuario B', async () => {
    await seedProfiles();
    await seedPrivateData('user-b');
    const db = dbFor('user-a');

    await assertFails(getDoc(doc(db, 'users/user-b/local_storage/finance-control-theme-v1')));
  });

  it('23 usuario A nao acessa audit_logs do usuario B', async () => {
    await seedProfiles();
    await seedPrivateData('user-b');
    const db = dbFor('user-a');

    await assertFails(getDoc(doc(db, 'users/user-b/audit_logs/audit-1')));
  });

  it('24 usuario A nao altera o perfil do usuario B', async () => {
    await seedProfiles();
    const db = dbFor('user-a');

    await assertFails(updateDoc(doc(db, 'users/user-b'), {
      ...profile('user-b'),
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });
});

describe('Firestore Rules - perfil e administracao', () => {
  it('25 usuario sem perfil nao acessa finance_records', async () => {
    await seed('users/no-profile/finance_records/record-1', financeRecord('no-profile'));
    const db = dbFor('no-profile');

    await assertFails(getDoc(doc(db, 'users/no-profile/finance_records/record-1')));
  });

  it('26 usuario sem perfil nao acessa local_storage', async () => {
    await seed('users/no-profile/local_storage/finance-control-theme-v1', localStorageRecord('no-profile'));
    const db = dbFor('no-profile');

    await assertFails(getDoc(doc(db, 'users/no-profile/local_storage/finance-control-theme-v1')));
  });

  it('27 usuario sem perfil nao acessa audit_logs', async () => {
    await seed('users/no-profile/audit_logs/audit-1', auditLog('no-profile'));
    const db = dbFor('no-profile');

    await assertFails(getDoc(doc(db, 'users/no-profile/audit_logs/audit-1')));
  });

  it('28 usuario cria somente o proprio perfil inicial', async () => {
    const db = dbFor('new-user');

    await assertSucceeds(setDoc(doc(db, 'users/new-user'), initialProfile('new-user')));
    await assertFails(setDoc(doc(db, 'users/other-new-user'), initialProfile('other-new-user')));
  });

  it('29 perfil inicial exige role user', async () => {
    const db = dbFor('new-user');

    await assertFails(setDoc(doc(db, 'users/new-user'), initialProfile('new-user', { role: 'admin' })));
  });

  it('30 perfil inicial exige status pending', async () => {
    const db = dbFor('new-user');

    await assertFails(setDoc(doc(db, 'users/new-user'), profile('new-user', { status: 'active' })));
    await assertFails(setDoc(doc(db, 'users/new-user'), profile('new-user', { status: 'inactive' })));
  });

  it('31 usuario nao cria perfil inicial com role admin', async () => {
    const db = dbFor('new-user');

    await assertFails(setDoc(doc(db, 'users/new-user'), initialProfile('new-user', { role: 'admin' })));
  });

  it('32 usuario nao altera o proprio role', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user'), {
      ...profile('active-user'),
      role: 'admin',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('33 usuario nao altera o proprio status', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user'), {
      ...profile('active-user'),
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('34 usuario comum nao lista outros perfis', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(getDocs(collection(db, 'users')));
  });

  it('35 admin ativo le perfis quando permitido', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');
    const ownerDb = dbFor('owner-user');
    const claimAdminDb = dbFor('active-user', { admin: true });

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(getDocs(collection(ownerDb, 'users')));
    await assertSucceeds(getDocs(collection(claimAdminDb, 'users')));
  });

  it('36 admin ativo atualiza role e status quando permitido', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');
    const ownerDb = dbFor('owner-user');

    await assertSucceeds(updateDoc(doc(db, 'users/user-a'), {
      role: 'admin',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
    await assertSucceeds(updateDoc(doc(ownerDb, 'users/user-b'), {
      role: 'user',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('37 admin inativo nao deve manter acesso administrativo pelo perfil', async () => {
    await seedProfiles();
    const db = dbFor('inactive-admin');

    await assertFails(getDocs(collection(db, 'users')));
  });

  it('69 usuario pending nao acessa dados financeiros pessoais', async () => {
    await seedProfiles();
    await seedPrivateData('pending-user');
    const db = dbFor('pending-user');

    await assertFails(getDoc(doc(db, 'users/pending-user/finance_records/record-1')));
    await assertFails(getDoc(doc(db, 'users/pending-user/local_storage/finance-control-theme-v1')));
    await assertFails(getDoc(doc(db, 'users/pending-user/audit_logs/audit-1')));
  });

  it('70 admin aprova usuario pending para active', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertSucceeds(updateDoc(doc(db, 'users/pending-user'), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('71 admin bloqueia usuario pending sem liberar acesso financeiro', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertSucceeds(updateDoc(doc(db, 'users/pending-user'), {
      role: 'user',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('72 admin nao retorna usuario inactive para pending', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertFails(updateDoc(doc(db, 'users/inactive-user'), {
      role: 'user',
      status: 'pending',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });
});

describe('Firestore Rules - autoridade administrativa por claim e perfil', () => {
  it('57 usuario com claim admin e perfil active exerce autoridade administrativa', async () => {
    await seedProfiles();
    const db = dbFor('active-user', { admin: true });

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users/user-a'), {
      role: 'admin',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('58 usuario com claim admin e perfil inactive mantem autoridade de recuperacao', async () => {
    await seedProfiles();
    const db = dbFor('inactive-admin', { admin: true });

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users/inactive-admin'), {
      role: 'admin',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('59 usuario com claim admin sem perfil pode administrar perfis existentes', async () => {
    await seedProfiles();
    const db = dbFor('claim-admin-no-profile', { admin: true });

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users/user-b'), {
      role: 'user',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('60 usuario com role admin em perfil active administra sem claim', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(updateDoc(doc(db, 'users/user-a'), {
      role: 'user',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('61 usuario com role admin em perfil inactive nao administra sem claim', async () => {
    await seedProfiles();
    const db = dbFor('inactive-admin');

    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, 'users/user-a'), {
      role: 'admin',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('62 usuario comum sem claim nao acessa funcoes administrativas', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, 'users/user-a'), {
      role: 'admin',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('63 usuario nao consegue atribuir claim ou privilegio administrativo a si mesmo pelo cliente', async () => {
    const db = dbFor('new-user');

    await assertFails(setDoc(doc(db, 'users/new-user'), {
      ...initialProfile('new-user'),
      admin: true
    }));
    await assertFails(setDoc(doc(db, 'users/new-user'), initialProfile('new-user', { role: 'owner' })));
  });

  it('64 claim admin le dados administrativos e referencias compartilhadas sem perfil', async () => {
    await seedProfiles();
    await seedSharedData();
    await seedPrivateData('user-a');
    const db = dbFor('claim-admin-no-profile', { admin: true });

    await assertSucceeds(getDoc(doc(db, 'users/user-a')));
    await assertSucceeds(getDoc(doc(db, 'users/user-a/finance_records/record-1')));
    await assertSucceeds(getDoc(doc(db, 'shared_macros/macro-fixo')));
    await assertSucceeds(getDoc(doc(db, 'shared_categories/cat-moradia')));
  });

  it('65 claim admin inactive nao enfraquece bloqueio das proprias subcolecoes pessoais', async () => {
    await seedProfiles();
    await seedPrivateData('inactive-admin');
    const db = dbFor('inactive-admin', { admin: true });

    await assertFails(getDoc(doc(db, 'users/inactive-admin/finance_records/record-1')));
    await assertFails(getDoc(doc(db, 'users/inactive-admin/local_storage/finance-control-theme-v1')));
    await assertFails(setDoc(
      doc(db, 'users/inactive-admin/audit_logs/audit-new'),
      auditLog('inactive-admin')
    ));
  });

  it('66 claim admin sem perfil nao executa operacoes pessoais nas proprias subcolecoes', async () => {
    await seed('users/claim-admin-no-profile/finance_records/record-1', financeRecord('claim-admin-no-profile'));
    const db = dbFor('claim-admin-no-profile', { admin: true });

    await assertFails(getDoc(doc(db, 'users/claim-admin-no-profile/finance_records/record-1')));
    await assertFails(setDoc(
      doc(db, 'users/claim-admin-no-profile/local_storage/finance-control-theme-v1'),
      localStorageRecord('claim-admin-no-profile')
    ));
  });

  it('67 claim admin nao ganha escrita financeira nao prevista em subcolecoes de usuarios', async () => {
    await seedProfiles();
    await seedPrivateData('user-a');
    const db = dbFor('active-user', { admin: true });

    await assertFails(setDoc(
      doc(db, 'users/user-a/finance_records/admin-created-record'),
      financeRecord('user-a')
    ));
    await assertFails(updateDoc(doc(db, 'users/user-a/audit_logs/audit-1'), auditLog('user-a', {
      action: 'tamper'
    })));
  });

  it('68 claim admin pode recuperar perfil sem abrir acesso publico', async () => {
    await seedProfiles();
    const adminDb = dbFor('claim-admin-no-profile', { admin: true });
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(setDoc(doc(adminDb, 'users/claim-admin-no-profile'), initialProfile('claim-admin-no-profile')));
    await assertFails(getDocs(collection(anonDb, 'users')));
  });
});

describe('Firestore Rules - colecoes compartilhadas', () => {
  it('38 usuario ativo le shared_macros', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'shared_macros/macro-fixo')));
  });

  it('39 usuario ativo le shared_categories', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertSucceeds(getDoc(doc(db, 'shared_categories/cat-moradia')));
  });

  it('40 usuario inativo nao le shared_macros', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('inactive-user');

    await assertFails(getDoc(doc(db, 'shared_macros/macro-fixo')));
  });

  it('41 usuario inativo nao le shared_categories', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('inactive-user');

    await assertFails(getDoc(doc(db, 'shared_categories/cat-moradia')));
  });

  it('42 usuario comum nao cria shared_macros', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'shared_macros/new-macro'), sharedMacro('active-user')));
  });

  it('43 usuario comum nao atualiza shared_macros', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'shared_macros/macro-fixo'), {
      ...sharedMacro(),
      macro_category: 'VARIAVEL'
    }));
  });

  it('44 usuario comum nao exclui shared_macros', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertFails(deleteDoc(doc(db, 'shared_macros/macro-fixo')));
  });

  it('45 usuario comum nao cria shared_categories', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'shared_categories/new-category'), sharedCategory('active-user')));
  });

  it('46 usuario comum nao atualiza shared_categories', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'shared_categories/cat-moradia'), {
      ...sharedCategory(),
      category_name: 'Aluguel'
    }));
  });

  it('47 usuario comum nao exclui shared_categories', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertFails(deleteDoc(doc(db, 'shared_categories/cat-moradia')));
  });

  it('48 admin ativo executa as operacoes compartilhadas permitidas', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertSucceeds(setDoc(doc(db, 'shared_macros/admin-macro'), sharedMacro('admin-user')));
    await assertSucceeds(updateDoc(doc(db, 'shared_macros/admin-macro'), {
      ...sharedMacro('admin-user'),
      macro_category: 'RESERVA'
    }));
    await assertSucceeds(deleteDoc(doc(db, 'shared_macros/admin-macro')));
    await assertSucceeds(setDoc(doc(db, 'shared_categories/admin-category'), sharedCategory('admin-user')));
    await assertSucceeds(updateDoc(doc(db, 'shared_categories/admin-category'), {
      ...sharedCategory('admin-user'),
      category_name: 'Investimentos'
    }));
    await assertSucceeds(deleteDoc(doc(db, 'shared_categories/admin-category')));
  });
});

describe('Firestore Rules - referencias globais e pessoais', () => {
  it('73 active le globais e pending/inactive nao leem', async () => {
    await seedProfiles();
    await seedSharedData();

    await assertSucceeds(getDoc(doc(dbFor('active-user'), 'shared_macros/macro-fixo')));
    await assertSucceeds(getDoc(doc(dbFor('active-user'), 'shared_categories/cat-moradia')));
    await assertFails(getDoc(doc(dbFor('pending-user'), 'shared_macros/macro-fixo')));
    await assertFails(getDoc(doc(dbFor('inactive-user'), 'shared_categories/cat-moradia')));
  });

  it('74 user comum nao cria atualiza ou exclui global', async () => {
    await seedProfiles();
    await seedSharedData();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'shared_macros/user-global'), sharedMacro('active-user')));
    await assertFails(updateDoc(doc(db, 'shared_macros/macro-fixo'), { ...sharedMacro(), macro_category: 'OUTRA' }));
    await assertFails(deleteDoc(doc(db, 'shared_categories/cat-moradia')));
  });

  it('75 admin claim cria atualiza e exclui globais', async () => {
    await seedProfiles();
    const db = dbFor('claim-admin', { admin: true });

    await assertSucceeds(setDoc(doc(db, 'shared_macros/claim-macro'), sharedMacro('claim-admin')));
    await assertSucceeds(updateDoc(doc(db, 'shared_macros/claim-macro'), { ...sharedMacro('claim-admin'), macro_category: 'RESERVA' }));
    await assertSucceeds(deleteDoc(doc(db, 'shared_macros/claim-macro')));
  });

  it('76 admin por perfil active mantem global e inactive nao mantem', async () => {
    await seedProfiles();
    await seedSharedData();

    await assertSucceeds(setDoc(doc(dbFor('admin-user'), 'shared_categories/admin-cat'), sharedCategory('admin-user')));
    await assertFails(setDoc(doc(dbFor('inactive-admin'), 'shared_categories/inactive-cat'), sharedCategory('inactive-admin')));
  });

  it('77 active cria macro e categoria pessoal proprias', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/personal-macro'), personalMacro('active-user')));
    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/personal-cat'), personalCategory('active-user')));
  });

  it('78 outro usuario nao le nem altera referencia pessoal', async () => {
    await seedProfiles();
    await seed('users/user-b/finance_records/personal-cat', personalCategory('user-b'));
    const db = dbFor('user-a');

    await assertFails(getDoc(doc(db, 'users/user-b/finance_records/personal-cat')));
    await assertFails(updateDoc(doc(db, 'users/user-b/finance_records/personal-cat'), {
      ...personalCategory('user-b'),
      category_name: 'Alterada'
    }));
  });

  it('79 pending e inactive nao criam referencias pessoais', async () => {
    await seedProfiles();

    await assertFails(setDoc(doc(dbFor('pending-user'), 'users/pending-user/finance_records/personal-macro'), personalMacro('pending-user')));
    await assertFails(setDoc(doc(dbFor('inactive-user'), 'users/inactive-user/finance_records/personal-cat'), personalCategory('inactive-user')));
  });

  it('80 owner_uid divergente em referencia pessoal e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-owner-ref'), personalMacro('other-user')));
  });

  it('81 shared_scope invalido e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-scope'), personalMacro('active-user', {
      shared_scope: 'whatsapp'
    })));
  });

  it('82 personal no caminho shared e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertFails(setDoc(doc(db, 'shared_macros/personal-shared'), personalMacro('admin-user')));
  });

  it('83 global no finance_records privado e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/global-private'), sharedMacro('active-user')));
  });

  it('84 nomes e campos invalidos de referencias sao rejeitados', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/blank-macro'), personalMacro('active-user', {
      macro_category: ''
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/blank-cat'), personalCategory('active-user', {
      category_name: ''
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-icon'), personalCategory('active-user', {
      category_icon: 123
    })));
  });

  it('84A configuracao local pessoal e owner-scoped e rejeita acesso cruzado', async () => {
    await seedProfiles();
    const ownerDb = dbFor('user-a');
    const otherDb = dbFor('user-b');
    const ref = doc(ownerDb, 'users/user-a/local_storage/finance-control-settings-scope-v1');

    await assertSucceeds(setDoc(ref, localStorageRecord('user-a', 'finance-control-settings-scope-v1', {
      value: '{"theme":"dark","density":"compact"}'
    })));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(otherDb, 'users/user-a/local_storage/finance-control-settings-scope-v1')));
    await assertFails(setDoc(doc(otherDb, 'users/user-a/local_storage/finance-control-settings-scope-v1'), localStorageRecord('user-b', 'finance-control-settings-scope-v1')));
  });

  it('84B configuracao local com contrato invalido e rejeitada', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/local_storage/theme-v1'), localStorageRecord('active-user', 'theme-v1')));
    await assertFails(setDoc(doc(db, 'users/active-user/local_storage/finance-control-bad-owner-v1'), localStorageRecord('other-user', 'finance-control-bad-owner-v1')));
    await assertFails(setDoc(doc(db, 'users/active-user/local_storage/finance-control-bad-value-v1'), localStorageRecord('active-user', 'finance-control-bad-value-v1', {
      value: { theme: 'dark' }
    })));
  });
});

describe('Firestore Rules - formato e propriedade', () => {
  it('49 owner_uid diferente do uid do caminho e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/finance_records/bad-owner'),
      financeRecord('other-user')
    ));
  });

  it('50 atualizacao que altera owner_uid e rejeitada', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user/finance_records/record-1'), {
      ...financeRecord('active-user'),
      owner_uid: 'other-user'
    }));
  });

  it('51 atualizacao que altera owner_email e rejeitada', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user/finance_records/record-1'), {
      ...financeRecord('active-user'),
      owner_email: 'other@example.test'
    }));
  });

  it('52 tipo financeiro invalido e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/finance_records/invalid-type'),
      financeRecord('active-user', { type: 'telefone_whatsapp' })
    ));
  });

  it('53 documento sem campos minimos e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/missing-fields'), {
      type: 'saida',
      amount: 10
    }));
  });

  it('54 amount com tipo invalido e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/finance_records/bad-amount'),
      financeRecord('active-user', { amount: '10' })
    ));
  });

  it('55 archived com tipo invalido e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/finance_records/bad-archived'),
      financeRecord('active-user', { archived: 'false' })
    ));
  });

  it('56 competence com tipo invalido e rejeitado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(
      doc(db, 'users/active-user/finance_records/bad-competence'),
      financeRecord('active-user', { competence: 202607 })
    ));
  });
});

describe('Firestore Rules - contratos por tipo financeiro', () => {
  it('85 aceita shape minimo valido de cada tipo financeiro pessoal', async () => {
    await seedProfiles();
    const db = dbFor('active-user');
    const basePath = 'users/active-user/finance_records';
    const cases = [
      ['saida', financeRecord('active-user', { type: 'saida', amount: 10, competence: '2026-07', status: 'Pago', paid_at: '2026-07-10' })],
      ['entrada', financeRecord('active-user', { type: 'entrada', amount: 10, competence: '2026-07', status: 'Pago' })],
      ['pessoa', financeRecord('active-user', { type: 'pessoa', person: 'Ana', salary_base: 5000 })],
      ['controle', financeRecord('active-user', { type: 'controle_horas', competence: '2026-07', hour_control_type: 'Hora Extra', quantidadeHoras: 2 })],
      ['salario', financeRecord('active-user', { type: 'salario_historico', person: 'Ana', salary_base: 5000, vigencia_inicio: '2026-01', vigencia_fim: '2026-07' })],
      ['percentual', financeRecord('active-user', { type: 'percentage_rule', percentage: 10, base_type: 'salario', cycle: 'INICIO_MES', status: 'active', startCompetence: '2026-01', endCompetence: '2026-07' })]
    ];

    for (const [id, payload] of cases) {
      await assertSucceeds(setDoc(doc(db, `${basePath}/${id}`), payload));
    }
  });

  it('86 aceita metadata multicanal opcional valida sem abrir autorizacao', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/metadata-valid'), financeRecord('active-user', {
      source_channel: 'system',
      source_reference_id: 'cmd-1',
      created_by_type: 'integration',
      created_by_id: 'backend',
      idempotency_key: 'idem-1',
      correlation_id: 'corr-1',
      received_at: NOW,
      processed_at: NOW
    })));
    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/materialized-percentage'), financeRecord('active-user', {
      type: 'saida',
      amount: 500,
      status: 'Em aberto',
      competence: '2026-07',
      generated_percentage_rule: true,
      percentage_rule_id: 'rule-1',
      percentage_occurrence_key: 'percentage-rule:owner:rule-1:person-1:2026-07:abcd1234',
      percentage_rule_version: 1,
      percentage_materialized_at: NOW,
      percentage_calculation_version: 1,
      percentage_rate: 10,
      percentage_base: 'salario',
      percentage_base_amount: 5000,
      percentage_base_amount_cents: 500000,
      percentage_calculated_amount_cents: 50000,
      source_channel: 'system',
      source_reference_id: 'percentage-rule:owner:rule-1:person-1:2026-07:abcd1234'
    })));
  });

  it('87 rejeita metadata multicanal invalida', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-source-channel'), financeRecord('active-user', {
      source_channel: 'whatsapp'
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-idempotency'), financeRecord('active-user', {
      idempotency_key: ''
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-occurrence-key'), financeRecord('active-user', {
      type: 'saida',
      generated_percentage_rule: true,
      percentage_occurrence_key: ''
    })));
  });

  it('88 rejeita alteracao de type em update', async () => {
    await seedProfiles();
    await seedPrivateData('active-user');
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user/finance_records/record-1'), {
      ...financeRecord('active-user', { type: 'entrada' })
    }));
  });

  it('89 rejeita campos de telefone e whatsapp em registros financeiros', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/phone'), financeRecord('active-user', {
      phone: '559999999999'
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/whatsapp'), financeRecord('active-user', {
      whatsapp_phone: '559999999999'
    })));
  });

  it('90 rejeita status, competencia e parcelas incoerentes de saida', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-status'), financeRecord('active-user', { status: 'Quitado' })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-date'), financeRecord('active-user', { due_date: '07/18/2026' })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-installment'), financeRecord('active-user', { installment_no: 3, total_installments: 2 })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-installment-decimal'), financeRecord('active-user', { installment_no: 1.5, total_installments: 2, parent_id: 'series' })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-installment-parent'), financeRecord('active-user', { installment_no: 1, total_installments: 2, parent_id: '' })));
  });

  it('91 aceita saida nao parcelada e parcela valida', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/single-expense'), financeRecord('active-user', {
      installment_no: 0,
      total_installments: 0,
      parent_id: ''
    })));
    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/valid-installment'), financeRecord('active-user', {
      amount: 33.34,
      installment_no: 2,
      total_installments: 3,
      parent_id: 'series-ok',
      is_installment: true,
      source_mode: 'installment'
    })));
  });

  it('91A usuario ativo paga a propria parcela com payload completo sem relaxar isolamento', async () => {
    await seedProfiles();
    await seed('users/active-user/finance_records/installment-payment', installmentPaymentRecord('active-user'));
    await seed('users/user-b/finance_records/installment-payment', installmentPaymentRecord('user-b'));

    const paymentPayload = installmentPaymentRecord('active-user', {
      status: 'Pago',
      paid_at: '2026-09-20',
      updated_at: '2026-09-20T12:00:00.000Z'
    });
    const paymentRef = doc(dbFor('active-user'), 'users/active-user/finance_records/installment-payment');

    await assertSucceeds(updateDoc(paymentRef, paymentPayload));
    const paidSnapshot = await assertSucceeds(getDoc(paymentRef));
    expect(paidSnapshot.data()).toMatchObject({
      owner_uid: 'active-user',
      owner_email: emailFor('active-user'),
      type: 'saida',
      status: 'Pago',
      paid_at: '2026-09-20',
      parent_id: 'p_rules_installment_series',
      installment_no: 1,
      total_installments: 3
    });

    await assertFails(updateDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/active-user/finance_records/installment-payment'), paymentPayload));
    await assertFails(updateDoc(doc(dbFor('user-b'), 'users/active-user/finance_records/installment-payment'), {
      ...paymentPayload,
      source_channel: 'system',
      created_by_type: 'integration',
      created_by_id: 'backend'
    }));
    await assertFails(updateDoc(doc(dbFor('pending-user'), 'users/pending-user/finance_records/missing'), installmentPaymentRecord('pending-user', {
      status: 'Pago',
      paid_at: '2026-09-20'
    })));
    await assertFails(updateDoc(doc(dbFor('inactive-user'), 'users/inactive-user/finance_records/missing'), installmentPaymentRecord('inactive-user', {
      status: 'Pago',
      paid_at: '2026-09-20'
    })));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, owner_uid: 'user-b' }));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, type: 'entrada' }));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, status: 'Quitado' }));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, paid_at: '20/09/2026' }));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, total_installments: '3' }));
    await assertFails(updateDoc(paymentRef, { ...paymentPayload, phone: '559999999999' }));
  });

  it('92 valida campos opcionais de recorrencia nova sem quebrar legado', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/legacy-recurrence'), financeRecord('active-user', {
      recurrence: 'anual'
    })));
    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/valid-recurrence'), financeRecord('active-user', {
      recurrence: 'mensal',
      recurrence_frequency: 'monthly',
      recurrence_count: 2,
      recurrence_end_date: '',
      recurrence_series_id: 'r_ok',
      recurrence_sequence_no: 1,
      recurrence_total_occurrences: 2,
      source_mode: 'recurring'
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-recurrence'), financeRecord('active-user', {
      recurrence_frequency: 'weekly',
      recurrence_sequence_no: 3,
      recurrence_total_occurrences: 2
    })));
  });

  it('93 rejeita shapes invalidos de entrada, pessoa, horas, salario e regra percentual', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-entry'), financeRecord('active-user', { type: 'entrada', competence: '202607' })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-person'), financeRecord('active-user', { type: 'pessoa', person: '', salary_base: 1 })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-hours'), financeRecord('active-user', { type: 'controle_horas', quantidadeHoras: -1 })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-salary'), financeRecord('active-user', { type: 'salario_historico', salary_base: 0 })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-rule'), financeRecord('active-user', { type: 'percentage_rule', percentage: 101 })));
  });

  it('93A valida contrato moderno de controle_horas sem recalcular jornada', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/hour-modern'), financeRecord('active-user', {
      type: 'controle_horas',
      person: 'Ana',
      competence: '2026-07',
      occurred_date: '2026-07-31',
      hour_control_type: 'Hora Extra',
      hour_entry_type: 'Hora Extra',
      start_time: '22:00',
      end_time: '06:00',
      crosses_midnight: true,
      gross_minutes: 480,
      break_minutes: 0,
      net_minutes: 480,
      overtime_percentage: 50,
      base_hourly_rate_cents: 2000,
      calculated_value_cents: 24000,
      dsr_value_cents: 0,
      calculation_version: 1,
      salary_source_record_id: 'salary-1'
    })));

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/hour-legacy'), financeRecord('active-user', {
      type: 'controle_horas',
      competence: '2026-07',
      hour_control_type: 'Hora Extra',
      quantidadeHoras: 2,
      quantidadeHorasFormatada: '02:00',
      percentualUsado: 50,
      valorTotalCalculado: 60
    })));
  });

  it('93A1 usuario ativo cria e edita controle_horas canonico completo com rules ativas', async () => {
    await seedProfiles();
    const db = dbFor('active-user');
    const createPayload = canonicalHourRecord('active-user');

    const createdRef = await assertSucceeds(addDoc(collection(db, 'users/active-user/finance_records'), createPayload));
    const hourRef = doc(db, 'users/active-user/finance_records', createdRef.id);
    const created = await getDoc(hourRef);
    expect(created.data()).toMatchObject({
      type: 'controle_horas',
      owner_uid: 'active-user',
      owner_email: emailFor('active-user'),
      person: 'Jadson',
      start_time: '08:00',
      end_time: '17:00',
      net_minutes: 480,
      bank_minutes: 480,
      source_channel: 'web'
    });

    const updatePayload = canonicalHourRecord('active-user', {
      ...created.data(),
      idempotency_key: 'idem-hour-update',
      correlation_id: 'corr-hour-update',
      end_time: '18:00',
      horaFinal: '18:00',
      gross_minutes: 600,
      net_minutes: 540,
      quantidadeHoras: 9,
      quantidadeHorasFormatada: '09:00',
      hours_quantity: 9,
      hours_formatted: '09:00',
      bank_minutes: 540,
      observation: 'Banco de horas local editado',
      description: 'Banco de horas local editado',
      updated_at: '2026-07-18T00:01:00.000Z'
    });

    await assertSucceeds(updateDoc(hourRef, updatePayload));
    const updated = await getDoc(hourRef);
    expect(updated.data()).toMatchObject({
      type: 'controle_horas',
      owner_uid: 'active-user',
      owner_email: emailFor('active-user'),
      person: 'Jadson',
      start_time: '08:00',
      end_time: '18:00',
      net_minutes: 540,
      bank_minutes: 540
    });

    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users/active-user/finance_records/hour-unauth'), canonicalHourRecord('active-user')));
    await assertFails(setDoc(doc(dbFor('pending-user'), 'users/pending-user/finance_records/hour-pending'), canonicalHourRecord('pending-user')));
    await assertFails(setDoc(doc(dbFor('inactive-user'), 'users/inactive-user/finance_records/hour-inactive'), canonicalHourRecord('inactive-user')));
    await assertFails(getDoc(doc(dbFor('user-b'), 'users/active-user/finance_records/hour-canonical-real')));
    await assertFails(setDoc(doc(dbFor('active-user'), 'users/user-b/finance_records/hour-forged'), canonicalHourRecord('user-b', {
      owner_uid: 'active-user',
      owner_email: emailFor('active-user')
    })));
    await assertFails(updateDoc(hourRef, canonicalHourRecord('active-user', {
      owner_uid: 'user-b',
      owner_email: emailFor('user-b')
    })));
    await assertFails(updateDoc(hourRef, canonicalHourRecord('active-user', { type: 'saida' })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/hour-invalid-required'), canonicalHourRecord('active-user', {
      start_time: '25:00'
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/hour-forbidden-field'), canonicalHourRecord('active-user', {
      whatsapp: '+5500000000000'
    })));
    await assertFails(updateDoc(hourRef, canonicalHourRecord('active-user', {
      end_time: '19:00',
      horaFinal: '19:00',
      net_minutes: 600,
      owner_uid: 'user-b',
      updated_at: '2026-07-18T00:02:00.000Z'
    })));
  });

  it('93B rejeita campos canonicos invalidos de controle_horas', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-hour-clock'), financeRecord('active-user', {
      type: 'controle_horas',
      start_time: '25:00'
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-hour-break'), financeRecord('active-user', {
      type: 'controle_horas',
      break_minutes: -1
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-hour-net'), financeRecord('active-user', {
      type: 'controle_horas',
      net_minutes: 1.5
    })));
    await assertFails(setDoc(doc(db, 'users/active-user/finance_records/bad-hour-cross'), financeRecord('active-user', {
      type: 'controle_horas',
      crosses_midnight: 'sim'
    })));
  });

  it('94 pending e inactive continuam bloqueados mesmo com shape valido', async () => {
    await seedProfiles();

    await assertFails(setDoc(doc(dbFor('pending-user'), 'users/pending-user/finance_records/pending-contract'), financeRecord('pending-user')));
    await assertFails(setDoc(doc(dbFor('inactive-user'), 'users/inactive-user/finance_records/inactive-contract'), financeRecord('inactive-user')));
  });
});

describe('Firestore Rules - idempotency receipts', () => {
  it('99 active cria le completa e falha receipts proprios validos', async () => {
    await seedProfiles();
    const db = dbFor('active-user');
    const processingRef = doc(db, 'users/active-user/idempotency_receipts/idem-processing');
    const failRef = doc(db, 'users/active-user/idempotency_receipts/idem-fail');

    await assertSucceeds(setDoc(processingRef, idempotencyReceipt('active-user')));
    await assertSucceeds(setDoc(
      doc(db, 'users/active-user/idempotency_receipts/idem-percentage-materialization'),
      idempotencyReceipt('active-user', {
        source_channel: 'system',
        idempotency_key: 'percentage-materialization:rule-1:person-1:2026-07'
      })
    ));
    await assertSucceeds(getDoc(processingRef));
    await assertSucceeds(updateDoc(processingRef, {
      ...idempotencyReceipt('active-user', {
        status: 'completed',
        entity_id: 'expense-1',
        entity_ids: ['expense-1'],
        result_code: 'OK',
        completed_at: NOW,
        result_reference: {
          success: true,
          code: 'OK',
          entityId: 'expense-1',
          entityIds: ['expense-1'],
          message: 'Saida criada.'
        }
      })
    }));

    await assertSucceeds(setDoc(failRef, idempotencyReceipt('active-user', { idempotency_key: 'idem-fail' })));
    await assertSucceeds(updateDoc(failRef, {
      ...idempotencyReceipt('active-user', {
        idempotency_key: 'idem-fail',
        status: 'failed',
        result_code: 'PERSISTENCE_ERROR',
        failed_at: NOW
      })
    }));
  });

  it('100 bloqueia outro owner pending inactive e shapes invalidos de receipt', async () => {
    await seedProfiles();
    await seed('users/user-b/idempotency_receipts/idem-1', idempotencyReceipt('user-b'));

    await assertFails(getDoc(doc(dbFor('user-a'), 'users/user-b/idempotency_receipts/idem-1')));
    await assertFails(setDoc(doc(dbFor('pending-user'), 'users/pending-user/idempotency_receipts/idem-1'), idempotencyReceipt('pending-user')));
    await assertFails(setDoc(doc(dbFor('inactive-user'), 'users/inactive-user/idempotency_receipts/idem-1'), idempotencyReceipt('inactive-user')));
    await assertFails(setDoc(doc(dbFor('active-user'), 'users/active-user/idempotency_receipts/bad-owner'), idempotencyReceipt('other-user')));
    await assertFails(setDoc(doc(dbFor('active-user'), 'users/active-user/idempotency_receipts/bad-key'), idempotencyReceipt('active-user', { idempotency_key: '' })));
    await assertFails(setDoc(doc(dbFor('active-user'), 'users/active-user/idempotency_receipts/bad-source'), idempotencyReceipt('active-user', { source_channel: 'provider_direct' })));
    await assertFails(setDoc(doc(dbFor('active-user'), 'users/active-user/idempotency_receipts/completed-first'), idempotencyReceipt('active-user', { status: 'completed' })));
  });

  it('101 impede voltar completed para processing e alterar identidade', async () => {
    await seedProfiles();
    await seed('users/active-user/idempotency_receipts/completed', idempotencyReceipt('active-user', {
      status: 'completed',
      entity_id: 'expense-1',
      entity_ids: ['expense-1'],
      result_code: 'OK',
      completed_at: NOW
    }));
    await seed('users/active-user/idempotency_receipts/processing', idempotencyReceipt('active-user'));
    const db = dbFor('active-user');

    await assertFails(updateDoc(doc(db, 'users/active-user/idempotency_receipts/completed'), {
      ...idempotencyReceipt('active-user', { status: 'processing' })
    }));
    await assertFails(updateDoc(doc(db, 'users/active-user/idempotency_receipts/processing'), {
      ...idempotencyReceipt('active-user', {
        request_fingerprint: 'fnv1a32:other',
        status: 'completed'
      })
    }));
  });
});

describe('Firestore Rules - parametros tributarios versionados', () => {
  it('95 usuario ativo le tax_parameters e pending/inactive nao leem', async () => {
    await seedProfiles();
    await seed('tax_parameters/legacy-inss', taxParameter());

    await assertSucceeds(getDoc(doc(dbFor('active-user'), 'tax_parameters/legacy-inss')));
    await assertFails(getDoc(doc(dbFor('pending-user'), 'tax_parameters/legacy-inss')));
    await assertFails(getDoc(doc(dbFor('inactive-user'), 'tax_parameters/legacy-inss')));
  });

  it('96 somente admin ativo grava tax_parameters validos', async () => {
    await seedProfiles();

    await assertFails(setDoc(doc(dbFor('active-user'), 'tax_parameters/user-inss'), taxParameter({ id: 'user-inss' })));
    await assertFails(setDoc(doc(dbFor('inactive-admin'), 'tax_parameters/inactive-inss'), taxParameter({ id: 'inactive-inss' })));
    await assertSucceeds(setDoc(doc(dbFor('admin-user'), 'tax_parameters/admin-inss'), taxParameter({ id: 'admin-inss' })));
  });

  it('97 rejeita parametro tributario ativo sem fonte', async () => {
    await seedProfiles();
    const db = dbFor('admin-user');

    await assertFails(setDoc(doc(db, 'tax_parameters/no-source'), taxParameter({
      id: 'no-source',
      source_name: ''
    })));
  });

  it('98 aceita metadata tributaria versionada em entrada pessoal valida', async () => {
    await seedProfiles();
    const db = dbFor('active-user');

    await assertSucceeds(setDoc(doc(db, 'users/active-user/finance_records/entry-tax-version'), financeRecord('active-user', {
      type: 'entrada',
      amount: 5000,
      competence: '2026-07',
      status: 'Pago',
      inss: 465.06,
      irrf: 0,
      inss_parameter_version: 'legacy-unverified-inss-app-baseline',
      irrf_parameter_version: 'legacy-unverified-irrf-app-baseline',
      tax_calculated_at: NOW,
      tax_calculation_schema_version: 1
    })));
  });
});
