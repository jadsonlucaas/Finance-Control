// Chave Saídas | Entradas no topo de Lançamentos.
export function installLedgerSwitch(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.__financeLedgerSwitchInstalled) return;
  target.__financeLedgerSwitchInstalled = true;
  documentRef.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-ledger-tab]');
    if (!button) return;
    const tab = button.dataset.ledgerTab;
    if (tab && typeof target.switchTab === 'function') target.switchTab(tab);
  });
}
