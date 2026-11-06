import { describe, expect, it } from 'vitest';
import { buildPaymentMethods, buildReferenceCatalog, resolveExpenseCategory } from '../../../services/whatsapp-api/src/references.js';

describe('whatsapp-api: referencias de cadastro', () => {
  it('usa os padroes do app quando nao ha categorias e ignora arquivadas e duplicadas', () => {
    expect(buildReferenceCatalog([]).macros).toEqual(['FIXO', 'VARIAVEL', 'RESERVA']);
    const catalog = buildReferenceCatalog([
      { type: 'categoria', category_name: 'Lazer', macro_category: 'VARIAVEL' },
      { type: 'categoria', category_name: 'lazer ', macro_category: 'VARIAVEL' },
      { type: 'categoria', category_name: 'Velha', macro_category: 'FIXO', archived: true },
      { type: 'macro', macro_category: 'FIXO' }
    ]);
    expect(catalog.categorias).toEqual([{ nome: 'Lazer', macro: 'VARIAVEL' }]);
    expect(catalog.macros).toEqual(['FIXO', 'VARIAVEL']);
  });

  it('ordena formas de pagamento pelo uso e ignora regra percentual', () => {
    const methods = buildPaymentMethods([
      { type: 'saida', payment_method: 'Pix' },
      { type: 'saida', payment_method: 'Nubank' },
      { type: 'saida', payment_method: 'nubank' },
      { type: 'saida', payment_method: 'Regra percentual' },
      { type: 'entrada', payment_method: 'Conta' },
      { type: 'saida', payment_method: 'Antigo', archived: true }
    ]);
    expect(methods).toEqual(['Nubank', 'Pix']);
  });

  it('resolve categoria sem acento e caixa', () => {
    const catalog = buildReferenceCatalog([]);
    expect(resolveExpenseCategory(catalog, 'alimentacao')).toEqual({ category_name: 'Alimentação', macro_category: 'VARIAVEL' });
  });
});
