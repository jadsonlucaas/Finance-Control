# Diagnostico de Idempotencia Persistente

Executado em: 22/08/2026

## Estado atual

- `ApplicationCommandGateway` ja aceita `idempotencyKey` em comandos e calcula um fingerprint local em `src/application/gateway/idempotency.js`.
- A protecao atual e em memoria por processo/aba, por `InMemoryIdempotencyStore`, sem receipt persistido no Firestore.
- `source_channel`, `source_reference_id`, `created_by_type`, `created_by_id`, `correlation_id`, `idempotency_key` e `received_at` ja podem ser propagados por `actorMetadata` para registros financeiros.
- `CreateExpense`, `CreateIncome`, `CreateHourEntry`, `CreateInstallmentSeries` e `CreateRecurrenceSeries` passam por casos de uso que aplicam metadados quando eles estao presentes no contexto.
- A auditoria preserva `correlationId`, `sourceChannel`, `ownerUid` e ator, mas ainda nao compartilha um receipt persistente de idempotencia.
- As regras do Firestore validam metadados opcionais em `finance_records`, mas nao havia subcolecao dedicada para receipts.

## Fluxos de risco

- Criacao de saida disparada duas vezes por clique, reload, retry de rede ou multiplas abas.
- Criacao de entrada, hora, parcelamento e recorrencia com replay parcial.
- Importacoes futuras com registros repetidos, chaves externas repetidas ou fingerprints divergentes.
- Series com `createMany`, em que um replay pode gerar novo `seriesId` e novos documentos se nao houver receipt da operacao inteira.
- Reprocessamentos por backend futuro usando a mesma operacao sem uma chave logica persistente.

## Protecao atual

- O gateway evita replay somente enquanto o store em memoria existir.
- Uma segunda execucao identica pode retornar `IDEMPOTENT_REPLAY` apenas dentro do mesmo processo.
- Payload diferente com a mesma chave retorna conflito apenas quando o registro em memoria ainda existe.
- Queries removem `idempotencyKey` e nao passam pela reserva.

## Risco residual

- Troca de aba, reload, novo dispositivo ou reinicio perdem a memoria da reserva.
- Falhas apos escrita e antes do retorno podem duplicar a operacao em nova tentativa.
- `createMany` nao possui receipt atomico da serie inteira.
- A UI pode ter travas visuais, mas elas nao substituem idempotencia persistente.
- Receipts inexistentes impedem rastrear replays, conflitos e retries de forma auditavel.

## Proposta

- Centralizar metadados operacionais em helper puro.
- Definir fingerprint deterministico por `ownerUid`, `commandName`, `sourceChannel` e payload canonicalizado, ignorando campos volateis.
- Criar `IdempotencyReceipt` em subcolecao privada por usuario.
- Criar `IdempotencyRepository` com implementacoes in-memory e Firebase Web.
- Integrar reserva antes do use case no `ApplicationCommandGateway` para comandos de mutacao.
- Completar ou falhar o receipt conforme resultado do comando.
- Usar `CreateExpense` como piloto sem obrigar chave na UI web comum.

## Compatibilidade

- Campos sao opcionais para registros legados.
- `source_channel` nao concede permissao.
- `source_reference_id` nao determina `owner_uid`.
- O owner continua vindo do contexto autenticado.
- O contrato aceita `future_integration` para backend futuro, sem implementar chatbot, webhook, provider, Admin SDK, telefone ou armazenamento de mensagem bruta.
- O futuro backend devera chamar os mesmos casos de uso e usar a mesma chave de idempotencia.

## Rollback

- Como os registros financeiros permanecem no mesmo contrato, rollback funcional consiste em remover a integracao do gateway com o repositorio persistente e manter a execucao sem `idempotencyKey`.
- A subcolecao de receipts e isolada em `users/{uid}/idempotency_receipts`, nao participa de Dashboard, relatorios ou consultas financeiras.
- Nenhuma migracao real de dados sera executada nesta etapa.
