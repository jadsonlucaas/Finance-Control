// "Primeiros passos" no Início: três passos que se marcam sozinhos.
// 1. Registrar o primeiro lançamento (qualquer saída ou entrada).
// 2. Escolher o plano (Premium ativo, ou escolheu na janela de planos).
// 3. Vincular o WhatsApp (status do vínculo em Configurações).
// Some quando os três estão feitos ou quando a pessoa clica em "Ocultar".
// O estado fica em localStorage com o prefixo finance-control-, que o app
// sincroniza com a nuvem (users/{uid}/local_storage).

export const GETTING_STARTED_KEY = 'finance-control-getting-started-v1';
const CARD_ID = 'getting-started-card';

export function readGettingStarted(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return { dismissed: Boolean(value?.dismissed), planSeen: Boolean(value?.planSeen) };
  } catch {
    return { dismissed: false, planSeen: false };
  }
}

export function hasFinanceRecord(records = []) {
  return (Array.isArray(records) ? records : []).some((record) => record?.type === 'saida' || record?.type === 'entrada');
}

/** state: { records, plan: 'free'|'premium'|'unknown', planSeen, whatsappLinked } */
export function buildGettingStartedSteps(state = {}) {
  return [
    {
      key: 'record',
      done: hasFinanceRecord(state.records),
      title: 'Registre seu primeiro lançamento',
      text: 'Um gasto ou uma entrada. O Início passa a mostrar seu saldo do mês.',
      action: 'Novo lançamento'
    },
    {
      key: 'plan',
      done: state.plan === 'premium' || Boolean(state.planSeen),
      title: 'Escolha seu plano',
      text: 'O Gratuito cobre lançamentos e o Início. O Premium libera o assistente no WhatsApp, alertas e parcelamentos.',
      action: 'Ver planos'
    },
    {
      key: 'whatsapp',
      done: Boolean(state.whatsappLinked),
      title: 'Vincule seu WhatsApp',
      text: 'Mande "gastei 20 no almoço" e o assistente registra para você.',
      action: 'Vincular WhatsApp'
    }
  ];
}

