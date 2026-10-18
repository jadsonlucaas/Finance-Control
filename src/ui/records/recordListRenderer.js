function safeText(value) {
  return String(value ?? '');
}

function formatExactDate(value = '') {
  const text = safeText(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const progressiveRenderJobs = new WeakMap();

function scheduleProgressiveChunk(callback, target = globalThis) {
  if (typeof target.requestIdleCallback === 'function') {
    target.requestIdleCallback(callback, { timeout: 180 });
    return;
  }
  target.setTimeout(callback, 16);
}

function appendTextElement(documentRef, parent, tagName, className, text) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  element.textContent = safeText(text);
  parent.appendChild(element);
  return element;
}

function appendIcon(documentRef, parent, name, className) {
  const icon = documentRef.createElement('i');
  icon.setAttribute('data-lucide', name);
  icon.className = className;
  parent.appendChild(icon);
  return icon;
}

function appendActionButton(documentRef, parent, config = {}) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = config.className;
  button.dataset.financeRecordAction = config.action;
  button.dataset.financeRecordId = config.recordId;
  if (config.deleteAction) button.dataset.deleteAction = 'true';
  if (config.title) button.title = config.title;
  if (config.label || config.title) button.setAttribute('aria-label', config.label || config.title);
  appendIcon(documentRef, button, config.icon, 'w-4 h-4');
  parent.appendChild(button);
  return button;
}

export function buildRecordRowViewModel(record = {}, deps = {}) {
  const isEntrada = record.type === 'entrada';
  const isArchived = deps.isArchivedRecord?.(record) ?? Boolean(record.archived);
  const isReference = deps.isReferenceSalaryRecord?.(record) ?? false;
  const status = safeText(record.status);
  const statusBadge = status === 'Pago'
    ? 'bg-success/20 text-success'
    : status === 'Cancelado'
      ? 'bg-danger/20 text-danger'
      : 'bg-warn/20 text-warn';
  const totalInstallments = Number(record.total_installments || 0);
  const installmentNo = Number(record.installment_no || 0);
  const installmentText = totalInstallments > 0 ? ` (${installmentNo}/${totalInstallments})` : '';
  const paymentLabel = record.payment_method ? ` - ${record.payment_method}` : '';
  const referenceLabel = isReference ? ' - Referencia' : '';
  const archivedLabel = isArchived ? ' - Arquivado' : '';
  const exactDate = formatExactDate(record.occurred_date || record.due_date || '');

  return {
    id: safeText(record.id),
    icon: isEntrada ? 'arrow-down-left' : 'arrow-up-right',
    paidIcon: status === 'Pago' ? 'check-circle' : 'circle',
    archiveIcon: isArchived ? 'archive-restore' : 'archive',
    archiveTitle: isArchived ? 'Reabrir lancamento' : 'Arquivar lancamento',
    archiveColor: isArchived ? 'hover:text-accent' : 'hover:text-warn',
    color: isEntrada ? 'text-success' : 'text-danger',
    statusBadge,
    title: `${safeText(record.purchase_name || record.description || record.subcategory || record.earning_type)}`,
    meta: [
      deps.formatCompetence?.(record.competence) ?? safeText(record.competence),
      safeText(record.macro_category)
    ].filter(Boolean).join(' - ') + referenceLabel + archivedLabel,
    pills: [
      exactDate ? `Data ${exactDate}` : '',
      safeText(record.person),
      safeText(record.payment_method) || safeText(record.card),
      totalInstallments > 0 ? `Parcela ${installmentNo}/${totalInstallments}` : ''
    ].filter(Boolean),
    status,
    value: `${isEntrada && record.macro_category === 'Dedução' ? '-' : ''}${deps.fmt?.(record.amount) ?? safeText(record.amount)}`
  };
}

