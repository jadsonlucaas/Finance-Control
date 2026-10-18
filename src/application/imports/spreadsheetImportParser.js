import { roundCurrency } from '../../core/money.js';

export const SPREADSHEET_IMPORT_KINDS = Object.freeze({
  EXPENSES: 'expenses',
  INCOMES: 'incomes'
});

const EXPENSE_REQUIRED_FIELDS = Object.freeze([
  'date',
  'description',
  'amount',
  'person',
  'macro_category',
  'category_name',
  'competence'
]);

const INCOME_REQUIRED_FIELDS = Object.freeze([
  'competence',
  'description',
  'amount',
  'person'
]);

const EXPENSE_ALIASES = Object.freeze({
  date: ['data', 'date', 'dt'],
  description: ['descricao', 'description', 'historico'],
  amount: ['valor orcado', 'valor', 'amount'],
  nature: ['tipo', 'natureza'],
  person: ['quem paga', 'pessoa', 'responsavel', 'responsável'],
  macro_category: ['categoria_macro', 'categoria macro', 'macro', 'categoria macrocategoria'],
  category_name: ['categoria', 'subcategory', 'subcategoria'],
  payment_method: ['pagamento', 'metodo de pagamento', 'método de pagamento', 'payment_method'],
  status: ['status', 'situação', 'situacao'],
  external_id: ['id', 'identificador', 'identificador externo', 'external_id', 'source_reference_id', 'referencia'],
  competence: ['data competencia', 'data competência', 'competencia', 'competência'],
  cycle: ['classe', 'ciclo'],
  installment: ['parcela']
});

const INCOME_ALIASES = Object.freeze({
  competence: ['competencia', 'competência'],
  description: ['desc', 'descricao', 'descrição', 'description'],
  amount: ['valores', 'valor', 'amount'],
  person: ['pessoa', 'quem recebe', 'responsavel', 'responsável'],
  external_id: ['id', 'identificador', 'identificador externo', 'external_id', 'source_reference_id']
});

function text(value = '') {
  return String(value ?? '').trim();
}

export function normalizeSpreadsheetHeader(value = '') {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeImportText(value = '') {
  return text(value).replace(/\s+/g, ' ');
}

function parseBrazilianNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  const raw = text(value);
  if (!raw) return Number.NaN;
  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function excelSerialToIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(value) * 86400000).toISOString().slice(0, 10);
  }
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
}

function normalizeCompetence(value) {
  if (typeof value === 'number' || value instanceof Date) return excelSerialToIsoDate(value).slice(0, 7);
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  const slash = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
  return excelSerialToIsoDate(raw).slice(0, 7);
}

function competenceToIsoDate(competence = '') {
  return /^\d{4}-\d{2}$/.test(competence) ? `${competence}-01` : '';
}

function normalizeStatus(value = '') {
  const normalized = normalizeSpreadsheetHeader(value);
  if (!normalized) return 'Em aberto';
  if (normalized === 'pago' || normalized === 'paga') return 'Pago';
  if (normalized === 'cancelado' || normalized === 'cancelada') return 'Cancelado';
  if (normalized === 'vencido' || normalized === 'vencida') return 'Vencido';
  return normalizeImportText(value);
}

function normalizeCycle(value = '') {
  const normalized = normalizeSpreadsheetHeader(value);
  if (!normalized) return '';
  if (normalized.includes('inicio')) return 'INICIO_MES';
  if (normalized.includes('quinzena')) return 'QUINZENA';
  if (normalized.includes('fim')) return 'FIM_MES';
  if (normalized.includes('mensal')) return 'MENSAL';
  return normalizeImportText(value);
}

function parseInstallment(value = '') {
  const raw = text(value);
  if (!raw) return { installment_no: 0, total_installments: 0 };
  const match = raw.match(/(\d+)\s*(?:\/|de)\s*(\d+)/i);
  if (!match) return { installment_no: 0, total_installments: 0 };
  return {
    installment_no: Number(match[1]) || 0,
    total_installments: Number(match[2]) || 0
  };
}

