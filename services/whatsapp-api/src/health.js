/**
 * Checagem de saude do banco: faz uma leitura minima (store.ping) com prazo.
 * Nunca lanca erro; devolve { ok, banco, ms } e, se falhar, um motivo curto e sem dados.
 */
export async function checkStoreHealth(store, { timeoutMs = 5000, nowMs = () => Date.now() } = {}) {
  const started = nowMs();
  if (typeof store?.ping !== 'function') return { ok: true, banco: 'nao_verificado', ms: 0 };
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => store.ping()),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs); })
    ]);
    return { ok: true, banco: 'ok', ms: nowMs() - started };
  } catch (error) {
    const raw = String(error?.code ?? error?.message ?? error);
    const motivo = raw === 'TIMEOUT' ? 'TIMEOUT'
      : /RESOURCE_EXHAUSTED|quota/i.test(raw) || raw === '8' ? 'COTA_ESGOTADA'
        : /UNAVAILABLE|ECONN|ETIMEDOUT|ENOTFOUND/i.test(raw) || raw === '14' ? 'INDISPONIVEL'
          : 'ERRO';
    return { ok: false, banco: 'falha', motivo, ms: nowMs() - started };
  } finally {
    clearTimeout(timer);
  }
}
