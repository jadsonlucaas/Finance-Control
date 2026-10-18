const THEME_STORAGE_KEY = 'finance-control-theme-v1';

let currentTheme = readStoredTheme();

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function getCurrentTheme() {
  return currentTheme;
}

export function getThemeChartColor(variableName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value || fallback;
}

export function getThemeTextSecondaryColor() {
  return getThemeChartColor('--theme-text-secondary', '#64748b');
}

export function getThemeSurfaceStrokeColor() {
  return currentTheme === 'dark'
    ? 'rgba(15, 23, 42, 0.9)'
    : 'rgba(255, 255, 255, 0.95)';
}

export function updateThemeToggleButton() {
  const label = document.getElementById('theme-toggle-label');
  const button = document.getElementById('theme-toggle');
  if (!label || !button) return;

  const isDark = currentTheme === 'dark';
  label.textContent = isDark ? 'Modo claro' : 'Modo escuro';
  button.title = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
  button.innerHTML = `
    <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
    <span class="mobile-action-label" id="theme-toggle-label">${isDark ? 'Modo claro' : 'Modo escuro'}</span>
  `;
}

export function applyTheme(theme, options = {}) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = currentTheme;
  document.body.classList.toggle('dark-theme', currentTheme === 'dark');

  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  updateThemeToggleButton();
  window.lucide?.createIcons?.();

  if (options.rerender !== false) {
    window.renderCurrentTab?.();
  }
}

export function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

export function installThemeGlobals(target = window) {
  Object.defineProperty(target, 'currentTheme', {
    configurable: true,
    get: () => currentTheme,
    set: (value) => {
      currentTheme = value === 'dark' ? 'dark' : 'light';
    }
  });

  Object.assign(target, {
    applyTheme,
    getCurrentTheme,
    getThemeChartColor,
    getThemeTextSecondaryColor,
    getThemeSurfaceStrokeColor,
    toggleTheme,
    updateThemeToggleButton
  });
}