function normalizeIncomeDescription(value = '') {
  const normalized = normalizeSpreadsheetHeader(value).toUpperCase();
  const map = {
    'INICIO DO MES': { description: 'Inicio do mes', earning_type: 'Inicio do mes', macro_category: 'Rendimento', cycle: 'INICIO_MES' },
    QUINZENA: { description: 'Quinzena', earning_type: 'Quinzena', macro_category: 'Rendimento', cycle: 'QUINZENA' },
    HE: { description: 'Hora Extra', earning_type: 'Hora Extra', macro_category: 'Rendimento', cycle: '' },
    'DSR H.E': { description: 'DSR H.E.', earning_type: 'DSR H.E.', macro_category: 'Rendimento', cycle: '' },
    'DSR H E': { description: 'DSR H.E.', earning_type: 'DSR H.E.', macro_category: 'Rendimento', cycle: '' },
    'DSR HE': { description: 'DSR H.E.', earning_type: 'DSR H.E.', macro_category: 'Rendimento', cycle: '' },
    'SALARIO BASE': { description: 'Salario Base', earning_type: 'Salario Base', macro_category: 'Referencia Salarial', cycle: '' },
    'SALARIO BRUTO': { description: 'Salario Bruto', earning_type: 'Salario Bruto', macro_category: 'Referencia Salarial', cycle: '' }
  };
  return map[normalized] || null;
}

function headersFromRows(rows = []) {
  const first = rows[0] || {};
  return Array.isArray(first) ? first.map((value) => text(value)) : Object.keys(first);
}

function objectRowsFromRows(rows = []) {
  if (!rows.length) return [];
  if (!Array.isArray(rows[0])) return rows;
  const headers = rows[0].map((header) => text(header));
  return rows.slice(1).map((row) => headers.reduce((acc, header, index) => ({ ...acc, [header]: row[index] ?? '' }), {}));
}

function getWorksheetRows(workbookOrRows, options = {}) {
  if (Array.isArray(workbookOrRows)) {
    return { sheetName: options.sheetName || 'Rows', rows: objectRowsFromRows(workbookOrRows) };
  }
  const workbook = workbookOrRows || {};
  const sheetName = options.sheetName || workbook.SheetNames?.[0] || '';
  const sheet = sheetName ? workbook.Sheets?.[sheetName] : null;
  if (!sheetName || !sheet) return { sheetName, rows: [] };
  if (Array.isArray(sheet.__rows)) return { sheetName, rows: objectRowsFromRows(sheet.__rows) };
  if (Array.isArray(sheet.rows)) return { sheetName, rows: objectRowsFromRows(sheet.rows) };
  if (typeof options.sheetToJson === 'function') return { sheetName, rows: options.sheetToJson(sheet, { defval: '' }) };
  return { sheetName, rows: [] };
}

function buildHeaderMap(headers = [], aliases = {}) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeSpreadsheetHeader(header), header]));
  return Object.entries(aliases).reduce((acc, [field, names]) => {
    const found = names.map(normalizeSpreadsheetHeader).find((candidate) => normalizedHeaders.has(candidate));
    if (found) acc[field] = normalizedHeaders.get(found);
    return acc;
  }, {});
}

function valueFrom(row = {}, headerMap = {}, field = '') {
  const key = headerMap[field];
  return key ? row[key] : '';
}

function isEmptyRow(row = {}) {
  return Object.values(row).every((value) => text(value) === '');
}

function structuredError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildExpenseLegacyImportSignature(payload = {}) {
  return [
    payload.person,
    payload.macro_category,
    payload.subcategory,
    payload.description,
    payload.amount,
    payload.status,
    payload.payment_method,
    payload.occurred_date,
    payload.due_date,
    payload.competence,
    payload.installment_no,
    payload.total_installments
  ].join('|');
}

function buildExpenseLegacyCoreSignature(payload = {}) {
  return [
    payload.person,
    payload.macro_category,
    payload.subcategory,
    payload.description,
    payload.amount,
    payload.competence,
    payload.installment_no,
    payload.total_installments
  ].join('|');
}

function buildIncomeLegacyImportSignature(payload = {}) {
  return [
    payload.person,
    payload.earning_type,
    payload.description,
    payload.amount,
    payload.competence,
    payload.cycle,
    payload.macro_category
  ].join('|');
}

