import { describe, expect, it } from 'vitest';
import {
  legalDocumentUrl,
  needsLegalAcceptance,
  normalizeLegalEvents,
  PRIVACY_VERSION,
  resolveLegalConsent,
  TERMS_VERSION
} from '../../src/core/legalConsent.js';

describe('aceite de Termos/Privacidade', () => {
  it('sem registro ou com versao antiga precisa aceitar', () => {
    expect(needsLegalAcceptance(null)).toBe(true);
    expect(needsLegalAcceptance({ terms_version: 'termos-antigo', privacy_version: PRIVACY_VERSION })).toBe(true);
    expect(needsLegalAcceptance({ terms_version: TERMS_VERSION, privacy_version: 'privacidade-antiga' })).toBe(true);
    expect(needsLegalAcceptance({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION })).toBe(false);
  });

  it('normaliza datas do Firestore e campos desconhecidos', () => {
    const consent = resolveLegalConsent({
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_at: { toDate: () => new Date('2026-11-14T12:00:00.000Z') },
      source: 'hack',
      locale: 'fr-FR'
    });
    expect(consent).toEqual({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, accepted_at: '2026-11-14T12:00:00.000Z', source: '', locale: '', current: true });
  });

  it('historico mais novo primeiro', () => {
    const events = normalizeLegalEvents([
      { terms_version: 'a', privacy_version: 'b', source: 'signup', at: '2026-11-01T00:00:00.000Z' },
      { terms_version: 'c', privacy_version: 'd', source: 'dashboard', at: '2026-11-14T00:00:00.000Z' }
    ]);
    expect(events.map((event) => event.source)).toEqual(['dashboard', 'signup']);
  });

  it('link no idioma da pessoa', () => {
    expect(legalDocumentUrl('terms')).toBe('/legal/termos.html');
    expect(legalDocumentUrl('privacy', 'es-ES')).toBe('/legal/privacidade.html?lang=es');
  });
});
