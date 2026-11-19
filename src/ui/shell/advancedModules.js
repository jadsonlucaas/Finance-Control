// "Módulos avançados": controle de horas, hora extra, DSR e parâmetros de
// INSS/IRRF. São funções da folha CLT que a maioria dos clientes não usa, então
// ficam escondidas até a pessoa ligar a chave em Configurações.
//
// Escolha salva em localStorage com o prefixo finance-control-, que o app já
// sincroniza com a nuvem (users/{uid}/local_storage): vale em todos os
// aparelhos sem regra nova no Firestore. Sem escolha salva, a chave liga
// sozinha para quem já tem dados desses módulos, para ninguém "perder" nada.

export const ADVANCED_MODULES_KEY = 'finance-control-advanced-modules-v1';
export const ADVANCED_OFF_CLASS = 'advanced-modules-off';
const ADVANCED_EARNING_TYPES = ['HORA EXTRA', 'DSR', 'INSS', 'IRPF'];
const ADVANCED_TABS = new Set(['controle-horas']);

export function hasAdvancedData(records = []) {
  return (Array.isArray(records) ? records : []).some((record) => {
    if (record?.type === 'controle_horas') return true;
    if (record?.type !== 'entrada') return false;
    const label = String(record?.earning_type || record?.subcategory || '').toUpperCase();
    return ADVANCED_EARNING_TYPES.some((item) => label.startsWith(item));
  });
}

/** stored: 'on' | 'off' | '' (sem escolha). */
export function resolveAdvancedModules(stored, records) {
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  return hasAdvancedData(records);
}

export function isAdvancedTab(tab) {
  return ADVANCED_TABS.has(String(tab || ''));
}

const PANEL_HTML = `
  <div class="settings-toggle-row">
    <div class="settings-card-text">
      <h3 class="settings-card-title" id="advanced-modules-title">Módulos avançados</h3>
      <p class="settings-card-desc" id="advanced-modules-desc">Controle de horas, hora extra, DSR e parâmetros de INSS e IRRF. Para quem acompanha salário CLT.</p>
    </div>
    <label class="settings-switch">
      <input id="advanced-modules-toggle" type="checkbox" role="switch" aria-labelledby="advanced-modules-title" aria-describedby="advanced-modules-desc">
      <span class="settings-switch-track" aria-hidden="true"><span class="settings-switch-thumb"></span></span>
    </label>
  </div>`;

const IMPORT_PANEL_HTML = `
  <button type="button" id="btn-settings-open-import" class="settings-card-summary">
    <span class="settings-card-text">
      <span class="settings-card-title">Importar planilha</span>
      <span class="settings-card-desc">Traga lançamentos de uma planilha do Excel ou CSV.</span>
    </span>
    <span class="settings-card-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
  </button>`;

export function installAdvancedModules(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.financeApp?.advancedModules) return target?.financeApp?.advancedModules || null;

  function readStored() {
    try {
      return target.localStorage?.getItem(ADVANCED_MODULES_KEY) || '';
    } catch {
      return '';
    }
  }

  function records() {
    return Array.isArray(target.allRecords) ? target.allRecords : [];
  }

  function isOn() {
    return resolveAdvancedModules(readStored(), records());
  }

  function ensureSettingsPanels() {
    const wrap = documentRef.querySelector('#view-configuracoes .space-y-6');
    if (!wrap) return;
    // Os dois cartões ficam logo antes de "Histórico" (que é operação, não cadastro).
    const history = documentRef.getElementById('btn-restore-archived-records')?.closest('.space-y-6 > *');
    const place = (panel) => (history && history.parentElement === wrap ? wrap.insertBefore(panel, history) : wrap.append(panel));
    if (!documentRef.getElementById('settings-import-panel')) {
      const panel = documentRef.createElement('div');
      panel.id = 'settings-import-panel';
      panel.className = 'bg-surface rounded-xl border border-surfaceLight settings-extra-panel';
      panel.innerHTML = IMPORT_PANEL_HTML;
      panel.querySelector('button').addEventListener('click', () => target.switchTab?.('importacao'));
      place(panel);
    }
    if (!documentRef.getElementById('settings-advanced-panel')) {
      const panel = documentRef.createElement('div');
      panel.id = 'settings-advanced-panel';
      panel.className = 'bg-surface rounded-xl border border-surfaceLight settings-extra-panel';
      panel.innerHTML = PANEL_HTML;
      panel.querySelector('input').addEventListener('change', (event) => setEnabled(event.target.checked));
      place(panel);
    }
  }

  function apply() {
    const on = isOn();
    documentRef.documentElement.classList.toggle(ADVANCED_OFF_CLASS, !on);
    // Safari não esconde <option> por CSS: usa hidden + disabled.
    documentRef.querySelectorAll('option[data-advanced-module]').forEach((option) => {
      // O valor já escolhido continua visível para editar lançamentos antigos.
      const hide = !on && !option.selected;
      option.hidden = hide;
      option.disabled = hide;
    });
    ensureSettingsPanels();
    const toggle = documentRef.getElementById('advanced-modules-toggle');
    if (toggle) toggle.checked = on;
    // Quem desliga estando na tela de horas volta para o Início.
    if (!on) {
      const hoursView = documentRef.getElementById('view-controle-horas');
      if (hoursView && !hoursView.classList.contains('hidden')) target.switchTab?.('dashboard');
    }
    return on;
  }

  function setEnabled(on) {
    try {
      target.localStorage?.setItem(ADVANCED_MODULES_KEY, on ? 'on' : 'off');
    } catch {
      // Sem armazenamento (aba privada): a escolha não fica salva.
    }
    apply();
  }

  ['financeRecordsChanged', 'cloudLocalStorageApplied', 'cloudLocalStorageChanged', 'authStateChanged']
    .forEach((name) => target.addEventListener?.(name, apply));
  apply();

  const api = { apply, isOn, setEnabled };
  target.financeApp = target.financeApp || {};
  target.financeApp.advancedModules = api;
  return api;
}