function mapExpenseRow(row = {}, headerMap = {}, index = 0) {
  const competence = normalizeCompetence(valueFrom(row, headerMap, 'competence'));
  const date = excelSerialToIsoDate(valueFrom(row, headerMap, 'date'));
  const amount = parseBrazilianNumber(valueFrom(row, headerMap, 'amount'));
  const status = normalizeStatus(valueFrom(row, headerMap, 'status'));
  const installment = parseInstallment(valueFrom(row, headerMap, 'installment'));
  const payload = {
    source_row_reference: String(index + 2),
    source_reference_id: normalizeImportText(valueFrom(row, headerMap, 'external_id')),
    type: 'saida',
    person: normalizeImportText(valueFrom(row, headerMap, 'person')),
    macro_category: normalizeImportText(valueFrom(row, headerMap, 'macro_category')),
    category_name: normalizeImportText(valueFrom(row, headerMap, 'category_name')),
    subcategory: normalizeImportText(valueFrom(row, headerMap, 'category_name')),
    description: normalizeImportText(valueFrom(row, headerMap, 'description')),
    amount: roundCurrency(Math.abs(amount)),
    status,
    payment_method: normalizeImportText(valueFrom(row, headerMap, 'payment_method')),
    occurred_date: date,
    due_date: competenceToIsoDate(competence) || date,
    competence,
    paid_at: status === 'Pago' ? date : '',
    cycle: normalizeCycle(valueFrom(row, headerMap, 'cycle')),
    installment_no: installment.installment_no,
    total_installments: installment.total_installments,
    parent_id: installment.total_installments > 0 ? `import_${index + 2}` : '',
    recurrence: '',
    earning_type: '',
    source_mode: 'import',
    import_source: 'saidas_xlsx',
    schema_version: 1
  };
  payload.legacy_import_signature = buildExpenseLegacyImportSignature(payload);
  payload.legacy_import_core_signature = buildExpenseLegacyCoreSignature(payload);
  const errors = [];
  if (!payload.person) errors.push(structuredError('MISSING_PERSON', 'Pessoa obrigatoria.', { field: 'person' }));
  if (!payload.macro_category) errors.push(structuredError('MISSING_MACRO', 'Macro obrigatoria.', { field: 'macro_category' }));
  if (!payload.category_name) errors.push(structuredError('MISSING_CATEGORY', 'Categoria obrigatoria.', { field: 'category_name' }));
  if (!payload.description) errors.push(structuredError('MISSING_DESCRIPTION', 'Descricao obrigatoria.', { field: 'description' }));
  if (!Number.isFinite(amount) || !(amount > 0)) errors.push(structuredError('INVALID_AMOUNT', 'Valor invalido.', { field: 'amount' }));
  if (!payload.competence) errors.push(structuredError('INVALID_COMPETENCE', 'Competencia invalida.', { field: 'competence' }));
  if (!payload.occurred_date) errors.push(structuredError('INVALID_DATE', 'Data invalida.', { field: 'date' }));
  return { payload, errors };
}

function mapIncomeRow(row = {}, headerMap = {}, index = 0) {
  const competence = normalizeCompetence(valueFrom(row, headerMap, 'competence'));
  const amount = parseBrazilianNumber(valueFrom(row, headerMap, 'amount'));
  const mapping = normalizeIncomeDescription(valueFrom(row, headerMap, 'description'));
  const competenceDate = competenceToIsoDate(competence);
  const payload = {
    source_row_reference: String(index + 2),
    source_reference_id: normalizeImportText(valueFrom(row, headerMap, 'external_id')),
    type: 'entrada',
    person: normalizeImportText(valueFrom(row, headerMap, 'person')),
    amount: roundCurrency(amount),
    description: mapping?.description || normalizeImportText(valueFrom(row, headerMap, 'description')),
    earning_type: mapping?.earning_type || '',
    macro_category: mapping?.macro_category || '',
    subcategory: mapping?.description || normalizeImportText(valueFrom(row, headerMap, 'description')),
    status: 'Pago',
    payment_method: '',
    occurred_date: competenceDate,
    due_date: competenceDate,
    competence,
    paid_at: '',
    cycle: mapping?.cycle || '',
    installment_no: 0,
    total_installments: 0,
    parent_id: '',
    recurrence: '',
    source_mode: 'import',
    import_source: 'entradas_xlsx',
    schema_version: 1
  };
  payload.legacy_import_signature = buildIncomeLegacyImportSignature(payload);
  payload.legacy_import_core_signature = payload.legacy_import_signature;
  const errors = [];
  if (!payload.competence) errors.push(structuredError('INVALID_COMPETENCE', 'Competencia invalida.', { field: 'competence' }));
  if (!Number.isFinite(amount) || amount < 0) errors.push(structuredError('INVALID_AMOUNT', 'Valor invalido.', { field: 'amount' }));
  if (!payload.person) errors.push(structuredError('MISSING_PERSON', 'Pessoa obrigatoria.', { field: 'person' }));
  if (!mapping) errors.push(structuredError('UNSUPPORTED_DESCRIPTION', 'Descricao nao suportada para importacao.', { field: 'description' }));
  return { payload, errors };
}

