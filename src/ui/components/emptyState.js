// Estado vazio padrão: ícone discreto, título, uma frase do que fazer e,
// quando faz sentido, um botão que dispara uma ação que já existe na tela
// (data-empty-click="<id do botão>"). Estilos em styles/shell.css (.empty-state).

const ICONS = {
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

export function emptyStateHtml({ id = '', icon = 'list', title = '', text = '', actionLabel = '', actionClick = '', hidden = false } = {}) {
  const svg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon] || ICONS.list}</svg>`;
  const action = actionLabel && actionClick
    ? `<button type="button" class="empty-state-action" data-empty-click="${escapeHtml(actionClick)}">${escapeHtml(actionLabel)}</button>`
    : '';
  return `<div${id ? ` id="${escapeHtml(id)}"` : ''} class="empty-state${hidden ? ' hidden' : ''}">`
    + `<span class="empty-state-icon" aria-hidden="true">${svg}</span>`
    + `<p class="empty-state-title">${escapeHtml(title)}</p>`
    + (text ? `<p class="empty-state-text">${escapeHtml(text)}</p>` : '')
    + action
    + '</div>';
}

/** Botões dos estados vazios repassam o clique para o botão de verdade da tela. */
export function installEmptyStateActions(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.__financeEmptyStateActions) return;
  target.__financeEmptyStateActions = true;
  documentRef.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-empty-click]');
    if (!button) return;
    documentRef.getElementById(button.dataset.emptyClick)?.click();
  });
}
