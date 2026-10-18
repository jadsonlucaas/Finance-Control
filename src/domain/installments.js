function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function isInstallmentRecord(record = {}) {
  if (!record || record.type !== 'saida') return false;
  if (record.is_installment === true) return true;
  if (hasValue(record.parent_id)) return true;
  if (hasValue(record.purchase_parent_id)) return true;
  if (numberValue(record.total_installments) > 1) return true;
  if (numberValue(record.installment_no) > 0) return true;
  if (numberValue(record.installments) > 1) return true;
  if (numberValue(record.total_parcelas) > 1) return true;
  if (numberValue(record.parcela_atual) > 0) return true;
  if (textValue(record.tipoDespesa) === 'parcelada') return true;
  if (textValue(record.tipo) === 'parcelada') return true;
  if (textValue(record.payment_type) === 'installment') return true;
  return false;
}

export function getInstallmentParentId(record = {}) {
  return record.parent_id || record.purchase_parent_id || record.id || '';
}

export function getInstallmentNo(record = {}) {
  return numberValue(record.installment_no || record.parcela_atual || record.installment || 0);
}

export function getTotalInstallments(record = {}) {
  return numberValue(record.total_installments || record.total_parcelas || record.installments || 0);
}

export function getInstallmentCard(record = {}) {
  return record.card || record.payment_method || record.cartao || record.cartao_utilizado || 'Nao informado';
}

export function getInstallmentPurchaseName(record = {}) {
  return record.purchase_name || record.nome_compra || record.description || record.subcategory || 'Compra parcelada';
}

export function getInstallmentRecordKey(record = {}) {
  return record.id || [
    getInstallmentParentId(record),
    getInstallmentNo(record),
    getTotalInstallments(record),
    record.competence || '',
    record.due_date || '',
    record.amount || ''
  ].join('|');
}