export function parseSpreadsheetImport(workbookOrRows, options = {}) {
  const kind = options.kind || SPREADSHEET_IMPORT_KINDS.EXPENSES;
  const aliases = kind === SPREADSHEET_IMPORT_KINDS.INCOMES ? INCOME_ALIASES : EXPENSE_ALIASES;
  const required = kind === SPREADSHEET_IMPORT_KINDS.INCOMES ? INCOME_REQUIRED_FIELDS : EXPENSE_REQUIRED_FIELDS;
  const { sheetName, rows: rawRows } = getWorksheetRows(workbookOrRows, options);
  const headers = headersFromRows(rawRows);
  const headerMap = buildHeaderMap(headers, aliases);
  const missingColumns = required.filter((field) => !headerMap[field]);
  const structuralErrors = [];
  if (!sheetName) structuralErrors.push(structuredError('NO_SHEET', 'Nenhuma aba encontrada.'));
  if (!rawRows.length) structuralErrors.push(structuredError('NO_ROWS', 'Nenhuma linha encontrada.'));
  missingColumns.forEach((field) => structuralErrors.push(structuredError('MISSING_COLUMN', `Coluna obrigatoria ausente: ${field}.`, { field })));

  if (structuralErrors.length) {
    return {
      ok: false,
      kind,
      sheetName,
      headers,
      headerMap,
      rows: [],
      errors: structuralErrors,
      ignoredRows: []
    };
  }

  const rows = [];
  const errors = [];
  const ignoredRows = [];
  rawRows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      ignoredRows.push({ row_index: index + 2, reason: 'Linha vazia.' });
      return;
    }
    const mapped = kind === SPREADSHEET_IMPORT_KINDS.INCOMES
      ? mapIncomeRow(row, headerMap, index)
      : mapExpenseRow(row, headerMap, index);
    if (mapped.errors.length) {
      errors.push({ row_index: index + 2, errors: mapped.errors, payload: mapped.payload });
    }
    rows.push({
      ...mapped.payload,
      source_row_reference: String(index + 2),
      parser_errors: mapped.errors,
      raw_row_index: index + 2
    });
  });

  return {
    ok: true,
    kind,
    sheetName,
    headers,
    headerMap,
    rows,
    errors,
    ignoredRows
  };
}

export function createSpreadsheetDryRunFixtures() {
  const expenses = [
    ['Data', 'Classe', 'Categoria_macro', 'Categoria', 'Descricao', 'Parcela', 'Valor Orcado', 'STATUS', 'Pagamento', 'Quem paga', 'Data competencia', 'Identificador externo'],
    ['2026-08-01', 'Inicio do mes', 'VARIAVEL', 'Alimentacao', 'Mercado 1', '', '100,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-1'],
    ['2026-08-02', 'Inicio do mes', 'VARIAVEL', 'Alimentacao', 'Mercado 2', '', '101,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-2'],
    ['2026-08-03', 'Inicio do mes', 'VARIAVEL', 'Transporte', 'Uber', '', '30,00', 'Pago', 'Cartao', 'Ana', '2026-08', 'xlsx-3'],
    ['2026-08-04', 'Inicio do mes', 'FIXO', 'Moradia', 'Energia', '', '220,00', 'Em aberto', 'Boleto', 'Ana', '2026-08', 'xlsx-4'],
    ['2026-08-05', 'Inicio do mes', 'VARIAVEL', 'Saude', 'Farmacia', '', '55,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-5'],
    ['2026-08-05', 'Inicio do mes', 'VARIAVEL', 'Saude', 'Farmacia', '', '55,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-5'],
    ['2026-08-06', 'Inicio do mes', 'VARIAVEL', 'Saude', 'Linha invalida', '', 'abc', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-invalid'],
    ['2026-08-07', 'Inicio do mes', 'VARIAVEL', 'Casa', 'Ja importada', '', '70,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-existing'],
    ['2026-08-08', 'Inicio do mes', 'VARIAVEL', 'Casa', 'Conflito', '', '80,00', 'Pago', 'Pix', 'Ana', '2026-08', 'xlsx-conflict']
  ];
  return {
    expenses,
    sameContentDifferentName: expenses.map((row) => row.slice()),
    changedContent: expenses.map((row, index) => index === 1 ? row.map((cell, cellIndex) => cellIndex === 6 ? '100,01' : cell) : row.slice())
  };
}
