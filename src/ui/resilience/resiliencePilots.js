import { createViewStatePilot } from '../../application/resilience/asyncViewState.js';

export function createResilienceViewPilots() {
  return {
    dashboard: createViewStatePilot('dashboard'),
    importacao: createViewStatePilot('importacao'),
    audit: createViewStatePilot('audit')
  };
}

export function renderAsyncStateLabel(state = {}) {
  const labels = {
    idle: '',
    loading: 'Carregando...',
    success: '',
    empty: 'Nenhum registro encontrado.',
    error: state.error?.userMessage || 'Nao foi possivel concluir a operacao.',
    stale: state.error?.userMessage || 'Dados exibidos podem estar desatualizados.',
    offline: 'Voce esta offline. Os dados nao foram salvos.'
  };
  return labels[state.status] || '';
}
