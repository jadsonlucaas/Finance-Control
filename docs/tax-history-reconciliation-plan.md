# Plano de reconciliacao historica tributaria

Atualizado em: 21/08/2026

## Objetivo

Recalcular entradas historicas com parametros tributarios versionados antes de qualquer migracao persistida. A reconciliacao deve ser auditavel, local e reversivel.

## Fluxo seguro

1. Exportar ou carregar registros em ambiente local/emulado.
2. Executar `dryRunTaxHistory` em `src/domain/taxHistoryDryRun.js`.
3. Comparar `currentInssCents`, `calculatedInssCents`, `currentIrrfCents` e `calculatedIrrfCents`.
4. Classificar divergencias por competencia, pessoa e versao tributaria.
5. Revisar divergencias com regras oficiais validadas externamente.
6. Somente depois criar migracao idempotente, com backup e testes especificos.

## Politica de nao escrita

O dry-run nao grava em Firestore, nao altera localStorage e nao modifica os objetos de entrada. Ele retorna apenas um relatorio em memoria.

## Campos rastreados

- `id`
- `person`
- `competence`
- `grossIncomeCents`
- `currentInssCents`
- `calculatedInssCents`
- `inssDifferenceCents`
- `currentIrrfCents`
- `calculatedIrrfCents`
- `irrfDifferenceCents`
- `inssParameterVersion`
- `irrfParameterVersion`
- `warnings`
- `errors`

## Riscos

- Os parametros atuais sao `legado sem fonte`; nao servem para validar tabela oficial.
- Registros antigos podem ter descontos manuais de INSS/IRRF que devem prevalecer na visualizacao historica.
- Mudancas retroativas exigem tabela oficial, autorizacao explicita e plano de rollback.

## Lacunas futuras

- Criar UI administrativa local/emulada para revisar parametros.
- Adicionar importador seguro de tabela oficial depois de validar fonte e layout.
- Criar migracao persistida somente com Firebase Emulator e plano de backup.
