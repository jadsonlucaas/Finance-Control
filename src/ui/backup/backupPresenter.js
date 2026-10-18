function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function card(label, value) {
  return `<div class="rounded-lg border border-surfaceLight bg-surfaceLight/30 p-3">
    <p class="text-[11px] uppercase tracking-widest text-textSecondary">${escapeHtml(label)}</p>
    <p class="text-lg font-bold text-textPrimary mt-1">${escapeHtml(value)}</p>
  </div>`;
}

function renderCounts(counts = {}) {
  const rows = Object.entries(counts);
  if (!rows.length) return '<p class="text-xs text-textSecondary">Nenhum item no preview.</p>';
  return rows.map(([name, count]) => `
    <div class="flex justify-between gap-3 text-xs border-b border-surfaceLight/60 py-1">
      <span class="text-textSecondary">${escapeHtml(name)}</span>
      <strong>${formatCount(count)}</strong>
    </div>
  `).join('');
}

function renderItems(items = []) {
  if (!items.length) return '<p class="text-xs text-textSecondary py-2">Nenhum item nesta classificacao.</p>';
  return items.slice(0, 12).map((item) => `
    <div class="rounded-lg bg-surfaceLight/40 p-2 text-xs">
      <div class="flex justify-between gap-2">
        <strong>${escapeHtml(item.id || 'sem id')}</strong>
        <span>${escapeHtml(item.collection || '')}</span>
      </div>
      <p class="text-textSecondary mt-1">${escapeHtml(item.description || item.type || item.status || '')}</p>
    </div>
  `).join('');
}

export function createBackupPresenter({ documentRef = document } = {}) {
  const byId = (id) => documentRef.getElementById(id);
  const setHtml = (id, html) => {
    const el = byId(id);
    if (el) el.innerHTML = html;
  };
  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  function renderShell() {
    const root = byId('backup-restore-panel');
    if (!root || root.dataset.backupModernRoot === 'true') return;
    root.dataset.backupModernRoot = 'true';
    root.innerHTML = `
      <div class="bg-surface rounded-xl p-4 border border-surfaceLight" data-backup-modern-root>
        <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 class="font-semibold text-sm">Backup e restore seguro</h3>
            <p class="text-xs text-textSecondary mt-1">Exporte um snapshot local e simule restore sem escrita real.</p>
          </div>
          <button id="btn-backup-preview" type="button" class="bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg">Gerar preview</button>
        </div>
        <div id="backup-state" class="text-xs text-textSecondary mb-3">Nenhum backup gerado.</div>
        <div id="backup-summary" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"></div>
        <div id="backup-counts" class="rounded-lg border border-surfaceLight bg-bg/40 p-3 mb-3"></div>
        <div class="flex gap-2 flex-wrap mb-5">
          <button id="btn-backup-download" type="button" class="bg-success hover:bg-success/80 text-bg text-xs font-semibold px-3 py-1.5 rounded-lg" disabled>Baixar backup JSON</button>
        </div>
        <div class="border-t border-surfaceLight pt-4">
          <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div>
              <h4 class="font-semibold text-sm">Restore dry-run</h4>
              <p class="text-xs text-textSecondary mt-1">Validacao, conflitos e simulacao. Restauracao real exige backend confiavel e nao esta disponivel nesta versao.</p>
            </div>
            <span class="text-[11px] uppercase tracking-widest text-warn">Restore real bloqueado</span>
          </div>
          <input id="backup-restore-file" type="file" accept=".json,application/json" aria-label="Arquivo JSON para restore dry-run" class="w-full text-sm mb-3">
          <div class="flex gap-2 flex-wrap mb-3">
            <button id="btn-backup-validate-restore" type="button" class="bg-surfaceLight hover:bg-surfaceLight/80 text-textPrimary text-xs font-semibold px-3 py-1.5 rounded-lg">Validar arquivo</button>
            <button id="btn-backup-restore-dry-run" type="button" class="bg-accent/10 hover:bg-accent text-accent hover:text-bg text-xs font-semibold px-3 py-1.5 rounded-lg">Simular restore</button>
            <button id="btn-backup-restore-real" type="button" class="bg-surfaceLight text-textSecondary text-xs font-semibold px-3 py-1.5 rounded-lg" disabled>Restaurar agora indisponivel</button>
          </div>
          <div id="restore-state" class="text-xs text-textSecondary mb-3">Nenhum arquivo validado.</div>
          <div id="restore-summary" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"></div>
          <div id="restore-details" class="grid md:grid-cols-2 gap-3"></div>
        </div>
      </div>
    `;
  }

  function renderBackupPreview(model, viewState = {}) {
    renderShell();
    setText('backup-state', viewState.error?.userMessage || (model?.metadata?.backupId ? `Backup ${model.metadata.backupId} pronto para download.` : 'Nenhum backup gerado.'));
    setHtml('backup-summary', model ? [
      card('Versao', model.version || '-'),
      card('Total', formatCount(model.totalRecords)),
      card('Checksum', model.metadata.checksumPreview || '-'),
      card('Owner', model.owner.matchesExpected ? 'Atual' : 'Divergente')
    ].join('') : '');
    setHtml('backup-counts', model ? renderCounts(model.counts) : '');
    const button = byId('btn-backup-download');
    if (button) {
      button.dataset.enabled = model?.metadata?.backupId ? 'true' : 'false';
      button.disabled = !model?.metadata?.backupId;
    }
  }

  function renderRestorePreview(model, viewState = {}) {
    renderShell();
    setText('restore-state', viewState.error?.message || viewState.error?.userMessage || (model?.metadata?.restoreId ? `Dry-run ${model.metadata.restoreId} concluido. Nenhuma escrita executada.` : 'Arquivo validado sem execucao real.'));
    setHtml('restore-summary', model ? [
      card('Criaria', formatCount(model.summary.wouldCreate)),
      card('Conflitos', formatCount(model.summary.conflicts)),
      card('Invalidos', formatCount(model.summary.invalid)),
      card('Ignorados', formatCount(model.summary.wouldIgnore + model.summary.skipped))
    ].join('') : '');
    setHtml('restore-details', model ? `
      <div>
        <h5 class="text-xs font-semibold mb-2">Criaria</h5>
        ${renderItems(model.wouldCreate)}
      </div>
      <div>
        <h5 class="text-xs font-semibold mb-2">Conflitos/invalidos</h5>
        ${renderItems([...model.conflicts, ...model.invalid])}
      </div>
    ` : '');
  }

  return {
    renderShell,
    renderBackupPreview,
    renderRestorePreview,
    setBusy(busy) {
      ['btn-backup-preview', 'btn-backup-download', 'btn-backup-validate-restore', 'btn-backup-restore-dry-run'].forEach((id) => {
        const el = byId(id);
        if (el) el.disabled = busy || (id === 'btn-backup-download' && el.dataset.enabled !== 'true');
      });
    },
    renderError(error, scope = 'backup') {
      setText(scope === 'restore' ? 'restore-state' : 'backup-state', error?.userMessage || error?.message || 'Operacao indisponivel.');
    }
  };
}
