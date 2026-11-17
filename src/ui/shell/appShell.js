/**
 * Casco do app: menu da conta (avatar no topo), barra de navegacao inferior do celular
 * e busca no menu lateral.
 *
 * Nao troca a navegacao existente: os botoes da barra chamam `switchTab` e os botoes do
 * menu da conta sao os mesmos de antes (#theme-toggle, #btn-export-pdf, #btn-logout), so
 * mudaram de lugar. Assim os bloqueios do plano e os eventos antigos continuam valendo.
 */
const LEDGER_TABS = new Set(['saidas', 'entradas']);

export function bottomTabFor(tab) {
  if (LEDGER_TABS.has(tab)) return 'saidas';
  return tab;
}

export function avatarInitial(email) {
  const text = String(email || '').trim();
  if (!text || !text.includes('@')) return '?';
  return text[0].toUpperCase();
}

export function normalizeSearch(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function installAppShell(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.financeApp?.appShell) return target?.financeApp?.appShell || null;
  const byId = (id) => documentRef.getElementById(id);

  const menuButton = byId('btn-account-menu');
  const menu = byId('account-menu');

  function isMenuOpen() {
    return Boolean(menu && !menu.classList.contains('hidden'));
  }

  function setMenuOpen(open, { focus = false } = {}) {
    if (!menu || !menuButton) return;
    menu.classList.toggle('hidden', !open);
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && focus) menu.querySelector('button:not([hidden]):not(.hidden)')?.focus();
  }

  menuButton?.addEventListener('click', () => setMenuOpen(!isMenuOpen(), { focus: true }));
  // Escolher um item fecha o menu (o proprio item continua fazendo o que ja fazia).
  menu?.addEventListener('click', (event) => {
    if (event.target.closest('button')) setMenuOpen(false);
  });
  documentRef.addEventListener('click', (event) => {
    if (!isMenuOpen()) return;
    if (menu.contains(event.target) || menuButton.contains(event.target)) return;
    setMenuOpen(false);
  });
  documentRef.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMenuOpen()) return;
    setMenuOpen(false);
    menuButton.focus();
  });

  // Inicial do e-mail no avatar, acompanhando login e troca de conta.
  function paintAvatar() {
    const avatar = byId('account-avatar');
    if (avatar) avatar.textContent = avatarInitial(byId('current-user-email')?.textContent);
  }
  if (menu && typeof target.MutationObserver === 'function') {
    new target.MutationObserver(paintAvatar).observe(menu, { subtree: true, childList: true, characterData: true });
  }
  paintAvatar();

  const bottomNav = byId('bottom-nav');
  bottomNav?.addEventListener('click', (event) => {
    const item = event.target.closest('button');
    if (!item || !bottomNav.contains(item)) return;
    if (item.id === 'btn-bottom-new-record') {
      byId('btn-new-record-header')?.click();
      return;
    }
    const tab = item.dataset.bottomTab;
    if (tab && typeof target.switchTab === 'function') target.switchTab(tab);
  });

  // Busca do menu lateral: esconde os itens que nao batem com o texto digitado.
  const search = byId('sidebar-search');
  search?.addEventListener('input', () => {
    const term = normalizeSearch(search.value);
    byId('main-tabs')?.querySelectorAll('button[data-tab]').forEach((button) => {
      button.classList.toggle('sidebar-search-miss', Boolean(term) && !normalizeSearch(button.textContent).includes(term));
    });
  });

  const shell = { installed: true, setMenuOpen, isMenuOpen, paintAvatar };
  target.financeApp = target.financeApp || {};
  target.financeApp.appShell = shell;
  return shell;
}
