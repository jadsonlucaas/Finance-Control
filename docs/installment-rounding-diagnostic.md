# Diagnostico de arredondamento de parcelamentos

Atualizado em: 18/07/2026

## Comportamento anterior

A geracao principal de parcelamentos estava em `src/domain/recordPayloads.js`, na funcao `buildInstallmentSaidaPayloads`. O valor da parcela era calculado com `roundCurrency(total / count)` e repetido em todas as parcelas.

Exemplo: R$ 100,00 em 3 parcelas gerava R$ 33,33, R$ 33,33 e R$ 33,33. A soma persistida ficava em R$ 99,99, criando divergencia de um centavo.

O preview visual legado em `src/legacy/inline/part-03.js` tambem usava divisao direta com `toFixed(2)`, servindo apenas para exibicao. Datas eram geradas com `Date.setMonth`, que pode aplicar overflow silencioso em dias como 29, 30 e 31.

## Pontos mapeados

- Calculo de valor: `buildInstallmentSaidaPayloads` e preview legado `calculateInstallmentValue`.
- Uso de float: divisao de `total / count` antes da correcao.
- Datas: avancavam mensalmente a partir de `baseDueDate`; competencia vinha de `due_date`.
- `parent_id`: gerado no formulario legado como `p_` + timestamp e copiado para todas as parcelas.
- `installment_no` e `total_installments`: sequenciais no builder.
- Primeira parcela: preservava o status escolhido; futuras ficavam `Em aberto`.
- `paid_at`: preenchido apenas se a primeira parcela fosse criada como `Pago`.
- Cartao e metodo: copiados do payload de saida para cada parcela.
- Categoria: snapshot textual (`macro_category`, `subcategory` e campos opcionais) copiado para cada parcela.
- Origem/importacao: metadados existentes podiam atravessar o payload, mas nao havia regra central para serie.
- Persistencia: UI criava uma parcela por vez, com risco de lote parcial.
- Edicao/exclusao: atuam sobre o registro individual selecionado; nao ha edicao de serie completa.
- Duplicidade: botao era desabilitado, mas nao havia guard explicito contra dupla submissao programatica.
- Series legadas: podem existir sem `parent_id`, com soma divergente ou numeracao inconsistente.

## Politica proposta

O dominio passa a dividir valores em centavos inteiros, usando residuo deterministico na ultima parcela por padrao. O valor persistido continua sendo `amount` em reais para compatibilidade; `amount_cents` nao foi adicionado.

Datas sao avancadas por calendario, preservando o dia quando existir e usando o ultimo dia valido do mes quando necessario. A competencia acompanha o vencimento.

## Risco

O maior risco era soma divergente por centavos e lote parcial em caso de falha no meio da persistencia. Dashboard e Parcelamentos consomem os registros persistidos e poderiam refletir totais incorretos ou duplicados.

## Compatibilidade

Registros existentes nao sao alterados automaticamente. Series antigas sem `parent_id` continuam sendo analisadas por dry-run, mas novas series geradas pelo caso de uso sempre recebem `parent_id`, numeracao e total consistentes.

## Rollback

Rollback de codigo: voltar o commit local desta fase. Rollback de dados nao se aplica, pois nenhuma serie real foi corrigida ou migrada nesta etapa.
