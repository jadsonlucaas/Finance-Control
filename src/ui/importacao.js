import {
  CommitImportBatch,
  IMPORT_TYPES,
  PrepareImportBatch
} from '../application/imports/importBatchUseCases.js';
import { getImportPipelineRepositories } from '../application/imports/importPipelineRuntime.js';
import { showToast as showModernToast } from './toast.js';

const MODEL_LABELS = Object.freeze({
  BRADESCO: 'Bradesco',
  MERCADO_PAGO: 'Mercado Pago',
  INTER: 'Banco Inter',
  ITAU_PDF: 'Itau',
  PADRAO: 'CSV padrao'
});

const PDFJS_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
const ALLOWED_IMPORT_LIBRARY_HOSTS = new Set(['cdnjs.cloudflare.com']);

const DEFAULT_CATEGORY_RULES = Object.freeze([
  { category: 'Alimentacao', confidence: 'alta', keywords: ['mercado', 'supermercado', 'ifood', 'restaurante', 'padaria', 'lanchonete', 'cafeteria'] },
  { category: 'Transporte', confidence: 'alta', keywords: ['uber', '99', 'combustivel', 'posto', 'estacionamento', 'pedagio'] },
  { category: 'Habitacao', confidence: 'alta', keywords: ['aluguel', 'condominio', 'energia', 'agua', 'internet', 'gas', 'iptu'] },
  { category: 'Assinaturas', confidence: 'alta', keywords: ['netflix', 'spotify', 'youtube premium', 'prime video', 'amazon prime', 'deezer'] },
  { category: 'Lazer', confidence: 'media', keywords: ['cinema', 'show', 'teatro', 'steam', 'playstation', 'xbox'] },
  { category: 'Cuidados pessoais', confidence: 'media', keywords: ['farmacia', 'drogaria', 'barbearia', 'salao'] },
  { category: 'Investimentos', confidence: 'media', keywords: ['investimento', 'tesouro', 'cdb', 'rendimento', 'corretora'] },
  { category: 'Outros', confidence: 'baixa', keywords: ['pix', 'transferencia', 'ted', 'tef', 'doc'] }
]);

function getImportacaoState(target = globalThis) {
  if (!target.__financeImportacaoState) {
    target.__financeImportacaoState = {
      rows: [],
      fileName: '',
      bankModel: 'BRADESCO',
      bankLabel: MODEL_LABELS.BRADESCO,
      batchId: '',
      selectedPerson: '',
      historySourceFilter: 'all'
    };
  }

  return target.__financeImportacaoState;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isAllowedImportLibraryUrl(src = '') {
  if (typeof globalThis.isAllowedExternalLibraryUrl === 'function') {
    return globalThis.isAllowedExternalLibraryUrl(src);
  }
  try {
    const url = new URL(src, globalThis.document?.baseURI || 'https://finance-control.local/');
    return url.protocol === 'https:' && ALLOWED_IMPORT_LIBRARY_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function safeCurrency(value = 0) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0));
}

function formatDate(date = '') {
  if (!date) return '-';
  const [year, month, day] = String(date).split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function slugify(value = '') {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function prettifySource(value = '') {
  const text = String(value || '').replace(/^bank:/, '').replaceAll('_', ' ').trim();
  if (!text) return 'Banco';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function notify(target = globalThis, message = '', isError = false) {
  const text = String(message || '').trim();
  if (!text) return;
  if (typeof target.showToast === 'function') {
    target.showToast(text, isError);
    return;
  }
  if (typeof showModernToast === 'function' && globalThis.document?.body) {
    showModernToast(text, isError);
    return;
  }
  globalThis.console?.[isError ? 'error' : 'log']?.(text);
}

function getCurrentAuthUser(target = globalThis) {
  return target.authSdk?.getCurrentUser?.() || globalThis.authSdk?.getCurrentUser?.() || null;
}

function getScopedRecords(records = [], target = globalThis) {
  const user = getCurrentAuthUser(target);
  const uid = String(user?.uid || '').trim();
  const list = Array.isArray(records) ? records : [];
  if (!uid) return list;

  const hasOwnedRecords = list.some((record) => String(record?.owner_uid || '').trim());
  if (!hasOwnedRecords) return list;

  return list.filter((record) => {
    const ownerUid = String(record?.owner_uid || '').trim();
    return !ownerUid || ownerUid === uid;
  });
}

function hashString(value = '') {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function detectDelimiter(text = '') {
  const sample = String(text).split(/\r?\n/).find((line) => String(line).trim());
  if (!sample) return ';';
  const semicolonCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ';' : ',';
}

function parseDelimitedLine(line = '', delimiter = ';') {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => String(value || '').trim());
}

function parseCsvTable(text = '', delimiter = detectDelimiter(text)) {
  return String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseDelimitedLine(line, delimiter));
}

function parseBrazilianMoney(value = '') {
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = text
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function toIsoDateFromSlash(value = '') {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function toIsoDateFromDash(value = '') {
  const match = String(value || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function toIsoDateFromDayMonth(value = '', fallbackYear = new Date().getFullYear()) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return '';
  const year = Number(fallbackYear) || new Date().getFullYear();
  return `${year}-${match[2]}-${match[1]}`;
}

function inferYearFromFileName(fileName = '', fallbackYear = new Date().getFullYear()) {
  const match = String(fileName || '').match(/(20\d{2})/);
  return match ? Number(match[1]) : fallbackYear;
}

async function ensurePdfJs() {
  if (globalThis.__financePdfJsLib?.getDocument) return globalThis.__financePdfJsLib;
  if (!globalThis.__financePdfJsPromise) {
    globalThis.__financePdfJsPromise = (async () => {
      if (typeof globalThis.loadExternalLibrary === 'function') {
        await globalThis.loadExternalLibrary(PDFJS_LIBRARY_URL, () => Boolean(globalThis.pdfjsLib?.getDocument));
      } else {
        await new Promise((resolve, reject) => {
          if (!isAllowedImportLibraryUrl(PDFJS_LIBRARY_URL)) {
            reject(new Error('LIBRARY_NOT_ALLOWED:PDFJS'));
            return;
          }
          const existing = document.querySelector(`script[data-finance-src="${PDFJS_LIBRARY_URL}"]`);
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('LOAD_FAILED:PDFJS')), { once: true });
            return;
          }

          const script = document.createElement('script');
          script.src = PDFJS_LIBRARY_URL;
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.referrerPolicy = 'no-referrer';
          script.dataset.financeSrc = PDFJS_LIBRARY_URL;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('LOAD_FAILED:PDFJS'));
          document.head.appendChild(script);
        });
      }

      const pdfjsLib = globalThis.pdfjsLib;
      if (!pdfjsLib?.getDocument) {
        throw new Error('Biblioteca de PDF nao carregada no navegador.');
      }

      if (pdfjsLib.GlobalWorkerOptions) {
        if (!isAllowedImportLibraryUrl(PDFJS_WORKER_URL)) {
          throw new Error('LIBRARY_NOT_ALLOWED:PDFJS_WORKER');
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      }

      globalThis.__financePdfJsLib = pdfjsLib;
      return pdfjsLib;
    })().catch((error) => {
      globalThis.__financePdfJsPromise = null;
      throw error;
    });
  }

  return globalThis.__financePdfJsPromise;
}

async function extractPdfText(file = null) {
  if (!file) return '';
  const pdfjsLib = await ensurePdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentY = null;
    let currentLine = [];

    content.items.forEach((item) => {
      const value = String(item?.str || '').trim();
      if (!value) return;
      const y = Math.round(Number(item?.transform?.[5] || 0));
      if (currentY === null || Math.abs(y - currentY) <= 2) {
        currentY = y;
        currentLine.push(value);
        return;
      }

      if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
      currentY = y;
      currentLine = [value];
    });

    if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
    pages.push(lines.join('\n'));
  }

  return pages.join('\n');
}

function buildPreviewRow(base = {}, context = {}) {
  const description = String(base.description || '').trim();
  const date = String(base.date || '').trim();
  const amount = Number(base.amount || 0);
  const direction = base.direction || 'debit';
  const bankModel = context.bankModel || 'PADRAO';
  const bankLabel = context.bankLabel || MODEL_LABELS[bankModel] || 'Banco';
  const rawSignature = `${bankModel}|${bankLabel}|${date}|${description}|${amount.toFixed(2)}|${base.reference || ''}|${base.rawLine || ''}`;
  const importSignature = `imp_${hashString(rawSignature)}`;
  const coreSignature = `core_${hashString(`${bankModel}|${date}|${normalizeText(description)}|${amount.toFixed(2)}`)}`;

  return {
    index: 0,
    date,
    description,
    amount: Math.abs(amount),
    direction,
    categoryId: '',
    categoryName: '',
    macroCategory: '',
    confidence: 'baixa',
    status: 'pendente',
    note: '',
    importable: false,
    duplicate: false,
    imported: false,
    importSignature,
    importCoreSignature: coreSignature,
    importSource: `bank:${slugify(bankLabel) || slugify(bankModel) || 'banco'}`,
    rawLine: base.rawLine || '',
    parserModel: bankModel
  };
}

function parseBradescoCsv(text = '', context = {}) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => normalizeText(line).includes('data;historico;docto.;credito'));
  if (headerIndex < 0) throw new Error('Cabecalho do Bradesco nao encontrado.');

  return lines.slice(headerIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseDelimitedLine(line, ';'))
    .filter((columns) => /^\d{2}\/\d{2}\/\d{4}$/.test(columns[0] || ''))
    .map((columns) => {
      const date = toIsoDateFromSlash(columns[0]);
      const description = columns[1] || 'Lancamento Bradesco';
      const credit = parseBrazilianMoney(columns[3]);
      const debit = parseBrazilianMoney(columns[4]);
      const amount = debit > 0 ? debit : credit;
      const direction = debit > 0 ? 'debit' : 'credit';
      return buildPreviewRow({
        date,
        description,
        amount,
        direction,
        reference: columns[2] || '',
        rawLine: columns.join(';')
      }, context);
    });
}

