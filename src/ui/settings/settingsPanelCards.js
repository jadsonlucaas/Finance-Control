// Configurações em cartões: cada parametrização aparece como um cartão
// compacto (título + descrição) e, ao clicar, abre numa janela com o conteúdo
// completo para incluir, alterar ou excluir.
//
// O painel original continua sendo o mesmo elemento (mesmos ids e eventos):
// ao abrir, ele é movido para dentro da janela; ao fechar, volta para o lugar.
// Assim nenhuma regra de cadastro muda, só a apresentação.

const PANEL_SELECTOR = '#view-configuracoes .space-y-6 > .bg-surface';
const MODAL_ID = 'settings-panel-modal';

const PANELS = [
  { key: 'usuarios', match: 'usuários do sistema', fallback: 'Papel e status de acesso de cada usuário.' },
  { key: 'inss-irrf', match: 'parâmetros inss e irrf', fallback: 'Faixas e alíquotas usadas nos cálculos.' },
  { key: 'pessoas', match: 'pessoas', fallback: 'Quem recebe e o salário base de cada um.' },
  { key: 'categorias-macro', match: 'categorias macro', fallback: 'Grupos que organizam as categorias.' },
  { key: 'categorias', match: 'categorias personalizadas', fallback: 'Categorias usadas nos lançamentos.' },
  { key: 'tipos-he', match: 'tipos de h.e.', fallback: 'Tipos de hora extra disponíveis no lançamento.' },
  { key: 'fontes-renda', match: 'outras fontes de renda', fallback: 'Opções do campo Tipo de Entrada.' },
  { key: 'regras-percentuais', match: 'regras fixas percentuais', fallback: 'Saídas calculadas sobre as entradas.' }
];

