import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);

const CRITICAL_GLOBALS = [
  'renderDashboard',
  'renderEntradas',
  'renderSaidas',
  'switchTab',
  'handleSubmit',
  'openEditRecord',
  'togglePago',
  'toggleArchiveRecord',
  'confirmDelete',
  'consolidarEntradaMensal',
  'calcularINSS',
  'calcularIRRF',
  'calcularLiquido',
  'openEntryDetailModal',
  'openHourDetailModal',
  'savePerson',
  'saveMacroCategory',
  'savePercentageExitRule',
  'importSaidasSpreadsheet',
  'exportPDF'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseBrazilianCurrency(text = '') {
  const normalized = String(text || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function findChromeExecutable() {
  const executable = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome executable not found. Set PLAYWRIGHT_CHROME_EXECUTABLE to run smoke tests.');
  }
  return executable;
}

async function waitTwoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function assertViewActive(page, selector, label) {
  const state = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return { exists: false, active: false };
    return {
      exists: true,
      active: !element.classList.contains('hidden') && getComputedStyle(element).display !== 'none',
      className: element.className,
      display: getComputedStyle(element).display
    };
  }, selector);
  assert(state.exists, `${label} should exist.`);
  assert(state.active, `${label} should be active. State: ${JSON.stringify(state)}`);
}

const BASE_RECORDS = [
  {
    id: 'smoke-person-base',
    type: 'pessoa',
    person: 'Smoke Tester',
    salary_base: 4000
  },
  {
    id: 'smoke-macro-base',
    type: 'macro',
    macro_category: 'FIXO'
  },
  {
    id: 'smoke-category-base',
    type: 'categoria',
    macro_category: 'FIXO',
    category_name: 'Moradia',
    category_color: '#38bdf8',
    category_icon: 'home'
  }
];

const DETAIL_RECORDS = [
  ...BASE_RECORDS,
  {
    id: 'smoke-entry-detail-salary',
    type: 'entrada',
    person: 'Smoke Tester',
    macro_category: 'Rendimento',
    subcategory: 'Inicio do mes',
    description: 'Salário smoke',
    amount: 4200,
    status: 'Pago',
    competence: '2026-04',
    earning_type: 'Salario',
    cycle: 'INICIO_MES',
    created_at: '2026-04-01T00:00:00.000Z'
  },
  {
    id: 'smoke-salary-history-detail',
    type: 'salario_historico',
    person: 'Smoke Tester',
    vigencia_inicio: '2026-01',
    vigencia_fim: '',
    salary_base: 4200,
    amount: 4200,
    description: 'Salário histórico smoke',
    created_at: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'smoke-hour-extra-detail',
    type: 'controle_horas',
    person: 'Smoke Tester',
    competence: '2026-04',
    occurred_date: '2026-04-14',
    hour_control_type: 'Hora Extra',
    description: 'Hora extra smoke',
    start_time: '08:00',
    end_time: '09:30',
    quantidadeHoras: 1.5,
    quantidadeHorasFormatada: '01:30',
    hours_quantity: 1.5,
    hours_formatted: '01:30',
    percentualUsado: 1.5,
    overtime_percentage: 150,
    valorBaseHora: 19.09,
    valorHoraCalculado: 28.64,
    valorTotalCalculado: 42.96,
    financial_total: 42.96,
    bank_nature: '',
    created_at: '2026-04-14T00:00:00.000Z'
  },
  {
    id: 'smoke-hour-bank-detail',
    type: 'controle_horas',
    person: 'Smoke Tester',
    competence: '2026-04',
    occurred_date: '2026-04-15',
    hour_control_type: 'Banco de Horas',
    description: 'Banco de horas smoke',
    start_time: '14:56',
    end_time: '17:18',
    quantidadeHoras: 2.5,
    quantidadeHorasFormatada: '02:30',
    hours_quantity: 2.5,
    hours_formatted: '02:30',
    bank_nature: 'Débito',
    valorTotalCalculado: 0,
    created_at: '2026-04-15T00:00:00.000Z'
  },
  {
    id: 'smoke-pdf-expense',
    type: 'saida',
    description: 'Despesa real PDF smoke',
    person: 'Smoke Tester',
    macro_category: 'FIXO',
    subcategory: 'Moradia',
    competence: '2026-04',
    due_date: '2026-04-18',
    status: 'Pago',
    paid_at: '2026-04-18',
    payment_method: 'Pix',
    cycle: 'INICIO_MES',
    amount: 321.98,
    created_at: '2026-04-18T00:00:00.000Z'
  }
];

async function installSmokeDataSdk(page, records = BASE_RECORDS) {
  await page.evaluate((initialRecords) => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    window.__smokeRecords = clone(initialRecords);
    window.authSdk = {
      ...(window.authSdk || {}),
      getCurrentUser: () => ({ uid: 'smoke-user', email: 'smoke@example.test' })
    };
    window.currentUserProfile = {
      uid: 'smoke-user',
      email: 'smoke@example.test',
      role: 'admin',
      status: 'active'
    };

    const syncRecords = ({ render = true } = {}) => {
      window.allRecords = clone(window.__smokeRecords);
      if (render) window.renderAll?.();
    };

    window.dataSdk = {
      init: async () => ({ isOk: true }),
      create: async (payload) => {
        const id = payload.id || `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.__smokeRecords.push({ ...clone(payload), id });
        syncRecords();
        return { isOk: true, id };
      },
      createMany: async (payloads = []) => {
        const ids = payloads.map((payload) => payload.id || `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        payloads.forEach((payload, index) => {
          window.__smokeRecords.push({ ...clone(payload), id: ids[index] });
        });
        syncRecords();
        return { isOk: true, ids, count: payloads.length };
      },
      update: async (payload) => {
        window.__smokeRecords = window.__smokeRecords.map((record) =>
          record.id === payload.id ? { ...record, ...clone(payload) } : record
        );
        syncRecords();
        return { isOk: true, id: payload.id };
      },
      upsert: async (payload) => {
        const index = window.__smokeRecords.findIndex((record) => record.id === payload.id);
        if (index >= 0) {
          window.__smokeRecords[index] = { ...window.__smokeRecords[index], ...clone(payload) };
        } else {
          window.__smokeRecords.push(clone(payload));
        }
        syncRecords();
        return { isOk: true, id: payload.id };
      },
      delete: async (payload) => {
        window.__smokeRecords = window.__smokeRecords.filter((record) => record.id !== payload.id);
        syncRecords();
        return { isOk: true };
      }
    };

    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    syncRecords({ render: false });
  }, records);
  await waitTwoFrames(page);
}

