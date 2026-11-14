import { ApiError } from './errors.js';
import { normalizePhone } from './phoneLinks.js';
import { toPublicRecord } from './queries.js';

/**
 * Exportacao dos dados da conta (LGPD art. 18 / RGPD arts. 15 e 20: acesso e portabilidade).
 *
 * So a propria pessoa, com o ID token do Firebase conferido aqui. Devolve:
 * - `secoes`: tudo o que e da conta no Firestore (perfil, lancamentos, orcamentos, preferencias,
 *   aceites, alertas, vinculos do WhatsApp, assinatura) e as conversas no Chatwoot;
 * - `lancamentos_csv`: os lancamentos numa planilha (separador ';', decimal com virgula).
 * Fica de fora o que e seguranca interna (codigos de vinculo, tentativas, eventos do Stripe).
 */
export const EXPORT_FORMAT = 'finance-control-export';
export const EXPORT_VERSION = 1;

const CSV_COLUMNS = Object.freeze({
  'pt-BR': ['id', 'tipo', 'descricao', 'valor', 'status', 'categoria', 'macro_categoria', 'competencia', 'vencimento', 'data', 'pago_em', 'pessoa', 'forma_pagamento', 'parcela', 'arquivado'],
  'es-ES': ['id', 'tipo', 'descripcion', 'importe', 'estado', 'categoria', 'macro_categoria', 'mes', 'vencimiento', 'fecha', 'pagado_el', 'persona', 'forma_de_pago', 'plazo', 'archivado']
});
const TYPE_LABELS = Object.freeze({ 'pt-BR': { receita: 'receita', despesa: 'despesa' }, 'es-ES': { receita: 'ingreso', despesa: 'gasto' } });

/** Timestamps do Firestore viram ISO; referencias viram caminho; o resto passa igual. */
export function toPlain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.path === 'string' && typeof value?.firestore === 'object') return value.path;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item)]));
  return value;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Planilha dos lancamentos (entradas e saidas, inclusive arquivados, com a coluna arquivado). */
export function buildRecordsCsv(records = [], locale = 'pt-BR') {
  const lang = CSV_COLUMNS[locale] ? locale : 'pt-BR';
  const rows = (Array.isArray(records) ? records : [])
    .filter((record) => record && (record.type === 'entrada' || record.type === 'saida'))
    .map((record) => {
      const item = toPublicRecord(record);
      const amount = Number(item.valor || 0).toFixed(2).replace('.', ',');
      return [item.id, TYPE_LABELS[lang][item.tipo], item.descricao, amount, item.status, item.categoria, item.macro_categoria,
        item.competencia, item.vencimento, item.data, item.pago_em, item.pessoa, item.forma_pagamento, item.parcela,
        record.archived === true ? (lang === 'es-ES' ? 'si' : 'sim') : (lang === 'es-ES' ? 'no' : 'nao')];
    })
    .sort((a, b) => String(a[7]).localeCompare(String(b[7])) || String(a[0]).localeCompare(String(b[0])));
  return [CSV_COLUMNS[lang], ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function createDataExportService({ store, verifyIdToken, chatwoot = null, now = () => new Date(), logger = console } = {}) {
  const configured = Boolean(store?.exportAccountData && verifyIdToken);

  async function authenticate(body) {
    if (!configured) throw new ApiError(503, 'DATA_EXPORT_NOT_CONFIGURED', 'Exportacao indisponivel no momento.');
    const token = String(body?.idToken || '');
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta.');
    try {
      const decoded = await verifyIdToken(token);
      if (!decoded?.uid) throw new Error('no uid');
      return decoded;
    } catch {
      throw new ApiError(401, 'AUTH_INVALID', 'Sessao expirada. Entre de novo.');
    }
  }

  async function chatwootSection(phones) {
    if (!chatwoot?.exportByPhones) return { situacao: 'nao_configurado' };
    if (!phones.length) return { situacao: 'sem_telefone' };
    try {
      return { situacao: 'ok', ...(await chatwoot.exportByPhones(phones)) };
    } catch (error) {
      logger.warn?.(JSON.stringify({ level: 'warn', event: 'data_export_chatwoot_failed', status: error?.chatwoot?.status || 0 }));
      return { situacao: 'indisponivel' };
    }
  }

  async function exportOwnData(body, { beforeExport = () => {} } = {}) {
    const decoded = await authenticate(body);
    beforeExport(decoded.uid);
    const [data, footprint] = await Promise.all([store.exportAccountData(decoded.uid), store.getAccountFootprint(decoded.uid)]);
    const phones = [...new Set((footprint?.phones || []).map(normalizePhone).filter(Boolean))];
    const secoes = toPlain({ ...data, conversas_whatsapp: await chatwootSection(phones) });
    const locale = body?.locale === 'es-ES' ? 'es-ES' : 'pt-BR';
    const records = secoes.dados_da_conta?.finance_records || [];
    return {
      formato: EXPORT_FORMAT,
      versao: EXPORT_VERSION,
      gerado_em: now().toISOString(),
      conta: { uid: decoded.uid, email: decoded.email || secoes.perfil?.email || '' },
      secoes,
      lancamentos_csv: buildRecordsCsv(records, locale)
    };
  }

  return { configured, exportOwnData };
}
