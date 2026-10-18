import { authTemplate } from './authTemplate.js';
import { viewDashboardTemplate } from './views/viewDashboardTemplate.js';
import { viewMesDetalheTemplate } from './views/viewMesDetalheTemplate.js';
import { viewSaidasTemplate } from './views/viewSaidasTemplate.js';
import { viewEntradasTemplate } from './views/viewEntradasTemplate.js';
import { viewImportacaoTemplate } from './views/viewImportacaoTemplate.js';
import { viewControleHorasTemplate } from './views/viewControleHorasTemplate.js';
import { viewCategoriasTemplate } from './views/viewCategoriasTemplate.js';
import { viewNovoTemplate } from './views/viewNovoTemplate.js';
import { viewConfiguracoesTemplate } from './views/viewConfiguracoesTemplate.js';
import { viewParcelamentosTemplate } from './views/viewParcelamentosTemplate.js';

export function installInitialTemplates(target = document) {
  const authRoot = target.getElementById('auth-root');
  if (authRoot && !target.getElementById('auth-screen')) {
    authRoot.innerHTML = authTemplate();
  }

  const mainContent = target.getElementById('main-content');
  if (mainContent && mainContent.children.length === 0) {
    mainContent.innerHTML =
      viewDashboardTemplate() +
      viewMesDetalheTemplate() +
      viewSaidasTemplate() +
      viewEntradasTemplate() +
      viewImportacaoTemplate() +
      viewControleHorasTemplate() +
      viewCategoriasTemplate() +
      viewNovoTemplate() +
      viewConfiguracoesTemplate() +
      viewParcelamentosTemplate();
  }
}