function parseMercadoPagoCsv(text = '', context = {}) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => normalizeText(line).includes('release_date;transaction_type;reference_id;transaction_net_amount'));
  if (headerIndex < 0) throw new Error('Cabecalho do Mercado Pago nao encontrado.');

  return lines.slice(headerIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseDelimitedLine(line, ';'))
    .filter((columns) => /^\d{2}-\d{2}-\d{4}$/.test(columns[0] || ''))
    .map((columns) => {
      const date = toIsoDateFromDash(columns[0]);
      const amount = parseBrazilianMoney(columns[3]);
      return buildPreviewRow({
        date,
        description: columns[1] || 'Movimento Mercado Pago',
        amount: Math.abs(amount),
        direction: amount < 0 ? 'debit' : 'credit',
        reference: columns[2] || '',
        rawLine: columns.join(';')
      }, context);
    });
}

function parseInterCsv(text = '', context = {}) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => normalizeText(line).includes('data lancamento;historico;descricao;valor;saldo'));
  if (headerIndex < 0) throw new Error('Cabecalho do Banco Inter nao encontrado.');

  return lines.slice(headerIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseDelimitedLine(line, ';'))
    .filter((columns) => /^\d{2}\/\d{2}\/\d{4}$/.test(columns[0] || ''))
    .map((columns) => {
      const date = toIsoDateFromSlash(columns[0]);
      const amount = parseBrazilianMoney(columns[3]);
      const history = columns[1] || '';
      const detail = columns[2] || '';
      return buildPreviewRow({
        date,
        description: [history, detail].filter(Boolean).join(' - ') || 'Movimento Banco Inter',
        amount: Math.abs(amount),
        direction: amount < 0 ? 'debit' : 'credit',
        reference: detail,
        rawLine: columns.join(';')
      }, context);
    });
}

function parsePadraoCsv(text = '', context = {}) {
  const rows = parseCsvTable(text, ',');
  if (rows.length < 2) throw new Error('CSV padrao sem linhas suficientes.');

  const header = rows[0].map((value) => normalizeText(value));
  const dateIndex = header.findIndex((value) => value === 'data');
  const descriptionIndex = header.findIndex((value) => value === 'descricao');
  const amountIndex = header.findIndex((value) => value === 'valor');
  const typeIndex = header.findIndex((value) => value === 'tipo');

  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0 || typeIndex < 0) {
    throw new Error('CSV padrao precisa das colunas data, descricao, valor e tipo.');
  }

  return rows.slice(1)
    .filter((columns) => columns.some(Boolean))
    .map((columns) => {
      const rawAmount = parseBrazilianMoney(columns[amountIndex]);
      const rawType = normalizeText(columns[typeIndex]);
      return buildPreviewRow({
        date: /^\d{4}-\d{2}-\d{2}$/.test(columns[dateIndex] || '') ? columns[dateIndex] : toIsoDateFromSlash(columns[dateIndex]),
        description: columns[descriptionIndex] || 'Movimento importado',
        amount: Math.abs(rawAmount),
        direction: rawType === 'saida' ? 'debit' : 'credit',
        reference: '',
        rawLine: columns.join(',')
      }, context);
    });
}

