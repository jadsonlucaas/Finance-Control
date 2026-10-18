# Diagnostico da camada de repositorios

Este diagnostico foi feito antes das alteracoes de codigo da etapa de repositorios. O objetivo e separar contratos de aplicacao da infraestrutura Firebase/dataSdk sem alterar regras financeiras, autenticacao, impostos, parcelamentos, recorrencias, horas, importacoes ou relatorios.

## Verificacao critica do piloto web CreateExpense

Resultado: o piloto web de `CreateExpenseCommand` nao usa `InMemoryFinanceRepository` como persistencia principal no runtime normal.

Fluxo atual observado:

1. `src/app.js` cria `applicationGateway` com `createDefaultApplicationGateway({ repository: FinanceRepository })`.
2. `bootstrapApp()` expoe `globalThis.financeRepository = FinanceRepository`.
3. `installFirebaseServicesWhenReady()` instala os servicos Firebase locais/web, captura `target.__financeRawDataSdk || target.dataSdk`, cria `createFirebaseDataProvider(rawDataSdk)` e executa `FinanceRepository.setDataProvider(...)`.
4. A partir desse ponto, o piloto web chama o gateway, o handler chama o repositorio recebido e a persistencia segue para `FinanceRepository -> Firebase data provider -> dataSdk -> Firestore Web SDK`.
5. `InMemoryFinanceRepository` aparece nos testes do gateway e simulacoes locais, nao no caminho normal da UI.

Conclusao: nao ha regressao de persistencia in-memory no piloto web. A melhoria necessaria e formalizar essa dependencia para que o gateway receba uma interface explicita de repositorio, sem depender de fallback global ou de facade legado como contrato canonico.

## Estado atual

- `src/services/dataSdk.js` concentra Firestore Web SDK, snapshots em tempo real, cache por usuario, localStorage sincronizado, referencias globais, referencias pessoais e CRUD de registros.
- `src/domain/FinanceRepository.js` e um facade estatico que normaliza registros e delega para um provider configurado no bootstrap.
- `src/services/data/providers/firebaseDataProvider.js` adapta `dataSdk` para o `FinanceRepository`, mas expõe somente o CRUD basico usado pelo legado.
- `src/application/gateway/financeCommandHandlers.js` recebe um `repository`, mas ainda conhece o contrato legado `{ isOk, id, ids }` e usa wrappers de `src/application/records`.
- `src/application/gateway/financeQueryHandlers.js` le por `repository.list()` quando existe e cai para `globalThis.allRecords` como compatibilidade.
- Scripts legados ainda chamam `window.dataSdk`, `window.financeRecordMutations` e `window.financeRepository` diretamente.

## Chamadas diretas e responsabilidades misturadas

- `src/legacy/inline/part-03.js`, `part-05.js`, `part-06.js`, `part-08.js`, `part-11.js`, `part-13.js`, `part-14.js`, `part-16.js`, `part-29.js` e `src/ui/importacao.js` ainda fazem chamadas diretas a `window.dataSdk` ou bridges que chegam ao `dataSdk`.
- `src/services/dataSdk.js` mistura CRUD, roteamento de referencias, snapshots, cache, sincronizacao de localStorage, sanitizacao e persistencia Firestore.
- `src/services/userAdmin.js` conhece paths `users/{uid}` e regras de perfil/admin diretamente.
- `src/services/audit.js` grava em `users/{uid}/audit_logs` diretamente.
- `src/legacy/storageSync.js` e `src/services/dataSdk.js` tratam cache/localStorage como compatibilidade historica.

## Operacoes por categoria

- CRUD puro: create/update/delete/list de `finance_records`, `local_storage`, `audit_logs`, referencias globais e perfis.
- Regra de negocio misturada: referencia global vs pessoal, bloqueio de referencia em uso, validacao de contrato financeiro antes de persistir, default shared references, auditoria automatica.
- Cache/snapshot: `dataSdk.init()` assina `finance_records`, `shared_macros`, `shared_categories` e `local_storage`.
- Batch/createMany: parcelamentos, recorrencias e importacoes em lote.
- Futuras transacoes: edicao/exclusao de recorrencia em escopo de serie, idempotencia persistida, conciliacao de importacao concorrente e auditoria atomica server-side.

## Riscos

- Fallback silencioso para `globalThis.allRecords` pode mascarar dependencia ausente.
- Handlers que conhecem contrato legado de provider dificultam troca por backend futuro.
- `FirebaseError` e mensagens cruas podem chegar perto demais da UI.
- Duplicar validacoes de Rules no cliente aumentaria risco de divergencia.
- Separar snapshot e leitura pontual sem contrato claro pode quebrar cache e troca de usuario.

## Politica alvo

- Interfaces de repositorio ficam em `src/application/repositories`.
- Interfaces nao importam Firebase, DOM, `window`, localStorage ou componentes de UI.
- Firebase Web SDK e `dataSdk` ficam encapsulados em adaptadores.
- In-memory e usado apenas por testes, desenvolvimento isolado e simulacoes.
- Gateway e handlers recebem dependencias por composition root.
- Erros de infraestrutura sao normalizados antes de virar `ApplicationResult`.
- Snapshots ficam em contrato separado de subscription, sem vazar snapshot cru.

## Sequencia de migracao

1. Criar contratos e resultados comuns de repositorio.
2. Criar implementacoes in-memory deterministicas.
3. Criar adaptadores Firebase Web sobre os facades atuais.
4. Criar `createApplicationDependencies()`.
5. Migrar handlers do gateway para `repositories.financeRecords`.
6. Manter bridges legadas enquanto UI antiga ainda depender delas.
7. Migrar fluxos legados em passos pequenos e cobertos por regressao.

## Rollback

- Se o gateway falhar, o piloto web ainda mantem fallback legado para `financeRecordMutations.createRecord`.
- Como nenhum schema Firestore, Rules ou migracao real e alterado nesta etapa, rollback local se limita aos arquivos de aplicacao/docs/testes.
- Nao ha alteracao de dados reais, deploy, push, remote, Admin SDK ou integracao externa.
