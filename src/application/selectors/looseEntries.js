/**
 * Entradas avulsas: tudo que entra e nao faz parte do salario consolidado
 * (salario, hora extra, DSR, descontos e impostos ficam de fora).
 * Mesmo criterio de "Outras receitas" do cartao consolidado, mas para todas as pessoas.
 *
 * Funcoes puras: sem DOM, sem Firebase.
 */

function text(value) {
  return String(value ?? '').trim();
}

function competenceOf(record = {}) {
  const competence = text(record.competence || record.competencia);
  if (/^\d{4}-\d{2}/.test(competence)) return competence.slice(0, 7);
  const date = text(record.occurred_date || record.date || record.due_date);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : '';
}

export function isLooseEntry(record = {}, deps = {}) {
  if (record?.type !== 'entrada') return false;
  if (deps.isArchivedRecord ? deps.isArchivedRecord(record) : record.archived === true) return false;
  if (deps.isReferenceSalaryRecord?.(record)) return false;
  if (record.entry_discount_adjustment === true) return false;

  const label = text(record.subcategory || record.earning_type || record.description).toUpperCase();
  const macro = text(record.macro_category).toUpperCase();
  if (macro.includes('DEDU')) return false;
  if (label.includes('SAL')) return false;
  if (label.includes('HORA EXTRA')) return false;
  if (label.includes('DSR')) return false;
  if (label.includes('INSS') || label.includes('IRRF') || label.includes('IRPF')) return false;
  if (label.includes('DESCONTO')) return false;
  return Number(record.amount || 0) > 0;
}

/**
 * @param {object[]} records
 * @param {{ competence?: string, search?: string, isArchivedRecord?: Function, isReferenceSalaryRecord?: Function }} options
 */
export function selectLooseEntries(records = [], options = {}) {
  const competence = text(options.competence).slice(0, 7);
  const search = text(options.search).toLowerCase();
  const items = (Array.isArray(records) ? records : [])
    .filter((record) => isLooseEntry(record, options))
    .filter((record) => !competence || competenceOf(record) === competence)
    .filter((record) => !search || [record.description, record.person, record.subcategory]
      .some((value) => text(value).toLowerCase().includes(search)))
    .sort((a, b) => {
      const dateA = text(a.occurred_date || a.date || a.created_at);
      const dateB = text(b.occurred_date || b.date || b.created_at);
      return dateB.localeCompare(dateA);
    });
  const total = Math.round(items.reduce((sum, record) => sum + (Number(record.amount) || 0), 0) * 100) / 100;
  return { items, total, count: items.length };
}

/**
 * Monta o registro salvo para uma entrada avulsa (nova ou editada).
 * @param {{ person: string, date: string, description: string, amount: number|string }} input
 */
export function buildLooseEntryRecord(input = {}, existing = null, now = new Date()) {
  const date = text(input.date);
  const amount = Math.round((Number(String(input.amount ?? '').replace(',', '.')) || 0) * 100) / 100;
  const errors = [];
  // Mesma ordem dos campos na janela: descricao, valor, data, pessoa.
  if (!text(input.description)) errors.push('DESCRIPTION_REQUIRED');
  if (!(amount > 0)) errors.push('AMOUNT_REQUIRED');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('DATE_REQUIRED');
  if (!text(input.person)) errors.push('PERSON_REQUIRED');
  if (errors.length) return { ok: false, errors };

  const stamp = now.toISOString();
  return {
    ok: true,
    record: {
      ...(existing || {}),
      type: 'entrada',
      person: text(input.person),
      competence: date.slice(0, 7),
      occurred_date: date,
      macro_category: existing?.macro_category || 'Rendimento',
      subcategory: existing?.subcategory || 'Outras receitas',
      earning_type: existing?.earning_type || 'Outras receitas',
      description: text(input.description),
      amount,
      status: 'Pago',
      paid_at: date,
      created_at: existing?.created_at || stamp,
      updated_at: stamp
    }
  };
}