function parseItauPdf(text = '', context = {}) {
  const fallbackYear = inferYearFromFileName(context.fileName || '', new Date().getFullYear());
  const lines = String(text || '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const parsedRows = [];
  const linePattern = /^(\d{2}\/\d{2})(?:\/(\d{4}))?\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;

  lines.forEach((line) => {
    const normalizedLine = normalizeText(line);
    if (normalizedLine.includes('saldo do dia')) return;
    if (normalizedLine.includes('saldo final')) return;

    const match = line.match(linePattern);
    if (!match) return;

    const fullDate = match[2]
      ? toIsoDateFromSlash(`${match[1]}/${match[2]}`)
      : toIsoDateFromDayMonth(match[1], fallbackYear);
    const description = String(match[3] || '').trim();
    const signedAmount = parseBrazilianMoney(match[4]);

    parsedRows.push(buildPreviewRow({
      date: fullDate,
      description,
      amount: Math.abs(signedAmount),
      direction: signedAmount < 0 ? 'debit' : 'credit',
      reference: '',
      rawLine: line
    }, context));
  });

  if (!parsedRows.length) {
    throw new Error('Nao foi possivel identificar movimentos no PDF do Itau.');
  }

  return parsedRows;
}

function parseBankFile(text = '', model = 'BRADESCO', context = {}) {
  if (model === 'BRADESCO') return parseBradescoCsv(text, context);
  if (model === 'MERCADO_PAGO') return parseMercadoPagoCsv(text, context);
  if (model === 'INTER') return parseInterCsv(text, context);
  if (model === 'ITAU_PDF') return parseItauPdf(text, context);
  return parsePadraoCsv(text, context);
}

function getCategoryRecords(records = []) {
  return records.filter((record) => record?.type === 'categoria');
}

function getPeopleRecords(records = []) {
  return records
    .filter((record) => record?.type === 'pessoa' && String(record.person || '').trim())
    .sort((left, right) => String(left.person || '').localeCompare(String(right.person || '')));
}

function getDefaultOtherCategory(categories = []) {
  return categories.find((category) => normalizeText(category.category_name) === 'outros') || null;
}

function findCategoryByName(categories = [], name = '') {
  const normalizedTarget = normalizeText(name);
  return categories.find((category) => normalizeText(category.category_name) === normalizedTarget) || null;
}

function detectPossibleInternalTransfer(description = '') {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return null;

  const transferKeywords = [
    'pix transf',
    'transferencia pix',
    'transferencia',
    'tef',
    'ted',
    'doc'
  ];

  const matchedKeyword = transferKeywords.find((keyword) => normalizedDescription.includes(keyword));
  if (!matchedKeyword) return null;

  const purchaseKeywords = ['mercado', 'loja', 'restaurante', 'farmacia', 'posto', 'uber', 'ifood', 'assinatura'];
  const looksLikePurchase = purchaseKeywords.some((keyword) => normalizedDescription.includes(keyword));
  if (looksLikePurchase) return null;

  return {
    keyword: matchedKeyword,
    reason: `Possivel transferencia interna detectada por "${matchedKeyword}".`
  };
}

function getDaysBetween(dateA = '', dateB = '') {
  const a = dateA ? new Date(`${dateA}T00:00:00`) : null;
  const b = dateB ? new Date(`${dateB}T00:00:00`) : null;
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}

function reconcileInternalTransfers(rows = []) {
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const creditCandidates = normalizedRows.filter((row) => row.direction === 'credit');

  normalizedRows.forEach((row) => {
    if (!row.possibleInternalTransfer || row.direction !== 'debit') return;

    const match = creditCandidates.find((candidate) =>
      !candidate.reconciledInternalTransfer &&
      Number(candidate.amount || 0).toFixed(2) === Number(row.amount || 0).toFixed(2) &&
      getDaysBetween(candidate.date, row.date) <= 3
    );

    if (!match) return;

    row.reconciledInternalTransfer = true;
    row.status = 'ignorado';
    row.importable = false;
    row.note = `Transferencia interna reconciliada com credito do mesmo extrato em ${formatDate(match.date)}.`;

    match.reconciledInternalTransfer = true;
    if (match.status !== 'ignorado') {
      match.status = 'ignorado';
      match.importable = false;
      match.note = `Credito conciliado com debito interno de ${formatDate(row.date)}.`;
    }
  });

  return normalizedRows;
}

function suggestCategory(description = '', categories = []) {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return null;

  const byNameMatch = categories.find((category) => {
    const normalizedName = normalizeText(category.category_name || '');
    return normalizedName && normalizedDescription.includes(normalizedName);
  });
  if (byNameMatch) {
    return { category: byNameMatch, confidence: 'alta', reason: 'Categoria reconhecida pela propria descricao.' };
  }

  for (const rule of DEFAULT_CATEGORY_RULES) {
    if (!rule.keywords.some((keyword) => normalizedDescription.includes(normalizeText(keyword)))) continue;
    const category = findCategoryByName(categories, rule.category);
    if (category) {
      return { category, confidence: rule.confidence, reason: `Sugestao por palavra-chave: ${rule.keywords.find((keyword) => normalizedDescription.includes(normalizeText(keyword))) || rule.category}` };
    }
  }

  const other = getDefaultOtherCategory(categories);
  if (other) {
    return { category: other, confidence: 'baixa', reason: 'Sem regra clara. Direcionado para Outros ate revisao manual.' };
  }

  return null;
}

function applyCategorySuggestion(row = {}, categories = [], existingRecords = []) {
  const next = { ...row };

  if (!next.date || Number(next.amount || 0) <= 0) {
    next.status = 'revisar';
    next.note = 'Linha invalida para importacao. Verifique data e valor.';
    next.importable = false;
    return next;
  }

  const suggestion = suggestCategory(row.description, categories);

  if (suggestion?.category) {
    next.categoryId = suggestion.category.id || '';
    next.categoryName = suggestion.category.category_name || '';
    next.macroCategory = suggestion.category.macro_category || '';
    next.confidence = suggestion.confidence || 'media';
    next.note = suggestion.reason || '';
  } else {
    next.categoryId = '';
    next.categoryName = '';
    next.macroCategory = '';
    next.confidence = 'baixa';
    next.note = 'Sem categoria sugerida. Revise manualmente antes de importar.';
  }

  if (row.direction !== 'debit') {
    next.status = 'ignorado';
    next.note = 'Credito detectado. O fluxo atual importa apenas saidas.';
    next.importable = false;
    return next;
  }

  const possibleTransfer = detectPossibleInternalTransfer(next.description);
  if (possibleTransfer) {
    next.possibleInternalTransfer = true;
    next.status = 'revisar';
    next.importable = false;
    next.note = possibleTransfer.reason;
  } else {
    next.possibleInternalTransfer = false;
  }

  const duplicate = existingRecords.some((record) => {
    if (String(record.type || '') !== 'saida') return false;
    if (String(record.import_core_signature || '') === next.importCoreSignature) return true;

    const sameDate = String(record.occurred_date || '') === next.date;
    const sameAmount = Number(record.amount || 0).toFixed(2) === Number(next.amount || 0).toFixed(2);
    const sameDescription = normalizeText(record.description || '') === normalizeText(next.description || '');
    return sameDate && sameAmount && sameDescription;
  });

  if (duplicate) {
    next.status = 'duplicado';
    next.note = 'Possivel duplicidade com uma saida ja existente.';
    next.importable = false;
    next.duplicate = true;
    return next;
  }

  next.status = next.possibleInternalTransfer ? 'revisar' : (next.categoryId ? 'pronto' : 'revisar');
  next.importable = Boolean(next.categoryId) && !next.possibleInternalTransfer;
  if (!next.categoryId && !next.possibleInternalTransfer) {
    next.note = 'Selecione uma categoria existente para liberar a importacao.';
  }

  return next;
}

function getStatusBadge(status = '') {
  if (status === 'pronto') return '<span class="px-2 py-1 rounded-lg text-xs bg-success/15 text-success">Pronto</span>';
  if (status === 'duplicado') return '<span class="px-2 py-1 rounded-lg text-xs bg-warn/15 text-warn">Duplicado</span>';
  if (status === 'ignorado') return '<span class="px-2 py-1 rounded-lg text-xs bg-surfaceLight text-textSecondary">Ignorado</span>';
  if (status === 'importado') return '<span class="px-2 py-1 rounded-lg text-xs bg-accent/15 text-accent">Importado</span>';
  return '<span class="px-2 py-1 rounded-lg text-xs bg-danger/15 text-danger">Revisar</span>';
}

function getConfidenceBadge(confidence = '') {
  if (confidence === 'manual') return '<span class="px-2 py-1 rounded-lg text-xs bg-accent/15 text-accent">Manual</span>';
  if (confidence === 'alta') return '<span class="px-2 py-1 rounded-lg text-xs bg-success/15 text-success">Alta</span>';
  if (confidence === 'media') return '<span class="px-2 py-1 rounded-lg text-xs bg-warn/15 text-warn">Media</span>';
  return '<span class="px-2 py-1 rounded-lg text-xs bg-surfaceLight text-textSecondary">Baixa</span>';
}

function buildSummaryCards(records = []) {
  const categories = records.filter((record) => record?.type === 'categoria').length;
  const macros = records.filter((record) => record?.type === 'macro').length;
  const people = records.filter((record) => record?.type === 'pessoa').length;
  const imported = records.filter((record) => String(record.import_source || '').startsWith('bank:')).length;

  return [
    { label: 'Categorias prontas', value: categories, hint: 'Base oficial para o vinculo do importador' },
    { label: 'Macros disponiveis', value: macros, hint: 'Camada que alimenta os graficos principais' },
    { label: 'Pessoas cadastradas', value: people, hint: 'Destino opcional para vincular origem e responsabilidade' },
    { label: 'Registros importados', value: imported, hint: 'Lancamentos marcados com import_source bank:*' }
  ];
}

function getImportedSaidaRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.type === 'saida' &&
      (record?.source_mode === 'import' || record?.source_mode === 'imported') &&
      String(record.import_source || '').startsWith('bank:')
    )
    .sort((left, right) => String(right.created_at || right.updated_at || '').localeCompare(String(left.created_at || left.updated_at || '')));
}

