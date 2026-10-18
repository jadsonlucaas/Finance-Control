# Politica de parcelamentos

Atualizado em: 18/07/2026

## Modelo monetario

Parcelamentos sao calculados internamente em centavos inteiros. A borda de entrada usa `moneyToCents(value)` e a borda de persistencia/interface usa `centsToMoney(cents)`.

Strings monetarias aceitas precisam ser explicitas: `R$ 1.234,56`, `1234,56`, `1234.56` ou inteiro sem separador decimal. Formatos ambiguos, `NaN` e `Infinity` sao rejeitados.

## Distribuicao e residuo

`splitAmountIntoInstallments(totalCents, count)` calcula o valor-base inteiro com divisao inteira e aplica o residuo na ultima parcela por padrao. Isso torna a serie deterministica e garante soma exata.

Exemplo: R$ 100,00 em 3 parcelas vira R$ 33,33, R$ 33,33 e R$ 33,34.

## Datas e competencia

O vencimento preserva o dia original quando o mes destino possui esse dia. Quando nao possui, usa o ultimo dia valido do mes. A competencia de cada parcela corresponde ao mes do respectivo vencimento.

## Status

Na criacao de serie, a primeira parcela preserva o status escolhido. Parcelas futuras ficam `Em aberto`. `paid_at` e preenchido somente para a primeira parcela quando ela nasce `Pago`. `archived` nasce como `false`.

## Parent e numeracao

Todas as parcelas de uma serie recebem o mesmo `parent_id`, `installment_no` sequencial a partir de 1 e `total_installments` igual a quantidade total da serie.

## Persistencia

`CreateInstallmentSeries` gera a serie em memoria e nao persiste. A persistencia deve ocorrer por `createMany`, com validacao completa antes da primeira escrita. No Firebase local, `dataSdk.createMany` usa `writeBatch`.

## Edicao

Esta etapa nao implementa edicao de serie completa. Editar uma parcela continua alterando somente aquela parcela. O sistema nao redistribui valores automaticamente e nao altera silenciosamente `parent_id`, `installment_no` ou `total_installments`.

## Analise de serie

`analyzeInstallmentSeries(records)` agrupa registros parcelados e informa soma, duplicidades, numeros ausentes, `parent_id` ausente, totais inconsistentes e limitacoes quando o total original nao esta persistido.

## Compatibilidade

`amount_cents` nao foi adicionado ao Firestore. O calculo usa centavos no dominio e persiste `amount` em reais com no maximo duas casas. Series existentes nao sao alteradas automaticamente.

## Uso futuro por integracoes

Aplicacao web e backend futuro devem usar o mesmo `CreateInstallmentSeries`. `source_channel` nao altera valores. `idempotency_key` podera evitar reprocessamento em fase futura. Nenhuma integracao WhatsApp foi implementada. Telefone nao faz parte do contrato financeiro.
