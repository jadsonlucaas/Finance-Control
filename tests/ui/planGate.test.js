import { describe, expect, it } from 'vitest';
import { gateDecision, PREMIUM_ACTIONS, PREMIUM_TABS, resolvePlan } from '../../src/ui/billing/planGate.js';

describe('plano Gratuito x Premium', () => {
  it('Premium = assinatura valendo, cortesia ou admin', () => {
    expect(resolvePlan({ subscription: { status: 'trialing' } }).plan).toBe('premium');
    expect(resolvePlan({ subscription: { status: 'past_due' } }).plan).toBe('premium');
    expect(resolvePlan({ comp: { status: 'active' } })).toEqual({ plan: 'premium', source: 'comp' });
    expect(resolvePlan({ isAdmin: true })).toEqual({ plan: 'premium', source: 'admin' });
    expect(resolvePlan({ subscription: { status: 'canceled' } }).plan).toBe('free');
    expect(resolvePlan({ subscription: { status: 'incomplete' } }).plan).toBe('free');
    expect(resolvePlan({}).plan).toBe('free');
  });

  it('Gratuito so lanca entradas/saidas e ve o dashboard', () => {
    ['dashboard', 'saidas', 'entradas', 'configuracoes'].forEach((tab) => {
      expect(gateDecision({ plan: 'free', tab }).allowed).toBe(true);
    });
    Object.keys(PREMIUM_TABS).forEach((tab) => {
      expect(gateDecision({ plan: 'free', tab })).toEqual({ allowed: false, reason: PREMIUM_TABS[tab] });
      expect(gateDecision({ plan: 'premium', tab }).allowed).toBe(true);
    });
    Object.keys(PREMIUM_ACTIONS).forEach((actionId) => {
      expect(gateDecision({ plan: 'free', actionId }).allowed).toBe(false);
    });
    expect(gateDecision({ plan: 'free', actionId: 'btn-new-record-header' }).allowed).toBe(true);
  });

  it('sem saber o plano ainda nao bloqueia', () => {
    expect(gateDecision({ plan: 'unknown', tab: 'importacao' }).allowed).toBe(true);
  });
});