function groupImportedBatches(records = []) {
  const grouped = new Map();

  getImportedSaidaRecords(records).forEach((record) => {
    const batchId = String(record.import_batch_id || 'sem_lote');
    if (!grouped.has(batchId)) {
      grouped.set(batchId, {
        batchId,
        source: String(record.import_source || ''),
        records: []
      });
    }
    grouped.get(batchId).records.push(record);
  });

  return [...grouped.values()].map((group) => {
    const people = [...new Set(group.records.map((record) => String(record.person || '').trim()).filter(Boolean))];
    const competences = [...new Set(group.records.map((record) => String(record.competence || '').trim()).filter(Boolean))];
    const total = group.records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    const createdAt = group.records
      .map((record) => String(record.created_at || record.updated_at || ''))
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || '';

    return {
      ...group,
      people,
      competences,
      total,
      createdAt
    };
  }).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

function groupCategoriesByMacro(records = []) {
  const grouped = new Map();

  records
    .filter((record) => record?.type === 'categoria')
    .forEach((record) => {
      const macro = String(record.macro_category || 'Sem macro').trim() || 'Sem macro';
      if (!grouped.has(macro)) grouped.set(macro, []);
      grouped.get(macro).push(record);
    });

  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([macro, items]) => ({
      macro,
      items: items.sort((left, right) => String(left.category_name || '').localeCompare(String(right.category_name || '')))
    }));
}

