# Plano de reconciliacao do controle de horas

Executado em: 21/08/2026

## Escopo

Este plano descreve uma reconciliacao futura e manual de registros `controle_horas`. Nenhuma migracao automatica foi executada nesta etapa.

## Backup

- Exportar a colecao de registros financeiros antes de qualquer alteracao futura.
- Guardar o hash do commit de aplicacao usado na analise.
- Guardar relatorio do dry-run com data, usuario responsavel e ambiente.

## Dry-run

- Executar `buildHourControlDryRun(records)` em ambiente local ou em copia controlada dos dados.
- Confirmar que o resultado contem `wrote: false`.
- Classificar registros como `current` ou `review_required`.
- Revisar manualmente casos com:
  - jornada noturna antiga;
  - hora final menor que inicial;
  - intervalo invalido;
  - divergencia de `quantidadeHoras`;
  - divergencia de `quantidadeHorasFormatada`;
  - divergencia de valor calculado;
  - percentual ausente;
  - salario nao resolvido;
  - possivel DSR duplicado;
  - campos legados.

## Criterios

- Registros sem divergencia nao precisam ser regravados.
- Registros com divergencia financeira exigem aprovacao manual.
- Registros historicos devem usar salario vigente da competencia original.
- DSR deve excluir o valor antigo do registro editado antes de incluir o novo valor.

## Aprovacao manual

- Nenhuma escrita deve ocorrer somente com base no dry-run.
- A aprovacao deve indicar quais registros serao normalizados.
- Alteracoes devem ser atomicas e auditaveis.

## Nao retroatividade

- Esta etapa nao recalcula dados reais.
- Nao ha reprocessamento automatico de meses fechados.
- O contrato novo vale para criacao/edicao futura e para normalizacao manual aprovada.

## Rollback

- Como esta etapa nao escreve em dados reais, rollback funcional e reversao do commit local.
- Para uma migracao futura, rollback devera restaurar backup dos registros alterados.

## Proibicao atual

- Nao executar esta reconciliacao em producao agora.
- Nao usar Firebase real neste prompt.
- Nao criar scripts de escrita em massa nesta etapa.
