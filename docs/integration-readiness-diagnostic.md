# Diagnostico de prontidao para integracoes multicanal

Este diagnostico registra a fronteira atual antes da criacao da camada de aplicacao multicanal. A meta desta etapa e preparar contratos e pontos de entrada reutilizaveis sem implementar WhatsApp, webhook, Meta, provedor externo, Admin SDK, telefone, NLP ou troca de mensagens.

## Estado atual

- A aplicacao ainda e composta por uma camada moderna em `src/app.js` e modulos de dominio, mais scripts legados carregados por `src/legacy/classicScripts.js`.
- A interface web usa handlers legados em `src/legacy/inline`, com destaque para `handleSubmit` em `src/legacy/inline/part-03.js`, que le formularios, monta payloads, chama mutacoes globais e dispara toasts.
- As mutacoes financeiras ja passam por `src/services/financeRecordMutations.js` e pelo repositorio `src/domain/FinanceRepository.js`, que normaliza registros antes de delegar para o provider de dados.
- O provider Firebase real e instalado por `src/services/installFirebaseServices.js` e adaptado por `src/services/data/providers/firebaseDataProvider.js`.
- As regras puras de dominio estao concentradas em modulos como `src/domain/recordPayloads.js`, `src/domain/installmentSeries.js`, `src/domain/recurrenceSeries.js`, `src/domain/entries.js`, `src/domain/taxes.js`, `src/domain/hours.js` e `src/domain/hourPeriodSummary.js`.
- A selecao e agregacao de dados para UI ja tem pontos modernos em `src/application/selectors` e em consolidadores de entradas em `src/application/entries`.

## Pontos de acoplamento

- O fluxo web mistura leitura de DOM, validacao visual, montagem de payload, persistencia e feedback ao usuario no mesmo handler.
- Muitas rotas legadas dependem de funcoes em `window`, documentadas em `docs/global-api-inventory.md`.
- A origem do comando ainda e implicitamente a UI web; nao ha envelope padrao para registrar canal, ator, correlacao ou idempotencia.
- O resultado das operacoes e heterogeneo: use cases e providers retornam formatos como `{ isOk }`, enquanto a UI traduz falhas diretamente para mensagens.
- Alguns fluxos ainda usam `window.dataSdk` diretamente em scripts legados, principalmente importacao, ajustes e operacoes auxiliares.

## Regras reutilizaveis

- Criacao e edicao de registros financeiros podem reaproveitar `buildSaidaPayload`, `buildEditedSaidaPayload`, `buildEntradaPayload` e validadores de contrato financeiro.
- Parcelamentos e recorrencias podem reaproveitar `buildInstallmentSaidaPayloads`, `createInstallmentSeries`, `buildRecurringSaidaPayloads` e `createRecurrenceSeries`.
- Consolidacao de entradas pode reaproveitar `consolidatePersonMonthlyEntry` e `getConsolidatedMonthlyEntries`.
- Jornada, hora extra e banco de horas podem reaproveitar `createWorkSessionEngine`, `buildHourPeriodSummary` e os contratos de `controle_horas`.
- Consultas de dashboard e detalhes devem continuar usando seletores e registros normalizados, sem duplicar regra financeira.

## Fronteiras propostas

- A UI web deve montar comandos e consultas de aplicacao, mas nao deve decidir autorizacao ou persistencia.
- A camada `ApplicationCommandGateway` deve validar envelopes, resolver handlers explicitos, aplicar autorizacao, controlar idempotencia local e normalizar respostas.
- Handlers de comando e consulta devem chamar use cases, builders e repositorios existentes, sem acessar DOM, `window`, Firebase SDK direto ou provider externo.
- Repositorios devem continuar sendo adaptadores da persistencia; nesta fase, a implementacao em memoria existe apenas para testes locais.

## Riscos de regressao

- Alterar o `handleSubmit` pode afetar criacao de saidas simples, parcelamentos, recorrencias e edicao se a migracao nao for restrita.
- Aumentar globais em `window` pode quebrar o baseline de migracao ou criar nova API legada.
- Permitir `ownerUid` livre no payload abriria risco de gravacao cruzada entre usuarios.
- Tratar `source.channel` como permissao elevaria privilegios indevidamente.
- Persistir identidade externa ou telefone em registros financeiros violaria a politica de contratos de dados.
- Mudar base de calculo, arredondamento, impostos, parcelamentos, recorrencias ou jornada nesta etapa comprometeria regressao funcional.

## Sequencia segura

1. Introduzir contratos puros de envelope, resultado, autorizacao, idempotencia, registries e gateway.
2. Criar handlers usando use cases e builders existentes, com repositorio in-memory para testes.
3. Adaptar somente um fluxo piloto da web: criacao simples de saida.
4. Cobrir o piloto e o consumo server-side simulado com testes locais sem DOM e sem Firebase real.
5. Documentar contratos futuros de identidade externa e idempotencia sem criar colecoes Firestore.
6. Validar inventario de globais, testes, build, smoke e Playwright antes de qualquer commit local.

## Fora do escopo desta etapa

- WhatsApp, webhook, Meta Cloud API, Twilio, Z-API, Evolution API, provedor de mensagens ou qualquer canal real.
- Telefone como identificador financeiro.
- Firestore collection para identidades externas ou idempotencia.
- Firebase Admin SDK, deploy, publicacao, pull, push ou alteracao remota.
- Refatoracao ampla da UI ou alteracao de comportamento visual.
- Alteracao de regras financeiras, tributarias, parcelamentos, recorrencias, jornada, autenticacao, importacao ou relatorios.
