/**
 * Registra o aceite da versao atual dos termos e da politica para um usuario de teste.
 *
 * Desde a Etapa 4 (privacidade) o app mostra o aviso de aceite para quem nao aceitou a
 * versao atual, e esse aviso cobre a tela. Os testes que nao tratam do aviso chamam esta
 * funcao logo depois de criar a conta. O proprio aviso tem testes separados.
 */
import { doc, setDoc } from 'firebase/firestore';
import { LEGAL_CONSENTS_COLLECTION, PRIVACY_VERSION, TERMS_VERSION } from '../../../src/core/legalConsent.js';

export async function acceptCurrentLegalTerms(testEnv, uid, { locale = 'pt-BR', at = '2026-11-01T00:00:00.000Z' } = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), LEGAL_CONSENTS_COLLECTION, uid), {
      uid,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source: 'signup',
      locale,
      accepted_at: at,
      updated_at: at
    });
  });
}

/**
 * Cortesia ativa (Premium) para um usuario de teste. O plano Gratuito libera so lancamentos e
 * Inicio; os testes de Parcelamentos, Importacao e Controle de Horas precisam do Premium.
 */
export async function grantPremiumAccess(testEnv, uid, { at = '2026-11-01T00:00:00.000Z' } = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'whatsapp_comp_access', uid), { uid, status: 'active', granted_by: 'e2e-setup', granted_at: at });
  });
}

/**
 * O Inicio nao mostra mais a lista "Saidas no filtro atual". As saidas do filtro ficam no
 * "Ver detalhes" do cartao Saldo. Abre essa janela e devolve a lista; fechar com
 * closeDashboardRecordList.
 */
export async function openDashboardRecordList(page) {
  await page.locator('[data-dashboard-detail="saidas-filtro"]').click();
  const list = page.locator('#dashboard-expense-category-list');
  await list.waitFor({ state: 'visible' });
  return list;
}

export async function closeDashboardRecordList(page) {
  await page.locator('#btn-close-expense-modal').click();
  await page.locator('#dashboard-expense-category-modal').waitFor({ state: 'hidden' });
}
