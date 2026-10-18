const STATUS_LABELS = Object.freeze({
  ready: 'Prontas',
  invalid: 'Invalidas',
  duplicates: 'Duplicadas',
  conflicts: 'Conflitos',
  ignored: 'Ignoradas'
});

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(value = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function byId(root, id) {
  return root?.getElementById?.(id) || null;
}

function renderRows(rows = []) {
  if (!rows.length) {
    return '<tr><td colspan="7" class="px-3 py-6 text-center text-textSecondary">Nenhum item nesta secao.</td></tr>';
  }
  return rows.map((row) => `
    <tr class="border-t border-surfaceLight">
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(row.sourceRowReference || row.rowIndex || '-')}</td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(row.status)}</td>
      <td class="px-3 py-2">${escapeHtml(row.person || '-')}</td>
      <td class="px-3 py-2">
        <div class="font-medium text-textPrimary">${escapeHtml(row.description || '-')}</div>
        <div class="text-xs text-textSecondary">${escapeHtml(row.sourceReferenceId || '')}</div>
      </td>
      <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(row.competence || '-')}</td>
      <td class="px-3 py-2 text-right font-semibold">${escapeHtml(money(row.amount))}</td>
      <td class="px-3 py-2 text-xs text-textSecondary">${escapeHtml(row.reason || '-')}</td>
    </tr>
  `).join('');
}

export function createImportPresenter({ documentRef = document, target = globalThis } = {}) {
  let currentTab = 'ready';

  function container() {
    return byId(documentRef, 'modern-import-panel');
  }

  function renderShell() {
    const root = container();
    if (!root) return;
    root.innerHTML = `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4 mb-4" data-import-modern-root>
        <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 class="text-sm font-semibold text-textPrimary">Importacao XLSX moderna</h3>
            <p class="text-xs text-textSecondary mt-1">Preview e commit passam pelo pipeline idempotente canonico.</p>
          </div>
          <span id="modern-import-state" class="text-xs px-2.5 py-1 rounded-full bg-surface text-textSecondary">Aguardando arquivo</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 mb-4">
          <div>
            <label for="modern-import-kind" class="text-xs text-textSecondary mb-1 block">Tipo XLSX</label>
            <select id="modern-import-kind" class="w-full text-sm">
              <option value="expenses">Saidas</option>
              <option value="incomes">Entradas</option>
            </select>
          </div>
          <div>
            <label for="modern-import-file" class="text-xs text-textSecondary mb-1 block">Arquivo XLSX</label>
            <input id="modern-import-file" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" class="w-full text-sm">
          </div>
          <div class="flex items-end">
            <button id="modern-import-preview" type="button" class="w-full bg-accent hover:bg-accentDark text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">Gerar preview XLSX</button>
          </div>
          <div class="flex items-end">
            <button id="modern-import-commit" type="button" class="w-full bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-2 rounded-lg transition-colors" disabled>Confirmar importacao</button>
          </div>
        </div>
        <div id="modern-import-file-meta" class="text-xs text-textSecondary mb-4">Nenhum arquivo selecionado.</div>
        <div id="modern-import-error" class="hidden rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm px-3 py-2 mb-4"></div>
        <div id="modern-import-summary" class="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-4"></div>
        <div id="modern-import-tabs" class="flex gap-2 flex-wrap mb-3"></div>
        <div class="overflow-auto rounded-xl border border-surfaceLight">
          <table class="w-full min-w-[980px] text-sm">
            <thead class="bg-surfaceLight/70 text-textSecondary">
              <tr>
                <th class="text-left px-3 py-2 font-medium">Linha</th>
                <th class="text-left px-3 py-2 font-medium">Status</th>
                <th class="text-left px-3 py-2 font-medium">Pessoa</th>
                <th class="text-left px-3 py-2 font-medium">Descricao</th>
                <th class="text-left px-3 py-2 font-medium">Competencia</th>
                <th class="text-right px-3 py-2 font-medium">Valor</th>
                <th class="text-left px-3 py-2 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody id="modern-import-rows">
              <tr><td colspan="7" class="px-3 py-6 text-center text-textSecondary">Selecione uma planilha sintetica ou exportacao autorizada para gerar o preview.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setBusy(isBusy) {
    ['modern-import-preview', 'modern-import-commit'].forEach((id) => {
      const button = byId(documentRef, id);
      if (button) button.disabled = isBusy || (id === 'modern-import-commit' && button.dataset.hasReady !== 'true');
    });
  }

  function renderError(error = null) {
    const box = byId(documentRef, 'modern-import-error');
    if (!box) return;
    if (!error) {
      box.classList.add('hidden');
      box.textContent = '';
      return;
    }
    box.classList.remove('hidden');
    box.textContent = error.userMessage || error.message || 'Nao foi possivel concluir a importacao.';
  }

  function renderPreview(viewModel = null, viewState = {}) {
    const state = byId(documentRef, 'modern-import-state');
    const fileMeta = byId(documentRef, 'modern-import-file-meta');
    const summary = byId(documentRef, 'modern-import-summary');
    const tabs = byId(documentRef, 'modern-import-tabs');
    const rows = byId(documentRef, 'modern-import-rows');
    const commitButton = byId(documentRef, 'modern-import-commit');
    if (state) state.textContent = viewState.status === 'stale' ? 'Preview preservado' : viewState.status || 'ready';
    renderError(viewState.error || null);
    if (!viewModel) {
      if (summary) summary.innerHTML = '';
      if (tabs) tabs.innerHTML = '';
      if (rows) rows.innerHTML = '<tr><td colspan="7" class="px-3 py-6 text-center text-textSecondary">Nenhum preview carregado.</td></tr>';
      if (commitButton) {
        commitButton.dataset.hasReady = 'false';
        commitButton.disabled = true;
      }
      return;
    }
    if (fileMeta) {
      fileMeta.textContent = `${viewModel.metadata.fileName || 'Arquivo'} - ${viewModel.metadata.sheetName || 'aba nao informada'} - lote ${viewModel.metadata.batchId || '-'}`;
    }
    const cards = [
      ['Total', viewModel.summary.totalRows],
      ['Prontas', viewModel.summary.readyRows],
      ['Invalidas', viewModel.summary.invalidRows],
      ['Duplicadas', viewModel.summary.duplicateRows],
      ['Conflitos', viewModel.summary.conflictRows],
      ['Ignoradas', viewModel.summary.ignoredRows]
    ];
    if (summary) {
      summary.innerHTML = cards.map(([label, value]) => `
        <div class="rounded-lg border border-surfaceLight bg-surface/40 px-3 py-2">
          <p class="text-xs uppercase tracking-[0.12em] text-textSecondary">${escapeHtml(label)}</p>
          <p class="text-xl font-bold text-textPrimary mt-1">${escapeHtml(value)}</p>
        </div>
      `).join('');
    }
    const groups = ['ready', 'invalid', 'duplicates', 'conflicts', 'ignored'];
    if (!groups.includes(currentTab)) currentTab = 'ready';
    if (tabs) {
      tabs.innerHTML = groups.map((group) => `
        <button type="button" data-modern-import-tab="${group}" class="text-xs px-3 py-2 rounded-lg ${currentTab === group ? 'bg-accent text-white' : 'bg-surfaceLight text-textSecondary'}">
          ${escapeHtml(STATUS_LABELS[group])} (${viewModel[group].length})
        </button>
      `).join('');
    }
    if (rows) rows.innerHTML = renderRows(viewModel[currentTab] || []);
    if (commitButton) {
      commitButton.dataset.hasReady = viewModel.ready.length ? 'true' : 'false';
      commitButton.disabled = !viewModel.ready.length || viewState.status === 'loading';
    }
    target.lucide?.createIcons?.();
  }

  function setTab(tab, viewModel, viewState) {
    currentTab = tab || 'ready';
    renderPreview(viewModel, viewState);
  }

  function renderCommitResult(result = {}) {
    const state = byId(documentRef, 'modern-import-state');
    if (state) state.textContent = result.uncertain ? 'Resultado incerto' : result.replay ? 'Replay confirmado' : 'Importacao confirmada';
  }

  return {
    renderShell,
    renderPreview,
    renderCommitResult,
    renderError,
    setBusy,
    setTab
  };
}