function renderOverview(records = []) {
  const summaryCards = buildSummaryCards(records);
  const categoryGroups = groupCategoriesByMacro(records);

  const summaryContainer = document.getElementById('importacao-summary-cards');
  if (summaryContainer) {
    summaryContainer.innerHTML = summaryCards.map((card) => `
      <div class="glass rounded-xl p-4 border border-surfaceLight">
        <p class="text-xs uppercase tracking-[0.18em] text-textSecondary">${escapeHtml(card.label)}</p>
        <p class="text-2xl font-bold text-textPrimary mt-2">${escapeHtml(card.value)}</p>
        <p class="text-xs text-textSecondary mt-2">${escapeHtml(card.hint)}</p>
      </div>
    `).join('');
  }

  const flowContainer = document.getElementById('importacao-flow');
  if (flowContainer) {
    flowContainer.innerHTML = [
      {
        title: '1. Leitura por layout de banco',
        description: 'Selecionar o banco antes do arquivo e aplicar parser especifico para Mercado Pago, Bradesco, Inter e novos formatos.'
      },
      {
        title: '2. Normalizacao para o schema do app',
        description: 'Cada debito deve virar um record compativel com type saida, com amount, competence, occurred_date, macro_category, subcategory e import_source.'
      },
      {
        title: '3. Categoria amarrada ao cadastro oficial',
        description: 'A classificacao automatica tenta vincular category_id, category_name, category_color e category_icon usando as categorias ja existentes do Finance Control.'
      },
      {
        title: '4. Preview antes de gravar',
        description: 'Exibir conflitos, duplicidades e registros sem categoria clara antes de persistir, com opcao de ajuste manual em lote.'
      },
      {
        title: '5. Persistencia auditavel',
        description: 'Salvar source_mode, import_source e assinaturas para deduplicacao, rastreabilidade e remocao seletiva.'
      },
      {
        title: '6. PDF e reconciliacao interna',
        description: 'Arquivos PDF do Itau entram no mesmo preview, com conciliacao automatica de pares credito/debito para transferencias internas.'
      }
    ].map((item) => `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-4">
        <p class="text-sm font-semibold text-textPrimary">${escapeHtml(item.title)}</p>
        <p class="text-xs text-textSecondary mt-2">${escapeHtml(item.description)}</p>
      </div>
    `).join('');
  }

  const supportedBanksContainer = document.getElementById('importacao-supported-banks');
  if (supportedBanksContainer) {
    supportedBanksContainer.innerHTML = [
      ['Bradesco', 'CSV com credito e debito separados'],
      ['Mercado Pago', 'CSV com saldo parcial e valor liquido'],
      ['Banco Inter', 'CSV com historico, descricao, valor e saldo'],
      ['Itau', 'PDF textual com leitura automatica no navegador'],
      ['CSV padrao', 'Cabecalho data, descricao, valor e tipo']
    ].map(([name, detail]) => `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3">
        <p class="text-sm font-semibold text-textPrimary">${escapeHtml(name)}</p>
        <p class="text-xs text-textSecondary mt-1">${escapeHtml(detail)}</p>
      </div>
    `).join('');
  }

  const categoryBridgeContainer = document.getElementById('importacao-category-bridge');
  if (categoryBridgeContainer) {
    if (!categoryGroups.length) {
      categoryBridgeContainer.innerHTML = '<p class="text-sm text-textSecondary">Cadastre categorias em Configuracoes antes de ativar a importacao bancaria.</p>';
    } else {
      categoryBridgeContainer.innerHTML = categoryGroups.map((group) => `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <p class="text-sm font-semibold text-textPrimary">${escapeHtml(group.macro)}</p>
            <span class="text-xs text-textSecondary">${group.items.length} categoria(s)</span>
          </div>
          <div class="flex flex-wrap gap-2">
            ${group.items.map((item) => `
              <span class="px-2.5 py-1.5 rounded-lg text-xs bg-surfaceLight text-textPrimary border border-surfaceLight">
                ${escapeHtml(item.category_name || 'Sem nome')}
              </span>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  const dashboardBindingContainer = document.getElementById('importacao-dashboard-binding');
  if (dashboardBindingContainer) {
    dashboardBindingContainer.innerHTML = [
      'amount: entra em totais de saidas, saldo e comprometimento.',
      'competence: garante presenca correta no dashboard mensal e filtros de periodo.',
      'status e paid_at: separam pago versus em aberto.',
      'macro_category: alimenta o grafico principal por categoria.',
      'subcategory e description: alimentam detalhe por subcategoria e lista recente.',
      'person: opcional, sem atrapalhar o fluxo atual do app.',
      'category_id, category_name, category_color, category_icon: mantem consistencia visual e semantica com o cadastro oficial.',
      'source_mode, import_source e signatures: permitem rastrear, deduplicar e remover uma importacao sem afetar lancamentos manuais.'
    ].map((item) => `
      <div class="rounded-lg border border-surfaceLight bg-surfaceLight/20 px-3 py-2 text-sm text-textPrimary">
        ${escapeHtml(item)}
      </div>
    `).join('');
  }

  const roadmapContainer = document.getElementById('importacao-roadmap');
  if (roadmapContainer) {
    roadmapContainer.innerHTML = [
      ['Fase 1', 'Concluida nesta entrega', 'Nova aba de Importacao, visual padronizado e arquitetura de integracao documentada.'],
      ['Fase 2', 'Concluida nesta entrega', 'Preview CSV por banco, mapeamento para categorias oficiais e importacao apenas de saidas.'],
      ['Fase 3', 'Concluida nesta entrega', 'Mapeamento assistido mais inteligente, importacao em lote com remocao seletiva e filtros por origem.'],
      ['Fase 4', 'Concluida nesta entrega', 'Suporte a PDF e reconciliacao avancada de movimentos internos.']
    ].map(([phase, status, detail]) => `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <p class="text-sm font-semibold text-textPrimary">${escapeHtml(phase)}</p>
          <span class="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent">${escapeHtml(status)}</span>
        </div>
        <p class="text-xs text-textSecondary mt-2">${escapeHtml(detail)}</p>
      </div>
    `).join('');
  }
}

function renderPreview(target = globalThis) {
  const state = getImportacaoState(target);
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const scopedRecords = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  const categoryRecords = getCategoryRecords(scopedRecords);
  const peopleRecords = getPeopleRecords(scopedRecords);

  const personField = document.getElementById('import-person-owner');
  if (personField) {
    const currentValue = state.selectedPerson || personField.value || '';
    personField.innerHTML = `
      <option value="">Selecionar responsavel</option>
      ${peopleRecords.map((person) => `
        <option value="${escapeHtml(person.person || '')}" ${String(person.person || '') === currentValue ? 'selected' : ''}>
          ${escapeHtml(person.person || '')}
        </option>
      `).join('')}
    `;
  }

  const bulkCategoryField = document.getElementById('import-bulk-category');
  if (bulkCategoryField) {
    const currentValue = bulkCategoryField.value || '';
    bulkCategoryField.innerHTML = `
      <option value="">Selecionar categoria</option>
      ${categoryRecords.map((category) => `
        <option value="${escapeHtml(category.id || '')}" ${String(category.id || '') === currentValue ? 'selected' : ''}>
          ${escapeHtml(`${category.macro_category || 'Sem macro'} / ${category.category_name || 'Sem nome'}`)}
        </option>
      `).join('')}
    `;
  }

  const summaryContainer = document.getElementById('importacao-preview-summary');
  if (summaryContainer) {
    const summary = [
      { label: 'Linhas lidas', value: rows.length },
      { label: 'Prontas', value: rows.filter((row) => row.status === 'pronto').length },
      { label: 'Duplicadas', value: rows.filter((row) => row.status === 'duplicado').length },
      { label: 'Ignoradas', value: rows.filter((row) => row.status === 'ignorado').length },
      { label: 'Transferencias', value: rows.filter((row) => row.possibleInternalTransfer).length },
      { label: 'Conciliadas', value: rows.filter((row) => row.reconciledInternalTransfer).length }
    ];

    summaryContainer.innerHTML = summary.map((item) => `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3">
        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">${escapeHtml(item.label)}</p>
        <p class="text-xl font-bold text-textPrimary mt-2">${escapeHtml(item.value)}</p>
      </div>
    `).join('');
  }

  const meta = document.getElementById('importacao-preview-meta');
  if (meta) {
    meta.textContent = rows.length
      ? `${state.fileName || 'Arquivo'} • ${MODEL_LABELS[state.bankModel] || state.bankModel} • ${rows.filter((row) => row.importable).length} linha(s) liberada(s) para importacao`
      : 'Nenhum preview carregado.';
  }

  const tableBody = document.getElementById('importacao-preview-rows');
  if (tableBody) {
    if (!rows.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="px-3 py-6 text-center text-textSecondary">Selecione um CSV e gere o preview para revisar as saidas antes de importar.</td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = rows.map((row, index) => `
        <tr class="border-t border-surfaceLight">
          <td class="px-3 py-2">${getStatusBadge(row.status)}</td>
          <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(formatDate(row.date))}</td>
          <td class="px-3 py-2 whitespace-nowrap text-sm text-textPrimary">${escapeHtml(row.person || '-')}</td>
          <td class="px-3 py-2">
            <div class="font-medium text-textPrimary">${escapeHtml(row.description)}</div>
            <div class="text-xs text-textSecondary mt-1">${escapeHtml(row.importSource)}</div>
          </td>
          <td class="px-3 py-2 text-right font-semibold ${row.direction === 'debit' ? 'text-danger' : 'text-success'}">${escapeHtml(safeCurrency(row.amount))}</td>
          <td class="px-3 py-2 min-w-[220px]">
            <select class="w-full text-xs" data-import-category-index="${index}">
              <option value="">Selecionar categoria</option>
              ${categoryRecords.map((category) => `
                <option value="${escapeHtml(category.id)}" ${String(row.categoryId || '') === String(category.id || '') ? 'selected' : ''}>
                  ${escapeHtml(`${category.macro_category || 'Sem macro'} / ${category.category_name || 'Sem nome'}`)}
                </option>
              `).join('')}
            </select>
          </td>
          <td class="px-3 py-2">${getConfidenceBadge(row.confidence)}</td>
          <td class="px-3 py-2 text-xs text-textSecondary">${escapeHtml(row.note || '-')}</td>
        </tr>
      `).join('');
    }
  }

  const importButton = document.getElementById('btn-import-commit');
  if (importButton) {
    importButton.disabled = !rows.some((row) => row.importable);
  }
}

function renderHistory(target = globalThis) {
  const state = getImportacaoState(target);
  const records = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  const importedRecords = getImportedSaidaRecords(records);
  const sourceFilter = state.historySourceFilter || 'all';
  const sourceOptions = [...new Set(importedRecords.map((record) => String(record.import_source || '')).filter(Boolean))].sort();
  const filteredRecords = sourceFilter === 'all'
    ? importedRecords
    : importedRecords.filter((record) => String(record.import_source || '') === sourceFilter);
  const batches = groupImportedBatches(filteredRecords);

  const filterField = document.getElementById('import-history-source-filter');
  if (filterField) {
    filterField.innerHTML = `
      <option value="all">Todas as origens</option>
      ${sourceOptions.map((source) => `
        <option value="${escapeHtml(source)}" ${source === sourceFilter ? 'selected' : ''}>
          ${escapeHtml(prettifySource(source))}
        </option>
      `).join('')}
    `;
  }

  const meta = document.getElementById('importacao-history-meta');
  if (meta) {
    meta.textContent = filteredRecords.length
      ? `${batches.length} lote(s) encontrado(s) • ${filteredRecords.length} saida(s) importada(s) • total ${safeCurrency(filteredRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0))}`
      : 'Nenhuma importacao registrada ainda.';
  }

  const container = document.getElementById('importacao-history-batches');
  if (!container) return;

  if (!batches.length) {
    container.innerHTML = '<div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4 text-sm text-textSecondary">Nenhum lote encontrado para o filtro atual.</div>';
    return;
  }

  container.innerHTML = batches.map((batch) => `
    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p class="text-sm font-semibold text-textPrimary">${escapeHtml(prettifySource(batch.source))}</p>
          <p class="text-xs text-textSecondary mt-1">Lote ${escapeHtml(batch.batchId)} • ${escapeHtml(batch.createdAt ? new Date(batch.createdAt).toLocaleString('pt-BR') : '-')}</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button type="button" data-import-delete-batch="${escapeHtml(batch.batchId)}" class="px-3 py-2 text-xs rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors font-semibold">Remover lote</button>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 text-xs">
        <div class="rounded-lg border border-surfaceLight bg-surface/40 px-3 py-2 text-textPrimary">Registros: <strong>${batch.records.length}</strong></div>
        <div class="rounded-lg border border-surfaceLight bg-surface/40 px-3 py-2 text-textPrimary">Total: <strong>${escapeHtml(safeCurrency(batch.total))}</strong></div>
        <div class="rounded-lg border border-surfaceLight bg-surface/40 px-3 py-2 text-textPrimary">Responsaveis: <strong>${escapeHtml(batch.people.join(', ') || '-')}</strong></div>
        <div class="rounded-lg border border-surfaceLight bg-surface/40 px-3 py-2 text-textPrimary">Competencias: <strong>${escapeHtml(batch.competences.join(', ') || '-')}</strong></div>
      </div>
      <div class="space-y-2">
        ${batch.records.slice(0, 6).map((record) => `
          <div class="rounded-lg border border-surfaceLight bg-surface/30 p-3">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p class="text-sm font-medium text-textPrimary">${escapeHtml(record.description || 'Sem descricao')}</p>
                <p class="text-xs text-textSecondary mt-1">${escapeHtml(formatDate(record.occurred_date || ''))} • ${escapeHtml(record.person || '-')} • ${escapeHtml(record.subcategory || record.category_name || '-')}</p>
              </div>
              <div class="flex items-center gap-2">
                <strong class="text-danger text-sm">${escapeHtml(safeCurrency(record.amount || 0))}</strong>
                <button type="button" data-import-delete-record="${escapeHtml(record.id || '')}" class="px-2.5 py-1.5 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/30 transition-colors">Remover item</button>
              </div>
            </div>
          </div>
        `).join('')}
        ${batch.records.length > 6 ? `<p class="text-xs text-textSecondary">Mostrando 6 de ${batch.records.length} registros deste lote.</p>` : ''}
      </div>
    </div>
  `).join('');
}

function buildImportedSaidaPayload(row = {}, target = globalThis) {
  const createdAt = new Date().toISOString();
  const competence = String(row.date || '').slice(0, 7);
  const user = getCurrentAuthUser(target);
  const builder = target.financeRecordPayloadBuilders?.buildSaidaPayload;

  const basePayload = typeof builder === 'function'
    ? builder({
      person: row.person || '',
      macro: row.macroCategory || '',
      subcategory: row.categoryName || '',
      description: row.description || '',
      amount: Number(row.amount || 0),
      status: 'Pago',
      paymentMethod: row.importSource || '',
      occurredDate: row.date || '',
      dueDate: row.date || '',
      competence,
      paidAt: row.date || '',
      cycle: '',
      recurrence: '',
      installmentNo: 0,
      totalInstallments: 0,
      parentId: '',
      now: new Date(createdAt)
    })
    : {
      type: 'saida',
      person: row.person || '',
      macro_category: row.macroCategory || '',
      subcategory: row.categoryName || '',
      description: row.description || '',
      amount: Number(row.amount || 0),
      status: 'Pago',
      payment_method: row.importSource || '',
      occurred_date: row.date || '',
      due_date: row.date || '',
      competence,
      paid_at: row.date || '',
      installment_no: 0,
      total_installments: 0,
      parent_id: '',
      recurrence: '',
      cycle: '',
      created_at: createdAt
    };

  const allRecords = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  const category = allRecords.find((record) => record?.type === 'categoria' && String(record.id) === String(row.categoryId || ''));

  return {
    ...basePayload,
    category_id: category?.id || '',
    category_name: category?.category_name || row.categoryName || '',
    category_color: category?.category_color || '',
    category_icon: category?.category_icon || '',
    source_mode: 'import',
    import_source: row.importSource || '',
    import_batch_id: getImportacaoState(target).batchId || '',
    import_signature: row.importSignature || '',
    import_core_signature: row.importCoreSignature || '',
    owner_uid: user?.uid || '',
    owner_email: user?.email || ''
  };
}

function buildImportContext(target = globalThis) {
  const user = getCurrentAuthUser(target);
  return {
    actorUid: user?.uid || '',
    ownerUid: user?.uid || '',
    actorRole: target.financeApp?.authContext?.role || target.currentUserProfile?.role || 'user',
    actorStatus: target.financeApp?.authContext?.accountStatus || target.currentUserProfile?.status || 'active',
    correlationId: `import-${Date.now()}`
  };
}

function getImportRepositories(target = globalThis) {
  return getImportPipelineRepositories(target);
}

async function generatePreview(target = globalThis) {
  const state = getImportacaoState(target);
  const fileInput = document.getElementById('import-file-input');
  const modelField = document.getElementById('import-bank-model');
  const labelField = document.getElementById('import-bank-label');
  const personField = document.getElementById('import-person-owner');
  const file = fileInput?.files?.[0];

  if (!file) {
    notify(target, 'Selecione um arquivo CSV ou PDF para gerar o preview.', true);
    return;
  }

  const bankModel = modelField?.value || 'BRADESCO';
  const bankLabel = String(labelField?.value || MODEL_LABELS[bankModel] || bankModel).trim();
  const selectedPerson = String(personField?.value || '').trim();
  const user = getCurrentAuthUser(target);

  if (!user?.uid) {
    notify(target, 'Faça login para gerar preview de importacao.', true);
    return;
  }

  if (!selectedPerson) {
    notify(target, 'Selecione o responsavel para vincular as saidas importadas.', true);
    return;
  }

  try {
    const text = bankModel === 'ITAU_PDF'
      ? await extractPdfText(file)
      : await file.text();
    const scopedRecords = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
    const categories = getCategoryRecords(scopedRecords);
    const existingRecords = scopedRecords;
    const rows = reconcileInternalTransfers(parseBankFile(text, bankModel, { bankModel, bankLabel, fileName: file.name })
      .map((row, index) => ({ ...row, index, person: selectedPerson }))
      .map((row) => applyCategorySuggestion(row, categories, existingRecords)));

    state.rows = rows;
    state.fileName = file.name;
    state.bankModel = bankModel;
    state.bankLabel = bankLabel;
    state.batchId = `batch_${slugify(bankLabel)}_${Date.now()}`;
    state.selectedPerson = selectedPerson;

    renderPreview(target);
    notify(target, `Preview gerado com ${rows.length} linha(s).`, false);
  } catch (error) {
    state.rows = [];
    renderPreview(target);
    const message = bankModel === 'ITAU_PDF'
      ? `Erro ao ler PDF: ${error.message}. Se o arquivo for escaneado ou a biblioteca externa estiver bloqueada, o preview nao sera gerado.`
      : `Erro ao ler arquivo: ${error.message}`;
    notify(target, message, true);
  }
}

function updatePreviewRowCategory(index = -1, categoryId = '', target = globalThis) {
  const state = getImportacaoState(target);
  const row = state.rows[index];
  if (!row) return;

  const scopedRecords = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  const categories = getCategoryRecords(scopedRecords);
  const existingRecords = scopedRecords;
  const category = categories.find((item) => String(item.id) === String(categoryId || '')) || null;

  const nextRow = {
    ...row,
    categoryId: category?.id || '',
    categoryName: category?.category_name || '',
    macroCategory: category?.macro_category || '',
    confidence: category ? row.confidence || 'media' : 'baixa',
    note: category
      ? `Categoria definida manualmente: ${category.category_name || ''}`
      : 'Selecione uma categoria existente para liberar a importacao.'
  };

  state.rows[index] = applyCategorySuggestion(
    {
      ...nextRow,
      categoryId: nextRow.categoryId,
      categoryName: nextRow.categoryName,
      macroCategory: nextRow.macroCategory,
      confidence: nextRow.confidence,
      note: nextRow.note
    },
    [],
    existingRecords
  );

  if (category) {
    state.rows[index].categoryId = category.id || '';
    state.rows[index].categoryName = category.category_name || '';
    state.rows[index].macroCategory = category.macro_category || '';
    state.rows[index].confidence = 'manual';
    state.rows[index].possibleInternalTransfer = false;
    state.rows[index].status = state.rows[index].duplicate ? 'duplicado' : 'pronto';
    state.rows[index].importable = !state.rows[index].duplicate;
    state.rows[index].note = `Categoria definida manualmente: ${category.category_name || ''}`;
  }

  renderPreview(target);
}

function applyBulkCategory(target = globalThis) {
  const bulkCategoryField = document.getElementById('import-bulk-category');
  const targetField = document.getElementById('import-bulk-target');
  const categoryId = String(bulkCategoryField?.value || '').trim();
  const scope = String(targetField?.value || 'review').trim();
  const state = getImportacaoState(target);

  if (!categoryId) {
    notify(target, 'Selecione uma categoria para aplicar em lote.', true);
    return;
  }

  let updatedCount = 0;
  state.rows.forEach((row, index) => {
    const shouldApply = scope === 'review'
      ? row.status === 'revisar' && !row.possibleInternalTransfer
      : scope === 'transfer'
        ? Boolean(row.possibleInternalTransfer)
        : row.status === 'revisar' || Boolean(row.possibleInternalTransfer);

    if (!shouldApply) return;
    updatePreviewRowCategory(index, categoryId, target);
    updatedCount += 1;
  });

  if (!updatedCount) {
    notify(target, 'Nenhuma linha elegivel para aplicar a categoria em lote.', true);
    return;
  }

  notify(target, `Categoria aplicada em ${updatedCount} linha(s).`, false);
}

async function commitImport(target = globalThis) {
  const state = getImportacaoState(target);
  const readyRows = state.rows.filter((row) => row.importable);
  const user = getCurrentAuthUser(target);

  if (!user?.uid) {
    notify(target, 'Faça login para importar registros.', true);
    return;
  }

  if (!readyRows.length) {
    notify(target, 'Nenhuma linha pronta para importacao.', true);
    return;
  }

  const context = buildImportContext(target);
  const repositories = getImportRepositories(target);
  const prepared = await PrepareImportBatch({
    rows: readyRows,
    importType: IMPORT_TYPES.BANK_STATEMENT,
    originalFilename: state.fileName,
    fileContent: state.rows.map((row) => ({
      date: row.date,
      description: row.description,
      amount: row.amount,
      bankModel: row.parserModel,
      sourceReferenceId: row.importSignature
    })),
    context,
    repositories,
    mapRowToPayload: (row) => buildImportedSaidaPayload(row, target)
  });

  if (!prepared.success) {
    notify(target, prepared.message || 'Erro ao preparar lote de importacao.', true);
    return;
  }

  const result = await CommitImportBatch({
    preparedBatch: prepared.data,
    context,
    repositories
  });

  if (result.success) {
    const importedIds = new Set(result.entityIds || []);
    const importedCount = result.data?.imported || importedIds.size || 0;
    state.batchId = result.data?.batch?.batch_id || prepared.data.batch.batch_id || state.batchId;
    readyRows.slice(0, importedCount).forEach((row) => {
      row.imported = true;
      row.importable = false;
      row.status = 'importado';
      row.note = result.idempotentReplay ? 'Importacao ja processada anteriormente.' : 'Saida criada com sucesso.';
    });
    if (Array.isArray(target.allRecords) && importedIds.size) {
      target.allRecords.forEach((record) => {
        if (importedIds.has(record.id)) record.import_batch_id = state.batchId;
      });
    }
    notify(target, `${importedCount} saida(s) importada(s) com sucesso.`, importedCount === 0);
  } else {
    readyRows.forEach((row) => {
      row.status = 'revisar';
      row.note = `Erro ao importar: ${result.message || 'falha desconhecida'}`;
    });
    notify(target, result.message || 'Erro ao importar registros.', true);
  }

  renderPreview(target);
  renderHistory(target);
}

function clearPreview(target = globalThis) {
  const state = getImportacaoState(target);
  state.rows = [];
  state.fileName = '';
  state.batchId = '';

  const input = document.getElementById('import-file-input');
  if (input) input.value = '';

  renderPreview(target);
  renderHistory(target);
}

async function deleteImportedRecord(recordId = '', target = globalThis) {
  const user = getCurrentAuthUser(target);
  if (!user?.uid) {
    notify(target, 'Faça login para remover registros importados.', true);
    return;
  }

  const allRecords = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  const record = allRecords.find((item) => String(item.id || '') === String(recordId || ''));
  if (!record) {
    notify(target, 'Registro importado nao encontrado.', true);
    return;
  }

  const result = await target.dataSdk.delete(record);
  if (!result?.isOk) {
    notify(target, `Erro ao remover registro: ${result?.error || 'falha desconhecida'}`, true);
    return;
  }

  notify(target, 'Registro importado removido com sucesso.', false);
  renderHistory(target);
}

async function deleteImportedBatch(batchId = '', target = globalThis) {
  const user = getCurrentAuthUser(target);
  if (!user?.uid) {
    notify(target, 'Faça login para remover lotes importados.', true);
    return;
  }

  const importedRecords = getImportedSaidaRecords(getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target))
    .filter((record) => String(record.import_batch_id || '') === String(batchId || ''));

  if (!importedRecords.length) {
    notify(target, 'Lote nao encontrado para remocao.', true);
    return;
  }

  let removedCount = 0;
  for (const record of importedRecords) {
    const result = await target.dataSdk.delete(record);
    if (result?.isOk) removedCount += 1;
  }

  notify(target, `${removedCount} registro(s) removido(s) do lote selecionado.`, removedCount === 0);
  renderHistory(target);
}

function bindStaticActions(target = globalThis) {
  const openSettingsButton = document.getElementById('btn-importacao-open-settings');
  const openSaidasButton = document.getElementById('btn-importacao-open-saidas');
  const previewButton = document.getElementById('btn-import-preview');
  const importButton = document.getElementById('btn-import-commit');
  const clearButton = document.getElementById('btn-import-clear');
  const modelField = document.getElementById('import-bank-model');
  const personField = document.getElementById('import-person-owner');
  const bulkCategoryButton = document.getElementById('btn-import-apply-bulk-category');
  const historyFilterField = document.getElementById('import-history-source-filter');
  const historyRefreshButton = document.getElementById('btn-import-history-refresh');
  const tableBody = document.getElementById('importacao-preview-rows');
  const historyContainer = document.getElementById('importacao-history-batches');

  if (openSettingsButton) {
    openSettingsButton.onclick = () => target.switchTab?.('configuracoes');
  }

  if (openSaidasButton) {
    openSaidasButton.onclick = () => target.switchTab?.('saidas');
  }

  if (previewButton) {
    previewButton.onclick = () => generatePreview(target);
  }

  if (importButton) {
    importButton.onclick = () => commitImport(target);
  }

  if (clearButton) {
    clearButton.onclick = () => clearPreview(target);
  }

  if (modelField) {
    modelField.onchange = () => {
      const labelField = document.getElementById('import-bank-label');
      const label = MODEL_LABELS[modelField.value] || modelField.value;
      if (labelField && !labelField.value.trim()) {
        labelField.value = label;
      }
    };
  }

  if (personField) {
    personField.onchange = () => {
      const state = getImportacaoState(target);
      state.selectedPerson = String(personField.value || '').trim();
      state.rows = state.rows.map((row) => ({
        ...row,
        person: state.selectedPerson || row.person || ''
      }));
      renderPreview(target);
    };
  }

  if (bulkCategoryButton) {
    bulkCategoryButton.onclick = () => applyBulkCategory(target);
  }

  if (historyFilterField) {
    historyFilterField.onchange = () => {
      const state = getImportacaoState(target);
      state.historySourceFilter = String(historyFilterField.value || 'all');
      renderHistory(target);
    };
  }

  if (historyRefreshButton) {
    historyRefreshButton.onclick = () => renderHistory(target);
  }

  if (tableBody) {
    tableBody.onchange = (event) => {
      const select = event.target.closest('[data-import-category-index]');
      if (!select) return;
      const index = Number(select.dataset.importCategoryIndex);
      updatePreviewRowCategory(index, select.value, target);
    };
  }

  if (historyContainer) {
    historyContainer.onclick = async (event) => {
      const deleteBatchButton = event.target.closest('[data-import-delete-batch]');
      if (deleteBatchButton) {
        await deleteImportedBatch(deleteBatchButton.dataset.importDeleteBatch || '', target);
        return;
      }

      const deleteRecordButton = event.target.closest('[data-import-delete-record]');
      if (deleteRecordButton) {
        await deleteImportedRecord(deleteRecordButton.dataset.importDeleteRecord || '', target);
      }
    };
  }
}

function bindDelegatedImportacaoActions(target = globalThis) {
  const doc = target.document || globalThis.document;
  if (!doc || doc.__financeImportacaoDelegatedBound) return;
  doc.__financeImportacaoDelegatedBound = true;

  doc.addEventListener('click', async (event) => {
    const previewButton = event.target.closest('#btn-import-preview');
    if (previewButton) {
      event.preventDefault();
      await generatePreview(target);
      return;
    }

    const importButton = event.target.closest('#btn-import-commit');
    if (importButton) {
      event.preventDefault();
      await commitImport(target);
      return;
    }

    const clearButton = event.target.closest('#btn-import-clear');
    if (clearButton) {
      event.preventDefault();
      clearPreview(target);
      return;
    }

    const bulkCategoryButton = event.target.closest('#btn-import-apply-bulk-category');
    if (bulkCategoryButton) {
      event.preventDefault();
      applyBulkCategory(target);
      return;
    }

    const refreshHistoryButton = event.target.closest('#btn-import-history-refresh');
    if (refreshHistoryButton) {
      event.preventDefault();
      renderHistory(target);
      return;
    }

    const openSettingsButton = event.target.closest('#btn-importacao-open-settings');
    if (openSettingsButton) {
      event.preventDefault();
      target.switchTab?.('configuracoes');
      return;
    }

    const openSaidasButton = event.target.closest('#btn-importacao-open-saidas');
    if (openSaidasButton) {
      event.preventDefault();
      target.switchTab?.('saidas');
      return;
    }

    const deleteBatchButton = event.target.closest('[data-import-delete-batch]');
    if (deleteBatchButton) {
      event.preventDefault();
      await deleteImportedBatch(deleteBatchButton.dataset.importDeleteBatch || '', target);
      return;
    }

    const deleteRecordButton = event.target.closest('[data-import-delete-record]');
    if (deleteRecordButton) {
      event.preventDefault();
      await deleteImportedRecord(deleteRecordButton.dataset.importDeleteRecord || '', target);
    }
  });

  doc.addEventListener('change', (event) => {
    const modelField = event.target.closest('#import-bank-model');
    if (modelField) {
      const labelField = doc.getElementById('import-bank-label');
      const label = MODEL_LABELS[modelField.value] || modelField.value;
      if (labelField && !labelField.value.trim()) {
        labelField.value = label;
      }
      return;
    }

    const personField = event.target.closest('#import-person-owner');
    if (personField) {
      const state = getImportacaoState(target);
      state.selectedPerson = String(personField.value || '').trim();
      state.rows = state.rows.map((row) => ({
        ...row,
        person: state.selectedPerson || row.person || ''
      }));
      renderPreview(target);
      return;
    }

    const historyFilterField = event.target.closest('#import-history-source-filter');
    if (historyFilterField) {
      const state = getImportacaoState(target);
      state.historySourceFilter = String(historyFilterField.value || 'all');
      renderHistory(target);
      return;
    }

    const categorySelect = event.target.closest('[data-import-category-index]');
    if (categorySelect) {
      const index = Number(categorySelect.dataset.importCategoryIndex);
      updatePreviewRowCategory(index, categorySelect.value, target);
    }
  });
}

export function renderImportacao(target = globalThis) {
  const records = getScopedRecords(Array.isArray(target.allRecords) ? target.allRecords : [], target);
  bindStaticActions(target);
  try {
    renderOverview(records);
  } catch (error) {
    console.error('Erro ao renderizar overview da importacao', error);
  }
  try {
    renderPreview(target);
  } catch (error) {
    console.error('Erro ao renderizar preview da importacao', error);
  }
  try {
    renderHistory(target);
  } catch (error) {
    console.error('Erro ao renderizar historico da importacao', error);
  }
  target.lucide?.createIcons?.();
}

export function installImportacaoGlobals(target = globalThis) {
  bindDelegatedImportacaoActions(target);
  target.renderImportacao = () => renderImportacao(target);
  return {
    renderImportacao: target.renderImportacao
  };
}