export function shouldShowGettingStarted(steps, stored) {
  if (stored?.dismissed) return false;
  return steps.some((step) => !step.done);
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

export function renderGettingStarted(steps) {
  const done = steps.filter((step) => step.done).length;
  const items = steps.map((step, index) => `
      <li class="getting-started-step${step.done ? ' is-done' : ''}" data-step="${step.key}">
        <span class="getting-started-mark" aria-hidden="true">${step.done ? CHECK : index + 1}</span>
        <div class="getting-started-copy">
          <p class="getting-started-title">${escapeHtml(step.title)}${step.done ? '<span class="sr-only"> (feito)</span>' : ''}</p>
          <p class="getting-started-text">${escapeHtml(step.text)}</p>
        </div>
        ${step.done ? '' : `<button type="button" class="getting-started-action" data-getting-started="${step.key}">${escapeHtml(step.action)}</button>`}
      </li>`).join('');
  return `
    <div class="getting-started-head">
      <div>
        <h2 class="getting-started-heading">Primeiros passos</h2>
        <p class="getting-started-progress">${done} de ${steps.length} concluídos</p>
      </div>
      <button type="button" class="getting-started-dismiss" data-getting-started="dismiss">Ocultar</button>
    </div>
    <div class="getting-started-bar" aria-hidden="true"><span style="width:${Math.round((done / steps.length) * 100)}%"></span></div>
    <ol class="getting-started-list">${items}</ol>`;
}

export function installGettingStarted(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.financeApp?.gettingStarted) return target?.financeApp?.gettingStarted || null;
  let scheduled = false;

  function readStored() {
    try {
      return readGettingStarted(target.localStorage?.getItem(GETTING_STARTED_KEY));
    } catch {
      return readGettingStarted('');
    }
  }

  function writeStored(patch) {
    const next = { ...readStored(), ...patch };
    try {
      target.localStorage?.setItem(GETTING_STARTED_KEY, JSON.stringify(next));
    } catch {
      // Sem armazenamento (aba privada): vale até recarregar.
    }
    render();
  }

  // Status do vínculo: o painel de Configurações (quando já abriu) ou uma leitura
  // única por conta (o painel só carrega quando a pessoa abre Configurações).
  const linkStatus = { uid: '', linked: false, loading: false };
  function whatsappLinked() {
    const view = target.financeApp?.whatsappLinkActiveUi?.controller?.getState?.()?.view;
    if (view === 'linked') return true;
    if (view === 'unlinked') return false;
    const uid = target.authSdk?.getCurrentUser?.()?.uid || '';
    const service = target.whatsappLinkSdk;
    if (uid && service?.getStatus && linkStatus.uid !== uid && !linkStatus.loading) {
      linkStatus.loading = true;
      service.getStatus(uid)
        .then((status) => Object.assign(linkStatus, { uid, linked: Boolean(status?.linked) }))
        .catch(() => Object.assign(linkStatus, { uid, linked: false }))
        .finally(() => {
          linkStatus.loading = false;
          schedule();
        });
    }
    return linkStatus.uid === uid && linkStatus.linked;
  }

  function linkResolved() {
    const view = target.financeApp?.whatsappLinkActiveUi?.controller?.getState?.()?.view;
    if (view === 'linked' || view === 'unlinked') return true;
    const uid = target.authSdk?.getCurrentUser?.()?.uid || '';
    return Boolean(uid) && linkStatus.uid === uid && !linkStatus.loading;
  }

  function render() {
    const view = documentRef.getElementById('view-dashboard');
    if (!view) return;
    let card = documentRef.getElementById(CARD_ID);
    const stored = readStored();
    const plan = target.financeApp?.planGate?.getPlan?.() || 'unknown';
    const linked = whatsappLinked();
    // Só decide com tudo em mãos (login, primeira leitura, plano e vínculo):
    // assim quem já fez tudo não vê o cartão piscar na abertura.
    const ready = Boolean(target.authSdk?.getCurrentUser?.())
      && target.__financeFirstDataReceived === true
      && plan !== 'unknown'
      && linkResolved();
    const steps = buildGettingStartedSteps({
      records: target.allRecords,
      plan,
      planSeen: stored.planSeen,
      whatsappLinked: linked
    });
    const show = ready && shouldShowGettingStarted(steps, stored);
    if (!show) {
      card?.remove();
      return;
    }
    if (!card) {
      card = documentRef.createElement('section');
      card.id = CARD_ID;
      card.className = 'getting-started';
      card.setAttribute('aria-labelledby', 'getting-started-heading');
      view.prepend(card);
    }
    card.innerHTML = renderGettingStarted(steps);
    card.querySelector('.getting-started-heading')?.setAttribute('id', 'getting-started-heading');
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      render();
    });
  }

  documentRef.addEventListener('click', (event) => {
    const planChoice = event.target?.closest?.('[data-plan-action="free"], [data-plan-action="premium"]');
    if (planChoice) writeStored({ planSeen: true });
    const button = event.target?.closest?.('[data-getting-started]');
    if (!button) return;
    const step = button.dataset.gettingStarted;
    if (step === 'dismiss') writeStored({ dismissed: true });
    if (step === 'record') documentRef.getElementById('btn-new-record-header')?.click();
    if (step === 'plan') {
      writeStored({ planSeen: true });
      target.financeApp?.planChooser?.open?.();
    }
    if (step === 'whatsapp') {
      target.switchTab?.('configuracoes');
      documentRef.getElementById('whatsapp-link-panel')?.scrollIntoView?.({ block: 'center' });
    }
  });

  ['financeRecordsChanged', 'financeAccessActive', 'financePlanChanged', 'authStateChanged', 'cloudLocalStorageApplied', 'cloudLocalStorageChanged']
    .forEach((name) => target.addEventListener?.(name, schedule));
  // O vínculo do WhatsApp e o plano chegam depois: o painel do WhatsApp redesenha quando muda.
  const panel = documentRef.getElementById('whatsapp-link-panel');
  if (panel && typeof target.MutationObserver === 'function') {
    new target.MutationObserver(schedule).observe(panel, { childList: true, subtree: true });
  }
  render();

  const api = { render, dismiss: () => writeStored({ dismissed: true }) };
  target.financeApp = target.financeApp || {};
  target.financeApp.gettingStarted = api;
  return api;
}