export function createRecordRowElement(record = {}, options = {}) {
  const target = options.target || globalThis;
  const documentRef = options.document || target.document;
  if (!documentRef?.createElement) return null;

  const model = buildRecordRowViewModel(record, {
    fmt: options.fmt || target.fmt,
    formatCompetence: options.formatCompetence || target.formatCompetence,
    isArchivedRecord: options.isArchivedRecord || target.isArchivedRecord,
    isReferenceSalaryRecord: options.isReferenceSalaryRecord || target.isReferenceSalaryRecord
  });

  const row = documentRef.createElement('div');
  row.className = 'mobile-list-row finance-record-row flex items-center gap-3 bg-surfaceLight/50 rounded-lg p-2.5 text-sm';
  appendIcon(documentRef, row, model.icon, `mobile-list-icon w-4 h-4 ${model.color} flex-shrink-0`);

  const main = documentRef.createElement('div');
  main.className = 'mobile-list-main flex-1 min-w-0';
  appendTextElement(documentRef, main, 'p', 'mobile-list-title font-medium', model.title);
  if (Array.isArray(model.pills) && model.pills.length) {
    const pills = documentRef.createElement('div');
    pills.className = 'mobile-list-pills';
    model.pills.forEach((pillText) => {
      appendTextElement(documentRef, pills, 'span', 'mobile-list-pill', pillText);
    });
    main.appendChild(pills);
  }
  appendTextElement(documentRef, main, 'p', 'mobile-list-meta text-xs text-textSecondary', model.meta);
  row.appendChild(main);

  appendTextElement(documentRef, row, 'span', `mobile-list-status text-xs px-2 py-0.5 rounded-full ${model.statusBadge}`, model.status);
  appendTextElement(documentRef, row, 'span', `mobile-list-value font-semibold ${model.color} whitespace-nowrap`, model.value);

  const actions = documentRef.createElement('div');
  actions.className = 'mobile-list-actions flex items-center gap-1';
  appendActionButton(documentRef, actions, {
    action: 'edit',
    className: 'text-textSecondary hover:text-accent p-1',
    icon: 'pencil',
    recordId: model.id,
    title: 'Editar lancamento'
  });
  appendActionButton(documentRef, actions, {
    action: 'toggle-paid',
    className: 'text-textSecondary hover:text-success p-1',
    icon: model.paidIcon,
    recordId: model.id,
    title: model.status === 'Pago' ? 'Reabrir lancamento' : 'Marcar lancamento como pago'
  });
  appendActionButton(documentRef, actions, {
    action: 'toggle-archive',
    className: `text-textSecondary ${model.archiveColor} p-1`,
    icon: model.archiveIcon,
    recordId: model.id,
    title: model.archiveTitle
  });
  appendActionButton(documentRef, actions, {
    action: 'delete',
    className: 'text-textSecondary hover:text-danger p-1',
    deleteAction: true,
    icon: 'trash-2',
    recordId: model.id,
    title: 'Excluir lancamento'
  });
  row.appendChild(actions);

  return row;
}

export function createRecordRowNodes(records = [], options = {}) {
  return records
    .map((record) => createRecordRowElement(record, options))
    .filter(Boolean);
}

export function renderRecordRows(container, records = [], options = {}) {
  if (!container) return [];
  const documentRef = options.document || container.ownerDocument || globalThis.document;
  const nodes = createRecordRowNodes(records, { ...options, document: documentRef });
  container.replaceChildren(...nodes);
  return nodes;
}

export function renderRecordRowsProgressively(container, records = [], options = {}) {
  if (!container) return 0;
  const target = options.target || globalThis;
  const documentRef = options.document || container.ownerDocument || target.document;
  const initialCount = Math.max(0, Number(options.initialCount ?? 20) || 20);
  const chunkSize = Math.max(1, Number(options.chunkSize ?? 40) || 40);
  const total = Array.isArray(records) ? records.length : 0;
  const jobId = (progressiveRenderJobs.get(container) || 0) + 1;
  progressiveRenderJobs.set(container, jobId);

  const buildNodes = (startIndex, endIndex) => createRecordRowNodes(
    records.slice(startIndex, endIndex),
    { ...options, document: documentRef, target }
  );

  const initialEnd = Math.min(initialCount, total);
  container.replaceChildren(...buildNodes(0, initialEnd));
  options.onProgress?.({ rendered: initialEnd, total, done: initialEnd >= total });

  function appendChunk(startIndex) {
    if (progressiveRenderJobs.get(container) !== jobId) return;
    if (startIndex >= total) {
      options.onComplete?.({ total });
      return;
    }

    const endIndex = Math.min(startIndex + chunkSize, total);
    const fragment = documentRef.createDocumentFragment();
    buildNodes(startIndex, endIndex).forEach((node) => fragment.appendChild(node));
    container.appendChild(fragment);
    options.onProgress?.({ rendered: endIndex, total, done: endIndex >= total });

    if (endIndex < total) {
      scheduleProgressiveChunk(() => appendChunk(endIndex), target);
      return;
    }

    options.onComplete?.({ total });
  }

  if (initialEnd < total) {
    scheduleProgressiveChunk(() => appendChunk(initialEnd), target);
  } else {
    options.onComplete?.({ total });
  }

  return jobId;
}

export function installRecordListRendererGlobals(target = globalThis) {
  target.financeRecordListRenderer = {
    buildRecordRowViewModel,
    createRecordRowElement: (record, options = {}) => createRecordRowElement(record, { target, ...options }),
    createRecordRowNodes: (records, options = {}) => createRecordRowNodes(records, { target, ...options }),
    renderRecordRows,
    renderRecordRowsProgressively: (container, records = [], options = {}) => renderRecordRowsProgressively(container, records, { target, ...options })
  };
  return target.financeRecordListRenderer;
}