function normalize(text = '') {
  return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

function panelTitleElement(panel) {
  return panel?.querySelector?.('h3') || null;
}

export function matchSettingsPanel(panel) {
  const title = normalize(panelTitleElement(panel)?.textContent || '');
  if (!title) return null;
  return PANELS.find((item) => title.includes(item.match)) || null;
}

function panelSubtitle(panel, config) {
  const title = panelTitleElement(panel);
  const candidate = title?.parentElement?.querySelector?.(':scope > p');
  const text = candidate?.textContent?.replace(/\s+/g, ' ').trim();
  return text || config.fallback;
}

export function createSettingsPanelCards(target = globalThis) {
  const documentRef = target?.document;
  let openPanel = null;
  let openKey = null;
  let placeholder = null;
  let lastFocus = null;
  let observer = null;
  let scheduled = false;

  function translate(text) {
    return target?.financeI18n?.translate?.(text) || target?.translate?.(text) || text;
  }

  function buildSummary(panel, config) {
    const title = panelTitleElement(panel)?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const summary = documentRef.createElement('button');
    summary.type = 'button';
    summary.className = 'settings-card-summary';
    summary.dataset.settingsCardSummary = config.key;
    summary.setAttribute('aria-haspopup', 'dialog');
    const text = documentRef.createElement('span');
    text.className = 'settings-card-text';
    const strong = documentRef.createElement('span');
    strong.className = 'settings-card-title';
    strong.textContent = title;
    const small = documentRef.createElement('span');
    small.className = 'settings-card-desc';
    small.textContent = panelSubtitle(panel, config);
    text.append(strong, small);
    const chevron = documentRef.createElement('span');
    chevron.className = 'settings-card-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    summary.append(text, chevron);
    summary.setAttribute('aria-label', `${translate('Abrir')} ${title}`);
    return summary;
  }

  function ensureModal() {
    let modal = documentRef.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = documentRef.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'settings-panel-modal hidden';
    modal.innerHTML = [
      '<div class="settings-panel-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-panel-modal-title" aria-describedby="settings-panel-modal-desc">',
      '  <div class="settings-panel-dialog-head">',
      '    <div class="settings-panel-dialog-heading">',
      '      <h2 id="settings-panel-modal-title" class="font-semibold"></h2>',
      '      <p id="settings-panel-modal-desc"></p>',
      '    </div>',
      '    <button type="button" data-close-modal class="settings-panel-close" aria-label="Fechar">',
      '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      '    </button>',
      '  </div>',
      '  <div class="settings-panel-dialog-body"></div>',
      '</div>'
    ].join('');
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.querySelector('[data-close-modal]').addEventListener('click', () => close());
    const view = documentRef.getElementById('view-configuracoes') || documentRef.body;
    view.appendChild(modal);
    return modal;
  }

  function enhance(panel) {
    const config = matchSettingsPanel(panel);
    if (!config) return;
    panel.dataset.settingsCard = config.key;
    if (panel === openPanel) return;
    const existing = panel.querySelector(':scope > .settings-card-summary');
    if (existing) {
      // O painel pode ter trocado o subtítulo; mantém o cartão em dia.
      const desc = existing.querySelector('.settings-card-desc');
      const nextDesc = panelSubtitle(panel, config);
      if (desc && desc.textContent !== nextDesc) desc.textContent = nextDesc;
      return;
    }
    const summary = buildSummary(panel, config);
    summary.addEventListener('click', () => open(panel));
    panel.prepend(summary);
  }

  function adoptRecreatedPanel() {
    // Alguns painéis (INSS) são recriados ao salvar. Se o painel aberto foi
    // substituído, o novo vai para dentro da janela no lugar do antigo.
    if (!openKey || (openPanel && openPanel.isConnected)) return;
    const replacement = [...documentRef.querySelectorAll(PANEL_SELECTOR)]
      .find((panel) => matchSettingsPanel(panel)?.key === openKey);
    const modal = documentRef.getElementById(MODAL_ID);
    if (!replacement || !modal) return;
    replacement.querySelector(':scope > .settings-card-summary')?.remove();
    openPanel = replacement;
    openPanel.dataset.settingsOpen = 'true';
    modal.querySelector('.settings-panel-dialog-body').appendChild(openPanel);
  }

  function apply() {
    if (!documentRef) return;
    documentRef.querySelectorAll(PANEL_SELECTOR).forEach(enhance);
    adoptRecreatedPanel();
    watch();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  }

  function watch() {
    if (observer || typeof target.MutationObserver !== 'function') return;
    const wrap = documentRef.querySelector('#view-configuracoes .space-y-6');
    if (!wrap) return;
    observer = new target.MutationObserver((mutations) => {
      // Só interessa quando painéis entram ou têm o conteúdo reescrito.
      const relevant = mutations.some((mutation) => mutation.target === wrap
        || (mutation.target.parentElement === wrap && mutation.target.dataset?.settingsCard));
      if (relevant) schedule();
    });
    observer.observe(wrap, { childList: true, subtree: true });
  }

  function open(panel) {
    if (!panel || panel === openPanel) return;
    if (openPanel) close({ restoreFocus: false });
    const modal = ensureModal();
    const summary = panel.querySelector(':scope > .settings-card-summary');
    lastFocus = summary || documentRef.activeElement;
    placeholder = documentRef.createElement('div');
    placeholder.className = `${panel.className} settings-card-placeholder`.replace(/\bhidden\b/g, '').trim();
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.dataset.settingsCard = panel.dataset.settingsCard;
    if (summary) placeholder.appendChild(summary.cloneNode(true));
    panel.replaceWith(placeholder);
    summary?.remove();
    openPanel = panel;
    openKey = panel.dataset.settingsCard;
    panel.dataset.settingsOpen = 'true';
    modal.querySelector('#settings-panel-modal-title').textContent = panelTitleElement(panel)?.textContent?.replace(/\s+/g, ' ').trim() || '';
    modal.querySelector('#settings-panel-modal-desc').textContent = summary?.querySelector('.settings-card-desc')?.textContent || '';
    modal.querySelector('.settings-panel-dialog-body').appendChild(panel);
    modal.querySelector('.settings-panel-dialog-body').scrollTop = 0;
    modal.classList.remove('hidden');
    documentRef.documentElement.classList.add('settings-panel-modal-open');
    target.lucide?.createIcons?.();
    modal.querySelector('[data-close-modal]')?.focus?.({ preventScroll: true });
  }

  function close({ restoreFocus = true } = {}) {
    const modal = documentRef.getElementById(MODAL_ID);
    const panel = openPanel;
    openPanel = null;
    openKey = null;
    if (panel) {
      delete panel.dataset.settingsOpen;
      if (placeholder?.isConnected) placeholder.replaceWith(panel);
      else if (panel.isConnected && panel.closest(`#${MODAL_ID}`)) {
        documentRef.querySelector('#view-configuracoes .space-y-6')?.appendChild(panel);
      }
    } else {
      placeholder?.remove();
    }
    placeholder = null;
    modal?.classList.add('hidden');
    documentRef.documentElement.classList.remove('settings-panel-modal-open');
    apply();
    if (restoreFocus) {
      const summary = panel?.querySelector?.(':scope > .settings-card-summary');
      (summary || lastFocus)?.focus?.({ preventScroll: true });
    }
    lastFocus = null;
  }

  return {
    apply,
    open,
    close,
    get openKey() { return openKey; }
  };
}

export function installSettingsPanelCards(target = globalThis) {
  if (!target?.document) return null;
  const app = target.financeApp || {};
  target.financeApp = app;
  if (app.settingsPanelCards) return app.settingsPanelCards;
  app.settingsPanelCards = createSettingsPanelCards(target);
  return app.settingsPanelCards;
}
