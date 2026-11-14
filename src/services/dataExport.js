/**
 * Exportacao dos dados da conta (direito de acesso e portabilidade).
 *
 * O servidor junta tudo (Firestore + conversas no Chatwoot) e devolve; aqui viram dois arquivos:
 * um JSON com todas as secoes e um CSV dos lancamentos (abre no Excel com acentos: tem BOM).
 * Usa o mesmo endpoint do checkout/exclusao (relay do n8n -> servidor), com a acao no corpo.
 */
export const DATA_EXPORT_ERROR_MESSAGES = Object.freeze({
  RATE_LIMITED: 'Você já exportou várias vezes agora. Tente de novo em alguns minutos.',
  AUTH_INVALID: 'Sua sessão expirou. Entre de novo.',
  DATA_EXPORT_NOT_CONFIGURED: 'Exportação indisponível no momento.'
});

export function dataExportErrorMessage(error) {
  return DATA_EXPORT_ERROR_MESSAGES[error?.code] || 'Não foi possível exportar agora. Tente de novo.';
}

const fail = (code) => Object.assign(new Error(code), { code });

export function exportFileNames(date = new Date(), locale = 'pt-BR') {
  const day = date.toISOString().slice(0, 10);
  return locale === 'es-ES'
    ? { json: `mis-datos-${day}.json`, csv: `movimientos-${day}.csv` }
    : { json: `meus-dados-${day}.json`, csv: `lancamentos-${day}.csv` };
}

function saveFile(documentRef, name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createDataExportService({
  endpoint = '',
  getIdToken,
  getLocale = () => 'pt-BR',
  fetchImpl = globalThis.fetch,
  documentRef = globalThis.document,
  save = saveFile,
  now = () => new Date()
} = {}) {
  const enabled = Boolean(endpoint && typeof getIdToken === 'function');

  async function fetchMyData() {
    if (!enabled) throw fail('DATA_EXPORT_NOT_CONFIGURED');
    const idToken = await getIdToken();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      // text/plain: requisicao simples, sem preflight de CORS (igual ao checkout).
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ acao: 'exportar_dados', locale: getLocale(), idToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.erro) throw fail(data?.erro?.codigo || `HTTP_${response.status}`);
    if (data?.formato !== 'finance-control-export') throw fail('DATA_EXPORT_INVALID');
    return data;
  }

  async function downloadMyData() {
    const data = await fetchMyData();
    const names = exportFileNames(now(), getLocale());
    const { lancamentos_csv: csv = '', ...json } = data;
    save(documentRef, names.json, JSON.stringify(json, null, 2), 'application/json;charset=utf-8');
    save(documentRef, names.csv, `﻿${csv}`, 'text/csv;charset=utf-8');
    return { files: [names.json, names.csv] };
  }

  return { enabled, fetchMyData, downloadMyData, errorMessage: dataExportErrorMessage };
}
