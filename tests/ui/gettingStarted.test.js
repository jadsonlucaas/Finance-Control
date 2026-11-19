import { describe, expect, it } from 'vitest';
import {
  buildGettingStartedSteps,
  readGettingStarted,
  renderGettingStarted,
  shouldShowGettingStarted
} from '../../src/ui/dashboard/gettingStarted.js';

describe('primeiros passos', () => {
  it('conta nova tem os três passos em aberto', () => {
    const steps = buildGettingStartedSteps({ records: [], plan: 'free' });
    expect(steps.map((step) => [step.key, step.done])).toEqual([['record', false], ['plan', false], ['whatsapp', false]]);
    expect(shouldShowGettingStarted(steps, {})).toBe(true);
  });

  it('marca sozinho: lançamento, plano Premium ou escolhido e WhatsApp vinculado', () => {
    const steps = buildGettingStartedSteps({ records: [{ type: 'saida' }], plan: 'premium', whatsappLinked: true });
    expect(steps.every((step) => step.done)).toBe(true);
    expect(shouldShowGettingStarted(steps, {})).toBe(false);
    expect(buildGettingStartedSteps({ plan: 'free', planSeen: true })[1].done).toBe(true);
    expect(buildGettingStartedSteps({ records: [{ type: 'controle_horas' }] })[0].done).toBe(false);
  });

  it('Ocultar esconde mesmo com passos em aberto', () => {
    const steps = buildGettingStartedSteps({ records: [], plan: 'free' });
    expect(shouldShowGettingStarted(steps, { dismissed: true })).toBe(false);
  });

  it('lê o estado salvo com tolerância', () => {
    expect(readGettingStarted('{"dismissed":true}')).toEqual({ dismissed: true, planSeen: false });
    expect(readGettingStarted('quebrado')).toEqual({ dismissed: false, planSeen: false });
  });

  it('mostra progresso e só oferece ação nos passos em aberto', () => {
    const html = renderGettingStarted(buildGettingStartedSteps({ records: [{ type: 'entrada' }], plan: 'free' }));
    expect(html).toContain('1 de 3 concluídos');
    expect(html).not.toContain('data-getting-started="record"');
    expect(html).toContain('data-getting-started="plan"');
    expect(html).toContain('data-getting-started="whatsapp"');
  });
});
