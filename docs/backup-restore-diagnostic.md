# Diagnostico de Backup e Recuperacao

Data: 2026-08-23

## Escopo analisado

O estado recuperavel do Finance-Control-New esta distribuido principalmente em:

- `users/{uid}/finance_records`: saidas, entradas, pessoas, macros/categorias pessoais, regras percentuais, historico salarial e controle de horas.
- referencias globais: macros/categorias compartilhadas administradas separadamente.
- `users/{uid}/local_storage`: preferencias locais sincronizadas.
- `users/{uid}/audit_logs`: trilha operacional append-only.
- `users/{uid}/idempotency_receipts`: recibos tecnicos contra replay.
- importacoes: metadados em registros financeiros e auditoria; nao ha colecao persistente de backup/import batch nesta etapa.
- `tax_parameters`: parametros tributarios versionados globais, lidos por usuarios ativos e mantidos por admin.

## Entra no backup

- `finance_records` proprios do usuario autenticado/confiavel.
- `personal_references` derivadas de registros pessoais `macro`, `categoria` e `pessoa`.
- `local_settings` proprias.
- `percentage_rules` proprias.
- `salary_history` propria.
- `hour_entries` proprias.
- Metadados minimos: versao, owner seguro, counts, checksum, origem, correlacao e avisos.

## Fica fora por padrao

- Credenciais, tokens, cookies, authorization, private keys, service accounts, telefone, WhatsApp, payload bruto, arquivo bancario bruto, XLSX bruto e bytes de arquivo.
- `audit_logs`, `idempotency_receipts` e import batches operacionais nao sao restaurados automaticamente como dados financeiros.
- Referencias globais e `tax_parameters` nao entram no restore comum de usuario; sao dados administrados/globalmente.
- Dados derivados regeneraveis, caches e snapshots de UI.

## Dados operacionais

Auditoria, receipts de idempotencia e lotes de importacao sao evidencias operacionais. Quando exportados futuramente, devem ficar em secao separada `operational` e nao participar de `CommitFinanceRestore` padrao.

## Ordem segura de restauracao

1. Validar snapshot, checksum, versao e campos proibidos.
2. Preparar plano sem escrita.
3. Criar snapshot pre-restore do estado alvo.
4. Criar apenas registros classificados como `new`.
5. Ignorar `identical`.
6. Bloquear `conflict`, `incompatible` e `orphaned`.
7. Auditar resumo, nunca o backup completo.

## Riscos

- Backup local nao e backup corporativo gerenciado.
- Arquivo baixado pelo browser pode ser perdido ou copiado por terceiros.
- Auditoria client-side nao e inviolavel.
- Restore real confiavel deve ser feito por backend/Admin SDK futuro; esta etapa cobre somente InMemory e Firebase Emulator.
