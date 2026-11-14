import { collection, deleteDoc, doc, getDocs, onSnapshot, runTransaction } from 'firebase/firestore';
import {
  BUDGET_SCOPES,
  budgetIdFor,
  buildBudgetDocument,
  normalizeBudget,
  setLimitFrom
} from '../domain/budgets.js';

export const BUDGETS_COLLECTION = 'budgets';

/**
 * Leitura e gravacao dos orcamentos em users/{uid}/budgets.
 * A gravacao usa transacao: se o Dashboard e outra aba (ou o WhatsApp, no futuro)
 * mudarem o mesmo orcamento ao mesmo tempo, nenhum historico de limites se perde.
 */
export function createBudgetService(db, { now = () => new Date().toISOString() } = {}) {
  const budgetsRef = (uid) => collection(db, 'users', uid, BUDGETS_COLLECTION);
  const budgetRef = (uid, id) => doc(db, 'users', uid, BUDGETS_COLLECTION, id);

  async function listBudgets(uid) {
    if (!uid) throw new Error('AUTH_REQUIRED');
    const snapshot = await getDocs(budgetsRef(uid));
    return snapshot.docs.map((item) => normalizeBudget(item.data(), item.id)).filter(Boolean);
  }

  /** Define o limite de `amount` a partir de `competence` (YYYY-MM). */
  async function saveBudgetLimit(uid, { scope, category_name: categoryName = '', competence, amount }) {
    if (!uid) throw new Error('AUTH_REQUIRED');
    const resolvedScope = scope === BUDGET_SCOPES.TOTAL ? BUDGET_SCOPES.TOTAL : BUDGET_SCOPES.CATEGORY;
    const id = budgetIdFor({ scope: resolvedScope, category_name: categoryName });
    const ref = budgetRef(uid, id);
    return runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      const existing = current.exists() ? normalizeBudget(current.data(), id) : null;
      const limits = setLimitFrom(existing?.limits || {}, competence, amount);
      const payload = {
        ...buildBudgetDocument({
          scope: resolvedScope,
          // Mantem o nome ja gravado (acentos/caixa) quando a categoria existe.
          category_name: existing?.category_name || categoryName,
          limits
        }),
        owner_uid: uid,
        updated_at: now()
      };
      transaction.set(ref, payload);
      return normalizeBudget(payload, id);
    });
  }

  /** Escuta os orcamentos em tempo real (outra aba ou o WhatsApp mudando). Devolve unsubscribe. */
  function subscribeBudgets(uid, onChange, onError = () => {}) {
    if (!uid) throw new Error('AUTH_REQUIRED');
    return onSnapshot(
      budgetsRef(uid),
      (snapshot) => onChange(snapshot.docs.map((item) => normalizeBudget(item.data(), item.id)).filter(Boolean)),
      onError
    );
  }

  async function deleteBudget(uid, id) {
    if (!uid) throw new Error('AUTH_REQUIRED');
    if (!id) throw new Error('INVALID_BUDGET');
    await deleteDoc(budgetRef(uid, id));
  }

  return { listBudgets, subscribeBudgets, saveBudgetLimit, deleteBudget };
}
