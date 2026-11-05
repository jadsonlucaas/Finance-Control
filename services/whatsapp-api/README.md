# whatsapp-api

API server-side do assistente financeiro via WhatsApp. O agente de IA do n8n chama estas rotas como ferramentas. A API lê e altera os lançamentos do usuário no Firestore com o Firebase Admin SDK, e o navegador nunca fala com ela.

Issue: #28

## Segurança

| Item | Como funciona |
| --- | --- |
| Autenticação | O header `x-api-key` (ou `Authorization: Bearer`) deve bater com `WHATSAPP_API_KEY`. A comparação é feita em tempo constante. |
| Usuário | Vem só do telefone, por meio de `WHATSAPP_PHONE_LINKS`. A IA nunca escolhe o uid. Quando o vínculo informa `chatwootAccountId`, o `accountId` da chamada precisa bater. |
| Isolamento | Toda leitura e escrita fica em `users/{uid}/...`. Um lançamento de outro usuário retorna 404. |
| Escrita | É feita em duas etapas: `preparar` devolve um resumo e `confirmar` executa. A confirmação expira em 10 minutos. |
| Idempotência | Usa `idempotency_receipts/whatsapp_{confirmation_id}`, criado de forma atômica. Confirmar duas vezes não duplica o lançamento. |
| Conflito | Se o lançamento mudou (`updated_at`) entre preparar e confirmar, a resposta é 409 e nada é alterado. |
| Exclusão | É um arquivamento (`archived: true`), que pode ser revertido no app. |
| Auditoria | Grava em `audit_logs` com `actor_type: integration` e `source_channel: future_integration`. |
| Logs | Registram só a rota, o status, o código, a duração e o hash do telefone. Não registram valores, o corpo da requisição nem o telefone. |
| Contrato | Todo registro novo ou alterado passa por `validateFinanceRecord` (`src/domain/records`). Os registros não guardam telefone. |

## Rotas

Todas as rotas são `POST` com corpo JSON contendo `telefone` e `accountId` (conta do Chatwoot). `GET /health` não pede autenticação.

### Leitura

| Rota | Campos extras | Retorno |
| --- | --- | --- |
| `/internal/whatsapp/despesas` | `competencia` (YYYY-MM, padrão: mês atual) | Mesmo contrato da API readonly atual: `totalDespesas`, `despesasPagas`, `quantidadeDespesas`, `quantidadePagas` |
| `/internal/whatsapp/resumo` | `competencia` | Despesas (total, pagas, em aberto), receitas (total, recebidas, pendentes), saldo realizado e saldo previsto, já formatados em R$ |
| `/internal/whatsapp/lancamentos` | `competencia`, `tipo` (despesa/receita), `status` ("em aberto", "Pago"...), `categoria`, `busca`, `limite` (máx. 50) | Lista com `id`, descrição, valor, status, categoria e vencimento, além do total filtrado |
| `/internal/whatsapp/categorias` | `competencia` | Despesas por categoria, com total, pago, em aberto e % |
| `/internal/whatsapp/vencimentos` | `dias` (0–90, padrão 7) | Contas atrasadas e contas a vencer até hoje + `dias` |

Regras de cálculo:

- Cancelados e arquivados ficam de fora.
- Para despesas, "em aberto" significa `Em aberto`, `Vencido` ou sem status.
- O valor de uma receita é `liquido` e, na falta dele, `amount`. É a mesma regra do dashboard.

### Escrita (sempre em duas etapas)

`POST /internal/whatsapp/acoes/preparar`

```json
{ "telefone": "+...", "accountId": 3, "acao": "registrar_despesa",
  "dados": { "descricao": "Farmácia", "valor": "123,45", "categoria": "Saúde", "vencimento": "2026-11-20" } }
```

| `acao` | `dados` |
| --- | --- |
| `registrar_despesa` | `descricao`*, `valor`*, `categoria`, `macro_categoria`, `data`, `vencimento`, `competencia`, `status` (Em aberto/Pago), `forma_pagamento`, `pessoa` |
| `registrar_receita` | `descricao`*, `valor`*, `categoria`, `data`, `competencia`, `status` (Pago/Pendente), `pessoa` |
| `marcar_pago` | `lancamento_id`* |
| `editar` | `lancamento_id`*, `alteracoes`* com `descricao`, `valor`, `categoria`, `macro_categoria`, `vencimento`, `data`, `competencia`, `status`, `forma_pagamento` ou `pessoa` |
| `excluir` | `lancamento_id`* (o lançamento é arquivado) |

A resposta traz `confirmation_id` e o `resumo` que deve ser mostrado ao usuário. Depois disso:

- `POST /internal/whatsapp/acoes/confirmar` com `{ telefone, accountId, confirmation_id }` executa a ação. Se a ação já foi executada, a resposta é `ja_executado`.
- `POST /internal/whatsapp/acoes/cancelar` com `{ telefone, accountId, confirmation_id }` cancela a ação.

### Erros

Formato: `{ "erro": { "codigo": "...", "mensagem": "..." } }`.

| Status | Significado |
| --- | --- |
| 400 | Entrada inválida |
| 401 | Chave ausente ou inválida |
| 403 | Telefone ou conta não vinculados |
| 404 | Não encontrado |
| 409 | Conflito, ação já paga ou ação cancelada |
| 410 | Confirmação expirada |
| 422 | Contrato de dados violado |

## Deploy (Docker, mesma rede do n8n)

```bash
# na raiz do repositório
docker build -f services/whatsapp-api/Dockerfile -t finance-control-whatsapp-api .
docker run -d --name financecontrol_whatsapp_api_dev --network <rede-do-n8n> \
  --env-file services/whatsapp-api/.env \
  finance-control-whatsapp-api
```

1. Copie `.env.example` para `.env`, que não é versionado.
2. Gere `WHATSAPP_API_KEY` com `openssl rand -hex 32`. Use uma chave **nova**, sem reaproveitar a da API readonly.
3. Preencha `WHATSAPP_PHONE_LINKS` com o telefone de teste e o uid do Firebase.
4. Forneça a service account com `FIREBASE_SERVICE_ACCOUNT_JSON` ou com um arquivo montado em `GOOGLE_APPLICATION_CREDENTIALS`.

Teste rápido:

```bash
curl -s http://financecontrol_whatsapp_api_dev:3000/health
curl -s -X POST http://financecontrol_whatsapp_api_dev:3000/internal/whatsapp/resumo \
  -H "x-api-key: $WHATSAPP_API_KEY" -H 'content-type: application/json' \
  -d '{"telefone":"+...","accountId":3}'
```

Para desenvolvimento local sem Firebase, rode `WHATSAPP_API_STORE=memory npm run dev`.

## Rollback

- A API não altera nada do app web nem das regras do Firestore. Para desligar, basta parar o container. As ferramentas do n8n passam a falhar, e o agente cai na resposta padrão de erro.
- A API readonly atual continua intacta. `/despesas` tem o mesmo contrato, então é possível trocar de volta só mudando a URL no n8n.
- Lançamentos criados pela API podem ser encontrados por `source_channel == "future_integration"` e `created_by_id == "whatsapp-api"`. Exclusões são arquivamentos, reversíveis no app.

## Próximo passo: cadastro do WhatsApp

Quando o cadastro existir, troque `createPhoneResolver` por um resolvedor que lê o vínculo salvo pelo usuário. A interface é a mesma: `resolve({ telefone, accountId }) -> { uid }`. O vínculo precisa ficar fora de `finance_records`, porque o contrato proíbe telefone nos lançamentos.
