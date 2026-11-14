import { describe, expect, it, vi } from 'vitest';
import { createDataExportService, dataExportErrorMessage, exportFileNames } from '../../src/services/dataExport.js';

const NOW = new Date('2026-11-14T12:00:00Z');

describe('exportacao de dados (Dashboard)', () => {
  it('pede ao servidor e salva JSON + CSV com BOM', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ formato: 'finance-control-export', versao: 1, secoes: { a: 1 }, lancamentos_csv: 'id;tipo' }) }));
    const save = vi.fn();
    const service = createDataExportService({ endpoint: 'https://relay.test', getIdToken: async () => 'tok', getLocale: () => 'es-ES', fetchImpl, save, documentRef: {}, now: () => NOW });
    const result = await service.downloadMyData();
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ acao: 'exportar_dados', locale: 'es-ES', idToken: 'tok' });
    expect(result.files).toEqual(['mis-datos-2026-11-14.json', 'movimientos-2026-11-14.csv']);
    const [jsonCall, csvCall] = save.mock.calls;
    expect(JSON.parse(jsonCall[2])).toEqual({ formato: 'finance-control-export', versao: 1, secoes: { a: 1 } });
    expect(csvCall[2]).toBe('﻿id;tipo');
  });

  it('erros do servidor viram mensagem; sem endpoint fica desligado', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ erro: { codigo: 'RATE_LIMITED' } }) }));
    const service = createDataExportService({ endpoint: 'https://relay.test', getIdToken: async () => 'tok', fetchImpl, save: vi.fn() });
    await expect(service.downloadMyData()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(dataExportErrorMessage({ code: 'RATE_LIMITED' })).toMatch(/várias vezes/);
    expect(createDataExportService({ endpoint: '' }).enabled).toBe(false);
    expect(exportFileNames(NOW).json).toBe('meus-dados-2026-11-14.json');
  });
});
