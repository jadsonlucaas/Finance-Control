// Saídas e Entradas são uma tela só no menu ("Lançamentos"); esta chave troca
// entre as duas. O clique é tratado em src/ui/shell/ledgerSwitch.js.
export function ledgerSwitchTemplate(active = 'saidas') {
  const item = (tab, label) => `<button type="button" class="ledger-switch-item" data-ledger-tab="${tab}" aria-pressed="${tab === active ? 'true' : 'false'}">${label}</button>`;
  return `<div class="ledger-switch" role="group" aria-label="Tipo de lançamento">${item('saidas', 'Saídas')}${item('entradas', 'Entradas')}</div>`;
}