async function assertCriticalRecordFlows(page) {
  await installSmokeDataSdk(page, BASE_RECORDS);

  const crudState = await page.evaluate(async () => {
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing form field: ${id}`);
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    document.getElementById('dashboard-expense-category-modal')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    window.openNewRecordFlow('saida');
    window.setFormCycle('INICIO_MES');
    setValue('form-type', 'saida');
    setValue('form-person', 'Smoke Tester');
    setValue('form-macro', 'FIXO');
    setValue('form-category', 'Moradia');
    setValue('form-desc', 'Fluxo teste criacao');
    setValue('form-amount', '123.45');
    setValue('form-status', 'Em aberto');
    setValue('form-payment', 'Pix');
    setValue('form-occurred', '2026-04-10');
    setValue('form-due', '2026-04-10');
    setValue('form-competence', '2026-04');
    await window.handleSubmit({ preventDefault() {} });

    const created = window.__smokeRecords.find((record) => record.description === 'Fluxo teste criacao');
    if (!created) return { created: false };

    window.openEditRecord(created);
    setValue('form-desc', 'Fluxo teste editado');
    setValue('form-amount', '234.56');
    await window.handleSubmit({ preventDefault() {} });

    const edited = window.__smokeRecords.find((record) => record.id === created.id);
    await window.togglePago(edited);
    const paid = window.__smokeRecords.find((record) => record.id === created.id);
    await window.toggleArchiveRecord(paid);
    const archived = window.__smokeRecords.find((record) => record.id === created.id);
    await window.toggleArchiveRecord(archived);
    const unarchived = window.__smokeRecords.find((record) => record.id === created.id);
    window.askDelete(unarchived);
    await window.confirmDelete();

    const deleted = !window.__smokeRecords.some((record) => record.id === created.id);
    return {
      created: true,
      editedDescription: edited?.description,
      editedAmount: edited?.amount,
      paidStatus: paid?.status,
      paidAt: paid?.paid_at,
      archived: archived?.archived === true,
      unarchived: unarchived?.archived === false,
      deleted
    };
  });

  assert(crudState.created, `Creating a new expense should persist a record. State: ${JSON.stringify(crudState)}`);
  assert(crudState.editedDescription === 'Fluxo teste editado', `Editing an expense should update description. State: ${JSON.stringify(crudState)}`);
  assert(crudState.editedAmount === 234.56, `Editing an expense should update amount. State: ${JSON.stringify(crudState)}`);
  assert(crudState.paidStatus === 'Pago' && Boolean(crudState.paidAt), `Marking expense as paid should set status and paid date. State: ${JSON.stringify(crudState)}`);
  assert(crudState.archived, `Archiving should mark the expense archived. State: ${JSON.stringify(crudState)}`);
  assert(crudState.unarchived, `Unarchiving should reopen the expense. State: ${JSON.stringify(crudState)}`);
  assert(crudState.deleted, `Deleting should remove the expense. State: ${JSON.stringify(crudState)}`);
}

async function assertConfigurationPersistence(page) {
  await installSmokeDataSdk(page, BASE_RECORDS);
  const configState = await page.evaluate(async () => {
    window.switchTab('configuracoes');
    window.addPerson?.();
    document.getElementById('person-input').value = 'Smoke Config Pessoa';
    document.getElementById('person-base-salary').value = '5555.55';
    await window.savePerson();

    window.addMacroCategory?.();
    document.getElementById('macro-input').value = 'SMOKE_CONFIG_MACRO';
    await window.saveMacroCategory();

    return {
      person: window.__smokeRecords.find((record) => record.type === 'pessoa' && record.person === 'Smoke Config Pessoa'),
      macro: window.__smokeRecords.find((record) => record.type === 'macro' && record.macro_category === 'SMOKE_CONFIG_MACRO')
    };
  });

  assert(configState.person?.salary_base === 5555.55, `Saving person settings should persist salary base. State: ${JSON.stringify(configState)}`);
  assert(Boolean(configState.macro), `Saving macro settings should persist the macro category. State: ${JSON.stringify(configState)}`);
}

async function assertPdfMatchesDashboardCards(page) {
  await page.evaluate(() => {
    const records = [
      { id: 'pdf-person', type: 'pessoa', person: 'PDF Smoke', salary_base: 5300, receiving_type: 'quinzenal' },
      { id: 'pdf-salary', type: 'salario_historico', person: 'PDF Smoke', competence: '2026-04', vigencia_inicio: '2026-01', salary_base: 5300, amount: 5300 },
      {
        id: 'pdf-entry-bonus',
        type: 'entrada',
        person: 'PDF Smoke',
        competence: '2026-04',
        macro_category: 'Receita',
        subcategory: 'Bonus',
        amount: 150,
        status: 'Pago'
      },
      {
        id: 'pdf-expense-paid',
        type: 'saida',
        person: 'PDF Smoke',
        competence: '2026-04',
        macro_category: 'FIXO',
        subcategory: 'Moradia',
        description: 'Despesa paga PDF',
        amount: 1200,
        status: 'Pago',
        cycle: 'INICIO_MES'
      },
      {
        id: 'pdf-expense-open',
        type: 'saida',
        person: 'PDF Smoke',
        competence: '2026-04',
        macro_category: 'VARIAVEL',
        subcategory: 'Mercado',
        description: 'Despesa aberta PDF',
        amount: 300,
        status: 'Em aberto',
        cycle: 'QUINZENA'
      }
    ];

    window.allRecords = records;
    window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('f-comp-start').value = '2026-04';
    document.getElementById('f-comp-end').value = '2026-04';
    document.getElementById('f-person').value = '';
    document.getElementById('f-macro').value = '';
    document.getElementById('f-cycle').value = '';
    window.switchTab('dashboard');
    window.renderDashboard();
  });
  await waitTwoFrames(page);

  const state = await page.waitForFunction(() => {
    const pdfData = window.getPdfDashboardFinancialData?.();
    if (!pdfData?.totals) return null;
    const summaryCards = Array.from(document.querySelectorAll('#summary-cards > div'));
    const cardsByLabel = Object.fromEntries(summaryCards.map((card) => {
      const texts = Array.from(card.querySelectorAll('p')).map((node) => node.textContent || '');
      return [texts[0] || '', texts[1] || ''];
    }));
    return {
      cardEntradas: cardsByLabel.Entradas || '',
      cardSaidas: cardsByLabel['Saidas pagas'] || '',
      cardAberto: cardsByLabel['Em aberto'] || '',
      cardSaldo: cardsByLabel.Saldo || '',
      pdfTotals: pdfData.totals
    };
  }, { timeout: 10_000 }).then((handle) => handle.jsonValue());

  assert(state.pdfTotals.receitas > 0, `PDF totals should be available from official dashboard source. State: ${JSON.stringify(state)}`);
  assert(state.cardEntradas.includes('R$') && state.cardSaidas.includes('R$') && state.cardAberto.includes('R$') && state.cardSaldo.includes('R$'), `Dashboard cards should expose financial values for comparison. State: ${JSON.stringify(state)}`);
  assert(parseBrazilianCurrency(state.cardEntradas) === state.pdfTotals.receitas, `Dashboard entries card should match the official PDF source. State: ${JSON.stringify(state)}`);
  assert(parseBrazilianCurrency(state.cardSaidas) === state.pdfTotals.despesas, `Dashboard paid expenses card should match the official PDF source. State: ${JSON.stringify(state)}`);
  assert(parseBrazilianCurrency(state.cardAberto) === state.pdfTotals.emAberto, `Dashboard open expenses card should match the official PDF source. State: ${JSON.stringify(state)}`);
  assert(parseBrazilianCurrency(state.cardSaldo) === state.pdfTotals.saldoProjetado, `Dashboard balance card should match the official PDF source. State: ${JSON.stringify(state)}`);
}

async function assertImportFlow(page) {
  await installSmokeDataSdk(page, BASE_RECORDS);
  const importState = await page.evaluate(async () => {
    window.switchTab('configuracoes');
    window.XLSX = {
      read: () => ({ SheetNames: ['Saidas'], Sheets: { Saidas: {} } }),
      utils: {
        sheet_to_json: () => [
          {
            Data: '2026-04-18',
            Classe: 'Inicio do mes',
            Categoria_macro: 'FIXO',
            Categoria: 'Moradia',
            Descricao: 'Importacao smoke saida',
            Parcela: '',
            'Valor Orcado': 'R$ 456,78',
            STATUS: 'Pago',
            Pagamento: 'Pix',
            'Quem paga': 'Smoke Tester',
            'Data competencia': '2026-04'
          }
        ]
      }
    };

    const input = document.getElementById('import-saidas-file');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['smoke'], 'saidas-smoke.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }));
    input.files = dataTransfer.files;
    await window.importSaidasSpreadsheet(false);

    const imported = window.__smokeRecords.find((record) => record.import_source === 'saidas_xlsx' && record.description === 'Importacao smoke saida');
    const summary = document.getElementById('import-report-summary')?.textContent || '';
    return {
      imported,
      summary
    };
  });

  assert(importState.imported?.amount === 456.78, `Importing expenses should create the mapped record. State: ${JSON.stringify(importState)}`);
  assert(importState.imported?.status === 'Pago', `Importing expenses should normalize paid status. State: ${JSON.stringify(importState)}`);
  assert(importState.summary.includes('1 importada'), `Import report should show imported count. State: ${JSON.stringify(importState)}`);
}

async function assertDiscountHistoryFlows(page) {
  await installSmokeDataSdk(page, [
    { id: 'discount-person', type: 'pessoa', person: 'Discount Smoke', salary_base: 5300, receiving_type: 'quinzenal' },
    { id: 'discount-salary', type: 'salario_historico', person: 'Discount Smoke', vigencia_inicio: '2026-01', salary_base: 5300, amount: 5300 },
    {
      id: 'discount-hour-extra',
      type: 'controle_horas',
      person: 'Discount Smoke',
      competence: '2026-05',
      hour_control_type: 'Hora Extra',
      financial_total: 0,
      valorTotalCalculado: 0
    }
  ]);

  await page.evaluate(() => {
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    window.switchTab('entradas');
    const competenceFilter = document.getElementById('entradas-competence-filter');
    if (competenceFilter) competenceFilter.value = '2026-05';
    window.renderEntradas();
  });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-entry-action="save-discount"]')), { timeout: 10_000 });

  const state = await page.evaluate(async () => {
    const inputId = `entry-discount-INICIO_MES-${encodeURIComponent('Discount Smoke|2026-05').replace(/[^a-zA-Z0-9]/g, '_')}`;
    const observationId = `entry-discount-note-INICIO_MES-${encodeURIComponent('Discount Smoke|2026-05').replace(/[^a-zA-Z0-9]/g, '_')}`;
    const getDiscountControls = () => ({
      saveButton: document.querySelector('[data-entry-action="save-discount"]'),
      viewButton: document.querySelector('[data-entry-action="view-discount-history"]'),
      input: document.getElementById(inputId),
      observation: document.getElementById(observationId)
    });

    let { saveButton, viewButton, input, observation } = getDiscountControls();
    if (!saveButton || !viewButton || !input || !observation) {
      return { found: false };
    }

    input.value = '300';
    observation.value = 'Falta';
    saveButton.click();

    ({ saveButton, viewButton, input, observation } = getDiscountControls());
    input.value = '96';
    observation.value = 'Drogaria';
    saveButton.click();

    ({ viewButton } = getDiscountControls());
    viewButton.click();

    const recordAfterSave = window.__smokeRecords.find((record) =>
      record.type === 'entrada' &&
      record.person === 'Discount Smoke' &&
      record.competence === '2026-05' &&
      record.entry_discount_adjustment === true
    );

    const totalBeforeDelete = document.getElementById('entry-discount-history-summary')?.textContent || '';
    const listBeforeDelete = document.getElementById('entry-discount-history-list')?.textContent || '';
    const deleteButtons = Array.from(document.querySelectorAll('[data-entry-discount-history-delete]'));
    deleteButtons[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const totalAfterDelete = document.getElementById('entry-discount-history-summary')?.textContent || '';
    const listAfterDelete = document.getElementById('entry-discount-history-list')?.textContent || '';
    const recordAfterDelete = window.__smokeRecords.find((record) =>
      record.type === 'entrada' &&
      record.person === 'Discount Smoke' &&
      record.competence === '2026-05' &&
      record.entry_discount_adjustment === true
    );

    return {
      found: true,
      recordAfterSave,
      totalBeforeDelete,
      listBeforeDelete,
      totalAfterDelete,
      listAfterDelete,
      recordAfterDelete
    };
  });

  assert(state.found, `Entry discount controls should render in Entradas. State: ${JSON.stringify(state)}`);
  assert(Array.isArray(state.recordAfterSave?.entry_discount_history) && state.recordAfterSave.entry_discount_history.length === 2, `Discount history should keep both saved items. State: ${JSON.stringify(state)}`);
  assert(Number(state.recordAfterSave?.amount) === 396, `Multiple saved discounts should accumulate into the manual discount total. State: ${JSON.stringify(state)}`);
  assert(state.totalBeforeDelete.includes('396,00'), `Discount history modal should show the accumulated total. State: ${JSON.stringify(state)}`);
  assert(state.listBeforeDelete.includes('Falta') && state.listBeforeDelete.includes('Drogaria'), `Discount history modal should list each saved item separately. State: ${JSON.stringify(state)}`);
  assert(Array.isArray(state.recordAfterDelete?.entry_discount_history) && state.recordAfterDelete.entry_discount_history.length === 1, `Deleting one discount item should keep the remaining history item only. State: ${JSON.stringify(state)}`);
  assert(Number(state.recordAfterDelete?.amount) > 0 && Number(state.recordAfterDelete?.amount) < 396, `Deleting one discount item should recalculate the record total instead of keeping the accumulated total. State: ${JSON.stringify(state)}`);
  assert(state.totalAfterDelete.includes(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(state.recordAfterDelete?.amount || 0))), `Discount history modal total should update after deleting one item. State: ${JSON.stringify(state)}`);
  assert(state.listAfterDelete !== state.listBeforeDelete, `Discount history modal should refresh its item list after a deletion. State: ${JSON.stringify(state)}`);
}

async function assertFixedMonthlyAndFilters(page) {
  await installSmokeDataSdk(page, [
    { id: 'filter-person-a', type: 'pessoa', person: 'Ana Smoke', salary_base: 5000, receiving_type: 'quinzenal' },
    { id: 'filter-person-b', type: 'pessoa', person: 'Bruno Smoke', salary_base: 4000 },
    { id: 'filter-salary-a', type: 'salario_historico', person: 'Ana Smoke', vigencia_inicio: '2026-07', salary_base: 5000, amount: 5000 },
    { id: 'filter-salary-b', type: 'salario_historico', person: 'Bruno Smoke', vigencia_inicio: '2026-07', salary_base: 4000, amount: 4000 },
    {
      id: 'fixed-open-ana',
      type: 'saida',
      person: 'Ana Smoke',
      description: 'Fixo mensal smoke',
      macro_category: 'FIXO',
      subcategory: 'Moradia',
      competence: '2026-07',
      cycle: 'QUINZENA',
      amount: 550,
      recurrence: 'mensal',
      status: 'Em aberto'
    },
    {
      id: 'variable-open-bruno',
      type: 'saida',
      person: 'Bruno Smoke',
      description: 'Variavel smoke',
      macro_category: 'VARIAVEL',
      subcategory: 'Lazer',
      competence: '2026-07',
      cycle: 'INICIO_MES',
      amount: 240,
      status: 'Em aberto'
    }
  ]);

  await page.evaluate(() => {
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('f-comp-start').value = '2026-07';
    document.getElementById('f-comp-end').value = '2026-07';
    document.getElementById('f-person').value = 'Ana Smoke';
    document.getElementById('f-macro').value = 'FIXO';
    document.getElementById('f-cycle').value = 'QUINZENA';

    window.switchTab('dashboard');
    window.renderDashboard();
    window.openMonthlyDetailTab?.('2026-07');
  });

  await page.waitForFunction(() => {
    const peopleText = document.getElementById('month-detail-people')?.textContent || '';
    const recordsText = document.getElementById('month-detail-records')?.textContent || '';
    return peopleText.includes('Ana Smoke') && recordsText.includes('Fixo mensal smoke');
  }, { timeout: 10_000 });

  const state = await page.evaluate(async () => {
    const peopleText = document.getElementById('month-detail-people')?.textContent || '';
    const recordsText = document.getElementById('month-detail-records')?.textContent || '';

    const fixedRecord = window.__smokeRecords.find((record) => record.id === 'fixed-open-ana');
    window.openEditRecord(fixedRecord);
    document.getElementById('form-desc').value = 'Fixo mensal smoke editado';
    document.getElementById('form-amount').value = '600';
    await window.handleSubmit({ preventDefault() {} });
    const edited = window.__smokeRecords.find((record) => record.id === 'fixed-open-ana');
    await window.togglePago(edited);
    const paid = window.__smokeRecords.find((record) => record.id === 'fixed-open-ana');

    return {
      peopleText,
      recordsText,
      edited,
      paid
    };
  });

  assert(state.recordsText.includes('Fixo mensal smoke') && !state.recordsText.includes('Variavel smoke') && !state.recordsText.includes('Bruno Smoke'), `Monthly detail filters by person, macro and cycle should restrict the month record list. State: ${JSON.stringify(state)}`);
  assert(state.edited?.description === 'Fixo mensal smoke editado' && Number(state.edited?.amount) === 600, `Fixed monthly item editing should persist through the same record workflow. State: ${JSON.stringify(state)}`);
  assert(state.paid?.status === 'Pago', `Fixed monthly item payment should update the record status. State: ${JSON.stringify(state)}`);
}

async function assertPercentageRuleFlow(page) {
  await installSmokeDataSdk(page, [
    { id: 'percentage-person', type: 'pessoa', person: 'Percent Smoke', salary_base: 5000, receiving_type: 'quinzenal' },
    { id: 'percentage-macro', type: 'macro', macro_category: 'RESERVA' },
    { id: 'percentage-category', type: 'categoria', macro_category: 'RESERVA', category_name: 'Investimentos', category_color: '#10b981', category_icon: 'piggy-bank' }
  ]);

  const state = await page.evaluate(async () => {
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('f-comp-start').value = '2026-04';
    document.getElementById('f-comp-end').value = '2026-04';
    document.getElementById('f-person').value = 'Percent Smoke';
    document.getElementById('f-macro').value = 'RESERVA';
    document.getElementById('f-cycle').value = 'INICIO_MES';
    window.switchTab('configuracoes');
    window.renderConfiguracoes?.();

    document.getElementById('percentage-rule-name').value = 'Reserva Smoke';
    document.getElementById('percentage-rule-person').value = 'Percent Smoke';
    document.getElementById('percentage-rule-rate').value = '10';
    document.getElementById('percentage-rule-base').value = 'salario';
    document.getElementById('percentage-rule-macro').value = 'RESERVA';
    window.syncPercentageRuleCategoryOptions?.();
    document.getElementById('percentage-rule-category').value = 'Investimentos';
    document.getElementById('percentage-rule-cycle').value = 'INICIO_MES';
    document.getElementById('percentage-rule-status').value = 'Em aberto';
    document.getElementById('percentage-rule-start').value = '2026-04';
    await window.savePercentageExitRule();
    window.switchTab('saidas');
    window.renderSaidas?.();
    const saidasList = document.getElementById('saidas-list');
    const toggleButton = saidasList?.querySelector('[data-percentage-exit-action="toggle-paid"], [data-finance-record-action="toggle-paid"]');
    toggleButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const paidGeneratedRecord = window.__smokeRecords.find((record) =>
      record.generated_percentage_rule === true &&
      record.description?.includes('Reserva Smoke') &&
      record.competence === '2026-04'
    );
    window.renderSaidas?.();

    const ruleRecord = window.__smokeRecords.find((record) =>
      (record.type === 'percentage_rule' || record.type === 'regra_percentual_saida') &&
      record.name === 'Reserva Smoke'
    );

    return {
      ruleRecord,
      paidGeneratedRecord,
      saidasText: document.getElementById('saidas-list')?.textContent || '',
      rulesListText: document.getElementById('percentage-exit-rules-list')?.textContent || ''
    };
  });

  assert(Boolean(state.ruleRecord), `Saving percentage rules should persist the rule record. State: ${JSON.stringify(state)}`);
  assert(state.paidGeneratedRecord?.status === 'Pago', `Marking a generated percentage expense as paid should persist its status. State: ${JSON.stringify(state)}`);
  assert(state.rulesListText.includes('Reserva Smoke'), `Saved percentage rules should appear in settings. State: ${JSON.stringify(state)}`);
  assert(state.saidasText.includes('Reserva Smoke') && state.saidasText.includes('Regra percentual') && state.saidasText.includes('R$ 500,00'), `Saving a percentage rule should generate a visible fixed monthly expense in the filtered expenses list. State: ${JSON.stringify(state)}`);
}

async function assertDetailModalsAndPdf(page) {
  await installSmokeDataSdk(page, DETAIL_RECORDS);
  const detailState = await page.evaluate(async () => {
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    window.switchTab('dashboard');

    window.openEntryDetailModal('Smoke Tester', '2026-04');
    const entryModal = document.getElementById('entry-detail-modal');
    const entryText = document.getElementById('entry-detail-content')?.textContent || '';

    window.openHourDetailModal('Smoke Tester|2026-04');
    const hourModal = document.getElementById('hour-detail-modal');
    const hourText = document.getElementById('hour-detail-content')?.textContent || '';
    const hasHourEditButton = Boolean(document.querySelector('[data-edit-hour-control-record="smoke-hour-bank-detail"]'));

    window.openEditHourControlRecord?.('smoke-hour-bank-detail', 'Smoke Tester|2026-04');
    const editModal = document.getElementById('hour-control-modal');
    const editPrefill = {
      visible: Boolean(editModal && !editModal.classList.contains('hidden') && getComputedStyle(editModal).display !== 'none'),
      detached: Boolean(editModal && editModal.parentElement === document.body),
      person: document.getElementById('hour-person')?.value || '',
      type: document.getElementById('hour-type')?.value || '',
      start: document.getElementById('hour-start')?.value || '',
      end: document.getElementById('hour-end')?.value || ''
    };
    document.getElementById('hour-end').value = '17:30';
    document.getElementById('hour-bank-nature').value = 'Crédito';
    document.getElementById('hour-note').value = 'Banco de horas smoke editado';
    await window.saveHourControlRecord?.();
    const editedHour = window.__smokeRecords.find((record) => record.id === 'smoke-hour-bank-detail');

    try {
      const result = window.exportPDF?.();
      if (result && typeof result.then === 'function') await result;
    } catch (error) {
      window.__smokeExportPdfError = error?.message || String(error);
    }

    return {
      entryVisible: Boolean(entryModal && !entryModal.classList.contains('hidden') && getComputedStyle(entryModal).display !== 'none'),
      entryText,
      hourVisible: Boolean(hourModal && !hourModal.classList.contains('hidden') && getComputedStyle(hourModal).display !== 'none'),
      hourText,
      hasHourEditButton,
      editPrefill,
      editedHour,
      exportError: window.__smokeExportPdfError || ''
    };
  });

  assert(detailState.entryVisible, `Entry detail modal should open. State: ${JSON.stringify(detailState)}`);
  assert(detailState.entryText.includes('R$ 4.200,00') || detailState.entryText.includes('R$ 8.400,00'), `Entry detail modal should show real entry data. State: ${JSON.stringify(detailState)}`);
  assert(detailState.hourVisible, `Hour/bank detail modal should open. State: ${JSON.stringify(detailState)}`);
  assert(detailState.hourText.includes('Banco de horas smoke') || detailState.hourText.includes('02:30'), `Hour/bank detail modal should show real hour data. State: ${JSON.stringify(detailState)}`);
  assert(detailState.hasHourEditButton, `Hour detail modal should expose edit action. State: ${JSON.stringify(detailState)}`);
  assert(detailState.editPrefill.visible && detailState.editPrefill.detached && detailState.editPrefill.person === 'Smoke Tester' && detailState.editPrefill.type === 'Banco de Horas', `Hour edit form should open prefilled outside hidden sections. State: ${JSON.stringify(detailState)}`);
  assert(detailState.editedHour?.description === 'Banco de horas smoke editado' || detailState.editedHour?.observation === 'Banco de horas smoke editado', `Hour edit should persist changed observation. State: ${JSON.stringify(detailState)}`);
  assert(detailState.editedHour?.bank_nature === 'Crédito', `Hour edit should persist changed bank nature. State: ${JSON.stringify(detailState)}`);
  assert(!detailState.exportError, `Export PDF with realistic records should not throw. Error: ${detailState.exportError}`);
}

async function assertDailyChartDetailModal(page) {
  await page.evaluate(() => {
    const records = [
      {
        id: 'smoke-daily-expense-1',
        type: 'saida',
        description: 'Aluguel teste smoke',
        person: 'Smoke Tester',
        macro_category: 'Moradia',
        subcategory: 'Aluguel',
        competence: '2026-04',
        due_date: '2026-04-15',
        status: 'Em aberto',
        cycle: 'INICIO_MES',
        amount: 1000
      },
      {
        id: 'smoke-daily-expense-2',
        type: 'saida',
        description: 'Condominio teste smoke',
        person: 'Smoke Tester',
        macro_category: 'Moradia',
        subcategory: 'Condominio',
        competence: '2026-04',
        due_date: '2026-04-15',
        status: 'Pago',
        paid_at: '2026-04-15',
        cycle: 'INICIO_MES',
        amount: 1100
      },
      {
        id: 'smoke-daily-expense-other-day',
        type: 'saida',
        description: 'Outra data teste smoke',
        person: 'Smoke Tester',
        macro_category: 'Mercado',
        subcategory: 'Compras',
        competence: '2026-04',
        due_date: '2026-04-03',
        status: 'Em aberto',
        cycle: 'INICIO_MES',
        amount: 300
      }
    ];

    window.allRecords = records;
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('f-comp-start').value = '2026-04';
    document.getElementById('f-comp-end').value = '2026-04';
    document.getElementById('f-person').value = '';
    document.getElementById('f-macro').value = '';
    document.getElementById('f-cycle').value = '';
    window.switchTab('dashboard');
    window.renderDashboard();
  });
  await waitTwoFrames(page);

  await page.waitForFunction(() => {
    const chart = window.chartInstances?.trend;
    return Boolean(chart?.data?.datasets?.[0]?.data?.[14] === 2100);
  }, { timeout: 10_000 });
  await page.locator('#chart-trend').scrollIntoViewIfNeeded();
  await waitTwoFrames(page);

  const clickTarget = await page.evaluate(() => {
    const chart = window.chartInstances.trend;
    const bar = chart.getDatasetMeta(0).data[14];
    const canvasRect = chart.canvas.getBoundingClientRect();
    const point = bar.getCenterPoint();
    return {
      x: canvasRect.left + point.x,
      y: canvasRect.top + point.y
    };
  });
  await page.mouse.click(clickTarget.x, clickTarget.y);
  await waitTwoFrames(page);

  const modalState = await page.evaluate(() => {
    const modal = document.getElementById('dashboard-expense-category-modal');
    const title = document.getElementById('dashboard-expense-category-title')?.textContent || '';
    const subtitle = document.getElementById('dashboard-expense-category-subtitle')?.textContent || '';
    const summary = document.getElementById('dashboard-expense-category-summary')?.textContent || '';
    const list = document.getElementById('dashboard-expense-category-list')?.textContent || '';
    return {
      visible: Boolean(modal && !modal.classList.contains('hidden') && getComputedStyle(modal).display !== 'none'),
      title,
      subtitle,
      summary,
      list
    };
  });

  assert(modalState.visible, 'Daily expense detail modal should open after clicking a populated day.');
  assert(modalState.title.includes('15/04'), `Daily expense modal title should reference 15/04. State: ${JSON.stringify(modalState)}`);
  assert(modalState.subtitle.includes('2 despesa'), `Daily expense modal should show the records count. State: ${JSON.stringify(modalState)}`);
  assert(modalState.summary.includes('R$ 2.100,00'), `Daily expense modal total should match the clicked bar total. State: ${JSON.stringify(modalState)}`);
  assert(modalState.list.includes('Aluguel teste smoke'), `Daily expense modal should list the first clicked-day record. State: ${JSON.stringify(modalState)}`);
  assert(modalState.list.includes('Condominio teste smoke'), `Daily expense modal should list the second clicked-day record. State: ${JSON.stringify(modalState)}`);
  assert(!modalState.list.includes('Outra data teste smoke'), `Daily expense modal should not list records from another day. State: ${JSON.stringify(modalState)}`);
}

async function assertMonthlyTrendMatchesDashboardCards(page) {
  await page.evaluate(() => {
    const records = [
      {
        id: 'smoke-monthly-person',
        type: 'pessoa',
        person: 'Smoke Mensal',
        salary_base: 17857.1
      },
      {
        id: 'smoke-monthly-salary',
        type: 'salario_historico',
        person: 'Smoke Mensal',
        vigencia_inicio: '2026-05',
        vigencia_fim: '',
        salary_base: 17857.1,
        amount: 17857.1
      },
      {
        id: 'smoke-monthly-expense-may',
        type: 'saida',
        description: 'Despesa maio smoke',
        person: 'Smoke Mensal',
        macro_category: 'FIXO',
        subcategory: 'Moradia',
        competence: '2026-05',
        due_date: '2026-05-10',
        status: 'Em aberto',
        cycle: 'INICIO_MES',
        amount: 7362.73
      },
      {
        id: 'smoke-monthly-expense-june',
        type: 'saida',
        description: 'Despesa junho smoke',
        person: 'Smoke Mensal',
        macro_category: 'FIXO',
        subcategory: 'Moradia',
        competence: '2026-06',
        due_date: '2026-06-10',
        status: 'Em aberto',
        cycle: 'INICIO_MES',
        amount: 14576.42
      }
    ];

    window.allRecords = records;
    window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('f-comp-start').value = '2026-05';
    document.getElementById('f-comp-end').value = '2026-06';
    document.getElementById('f-person').value = '';
    document.getElementById('f-macro').value = '';
    document.getElementById('f-cycle').value = '';
    window.switchTab('dashboard');
    window.renderDashboard();
  });
  await waitTwoFrames(page);

  const state = await page.waitForFunction(() => {
    const chart = window.chartInstances?.trend;
    if (!chart || chart.data?.datasets?.length < 4) return null;
    const [entradas, saidas, sobra] = chart.data.datasets;
    return {
      labels: chart.data.labels,
      entradas: entradas.data,
      saidas: saidas.data,
      sobra: sobra.data,
      summary: window.getDashboardEntradasSummary?.(),
      baseSaidas: window.getDashboardBaseSaidas?.()
    };
  }, { timeout: 10_000 }).then((handle) => handle.jsonValue());

  assert(state.labels.length === 2, `Monthly trend should render the selected 2-month range. State: ${JSON.stringify(state)}`);
  assert(state.entradas[0] === 13138.75 && state.entradas[1] === 13138.75, `Monthly trend entries should match consolidated dashboard entries. State: ${JSON.stringify(state)}`);
  assert(state.saidas[0] === 7362.73 && state.saidas[1] === 14576.42, `Monthly trend expenses should match dashboard expense base. State: ${JSON.stringify(state)}`);
  assert(state.sobra[0] === 5776.02 && state.sobra[1] === -1437.67, `Monthly trend balance should match cards formula. State: ${JSON.stringify(state)}`);
  assert(state.summary.totalEntradas === 26277.5, `Dashboard card source should keep real consolidated entries. State: ${JSON.stringify(state)}`);

  await page.evaluate(() => window.openMonthlyDetailTab?.('2026-05'));
  await page.waitForFunction(() => {
    const view = document.getElementById('view-mes-detalhe');
    const peopleText = document.getElementById('month-detail-people')?.textContent || '';
    return Boolean(view && !view.classList.contains('hidden') && peopleText.includes('Smoke Mensal') && peopleText.includes('R$ 13.138,75'));
  }, { timeout: 10_000 });
  const monthlyDetailState = await page.evaluate(() => ({
    title: document.getElementById('month-detail-title')?.textContent || '',
    summary: document.getElementById('month-detail-summary')?.textContent || '',
    people: document.getElementById('month-detail-people')?.textContent || ''
  }));
  assert(monthlyDetailState.people.includes('Vai receber') && monthlyDetailState.people.includes('R$ 13.138,75'), `Monthly detail person cards should use consolidated dashboard entries. State: ${JSON.stringify(monthlyDetailState)}`);
}

async function main() {
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: 5175,
      strictPort: false
    },
    logLevel: 'error'
  });

  let browser;
  try {
    await server.listen();
    const url = server.resolvedUrls?.local?.[0] || 'http://127.0.0.1:5175/';
    browser = await chromium.launch({
      headless: true,
      executablePath: findChromeExecutable()
    });

    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && /ReferenceError|is not defined|Cannot access .* before initialization/.test(text)) {
        pageErrors.push(text);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

    assert(await page.locator('#auth-screen').isVisible(), 'Auth/login screen should be visible.');
    assert(await page.locator('#auth-title').innerText() === 'Entrar', 'Auth title should be "Entrar".');
    const renderedIconCount = await page.locator('svg.lucide').count();
    assert(renderedIconCount > 0, 'Lucide should render static icons as SVG.');

    const missingGlobals = await page.evaluate((names) => names.filter((name) => typeof window[name] !== 'function'), CRITICAL_GLOBALS);
    assert(missingGlobals.length === 0, `Missing critical globals: ${missingGlobals.join(', ')}`);
    const hasBridge = await page.evaluate(() =>
      typeof window.financeGlobalBridge?.installGlobalBridge === 'function' &&
      typeof window.financeGlobalBridge?.api?.calcularINSS === 'function'
    );
    assert(hasBridge, 'Global compatibility bridge should be installed.');
    const hasLocalVisualLibraries = await page.evaluate(() =>
      typeof window.Chart === 'function' &&
      typeof window.lucide?.createIcons === 'function' &&
      Boolean(window.lucide?.icons)
    );
    assert(hasLocalVisualLibraries, 'Local Chart.js and Lucide globals should be installed.');
    const hasDashboardModule = await page.evaluate(() =>
      typeof window.financeDashboard?.renderDashboard === 'function' &&
      typeof window.financeDashboard?.scheduleDashboardRender === 'function' &&
      typeof window.financeDashboard?.getDashboardAggregations === 'function'
    );
    assert(hasDashboardModule, 'Dashboard module compatibility API should be installed.');
    const hasAppState = await page.evaluate(() => {
      const originalRecords = window.allRecords;
      window.allRecords = [{ id: 'smoke-state-record' }];
      const synced = window.appState?.allRecords?.[0]?.id === 'smoke-state-record';
      window.allRecords = originalRecords;
      return Boolean(
        window.appState &&
        window.financeState?.appState === window.appState &&
        window.currentTab === window.appState.currentTab &&
        window.chartInstances === window.appState.chartInstances &&
        synced
      );
    });
    assert(hasAppState, 'App state compatibility globals should be installed and synced.');
    const legacyModuleState = await page.evaluate(async () => {
      const first = window.financeEvents;
      window.financeApp?.bootstrapApp?.();
      const loaded = await window.financeApp?.loadLegacyClassicScripts?.(window);
      return {
        hasBridge: typeof window.financeEvents?.invoke === 'function',
        sameBridge: first === window.financeEvents,
        installed: window.__financeLegacyEventBindingsInstalled === true,
        installerNotExposedOnFinanceApp: !('installLegacyEventBindings' in (window.financeApp || {})),
        removedFromClassicLoader: !loaded?.loaded?.includes('src/ui/legacy-events.js')
      };
    });
    assert(
      legacyModuleState.hasBridge &&
      legacyModuleState.sameBridge &&
      legacyModuleState.installed &&
      legacyModuleState.installerNotExposedOnFinanceApp &&
      legacyModuleState.removedFromClassicLoader,
      `Migrated legacy-events module should be installed once outside classic loader. State: ${JSON.stringify(legacyModuleState)}`
    );

    await page.evaluate(() => {
      document.getElementById('auth-screen')?.classList.add('hidden');
      document.getElementById('app')?.classList.remove('hidden');
      document.body.classList.remove('overflow-hidden');
      window.switchTab('dashboard');
      window.renderDashboard();
    });
    await waitTwoFrames(page);

    await assertViewActive(page, '#view-dashboard', 'Dashboard view');
    const trendTitleBefore = await page.locator('#chart-trend-title').innerText();
    const startBefore = await page.locator('#f-comp-start').inputValue();
    assert(trendTitleBefore.length > 0, 'Dashboard trend chart title should render.');
    const hasDashboardCharts = await page.evaluate(() =>
      Boolean(window.chartInstances?.trend || window.chartInstances?.category || window.chartInstances?.person)
    );
    assert(hasDashboardCharts, 'Chart.js should create dashboard chart instances.');

    await page.evaluate(() => window.shiftDashboardCompetenceRange?.(1));
    await waitTwoFrames(page);
    const startAfter = await page.locator('#f-comp-start').inputValue();
    const trendTitleAfter = await page.locator('#chart-trend-title').innerText();
    assert(startAfter !== startBefore, 'Changing month should update the dashboard month input.');
    assert(trendTitleAfter !== trendTitleBefore, 'Changing month should update the trend chart title.');

    await assertDailyChartDetailModal(page);
    await assertMonthlyTrendMatchesDashboardCards(page);
    await assertPdfMatchesDashboardCards(page);
    await assertCriticalRecordFlows(page);
    await assertConfigurationPersistence(page);
    await assertImportFlow(page);
    await assertDiscountHistoryFlows(page);
    await assertDetailModalsAndPdf(page);
    await assertFixedMonthlyAndFilters(page);
    await assertPercentageRuleFlow(page);

    await page.evaluate(() => window.switchTab('saidas'));
    await waitTwoFrames(page);
    await assertViewActive(page, '#view-saidas', 'Saidas tab');

    await page.evaluate(() => window.switchTab('entradas'));
    await waitTwoFrames(page);
    await assertViewActive(page, '#view-entradas', 'Entradas tab');

    await page.evaluate(() => window.openNewRecordFlow?.('saida'));
    await waitTwoFrames(page);
    await assertViewActive(page, '#view-novo', 'New record form');

    await page.evaluate(async () => {
      try {
        const result = window.exportPDF?.();
        if (result && typeof result.then === 'function') await result;
      } catch (error) {
        window.__smokeExportPdfError = error?.message || String(error);
      }
    });
    const exportError = await page.evaluate(() => window.__smokeExportPdfError || '');
    assert(!exportError, `Export PDF should not throw. Error: ${exportError}`);

    assert(pageErrors.length === 0, `Page errors detected: ${pageErrors.join(' | ')}`);

    console.log(JSON.stringify({
      status: 'ok',
      url,
      checks: [
        'app opens',
        'login screen appears',
        'critical globals are present',
        'local Chart.js and Lucide globals are present',
        'Lucide renders SVG icons',
        'dashboard module compatibility API is present',
        'app state compatibility globals are synced',
        'legacy events module is installed once outside classic loader',
        'dashboard renders',
        'Chart.js creates dashboard chart instances',
        'month change updates dashboard charts',
        'daily expense chart detail modal matches clicked bar records and total',
        'monthly financial trend matches dashboard card bases',
        'monthly detail person cards use consolidated dashboard entries',
        'pdf financial source matches dashboard cards',
        'create, edit, mark paid, archive, unarchive and delete expense flows persist through data SDK',
        'settings persist people and macro categories',
        'expense spreadsheet import creates mapped records and report',
        'discount history keeps multiple items, sums totals and deletes by item',
        'entry and hour detail modals open with real records',
        'fixed monthly records can be edited and marked paid under active filters',
        'percentage rules persist and generate fixed monthly expenses',
        'tab switching works',
        'new record modal/form opens',
        'export PDF with realistic records does not throw'
      ]
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
