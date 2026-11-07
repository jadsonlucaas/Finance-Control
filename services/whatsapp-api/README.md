# whatsapp-api

API server-side do assistente financeiro via WhatsApp. O agente de IA do n8n chama estas rotas como ferramentas. A API lê e altera os lançamentos do usuário no Firestore com o Firebase Admin SDK, e o navegador nunca fala com ela.

Issue: #28

## Segurança

| Item | Como funciona |
| --- | --- |
| Autenticação | O header `x-api-key` (ou `Authorization: Bearer`) deve bater com `WHATSAPP_API_KEY`. A comparação é feita em tempo constante. |
| Usuário | Vem só do telefone verificado do remetente, resolvido pelo vínculo ativo em `whatsapp_links/{telefone}` (criado pelo próprio usuário, ver abaixo). A IA nunca escolhe o uid. O `accountId` do Chatwoot precisa bater com o do vínculo, e a conta precisa estar ativa. `WHATSAPP_PHONE_LINKS` (manual) é opcional e fica só como reserva durante a migração; o vínculo gravado tem prioridade. |
| Isolamento | Toda leitura e escrita fica em `users/{uid}/...`. Um lançamento de outro usuário retorna 404. |
| Escrita | É feita em duas etapas: `preparar` devolve um resumo e `confirmar` executa. A confirmação expira em 10 minutos. |
| Idempotência | Usa `idempotency_receipts/whatsapp_{confirmation_id}`, criado de forma atômica. Confirmar duas vezes não duplica o lançamento. |
| Conflito | Se o lançamento mudou (`updated_at`) entre preparar e confirmar, a resposta é 409 e nada é alterado. |
| Exclusão | É um arquivamento (`archived: true`), que pode ser revertido no app. |
| Auditoria | Grava em `audit_logs` com `actor_type: integration` e `source_channel: future_integration`. |
| Logs | Registram só a rota, o status, o código, a duração e o hash do telefone. Não registram valores, o corpo da requisição nem o telefone. |
| Contrato | Todo registro novo ou alterado passa por `validateFinanceRecord` (`src/domain/records`). Os registros não guardam telefone. |

## Vínculo seguro conta ↔ WhatsApp (issue #40)

1. Em **Configurações → WhatsApp**, o usuário autenticado e ativo clica em "Gerar código". O app sorteia 8 caracteres (alfabeto sem 0/O/1/I/L) e grava só o SHA-256 em `whatsapp_link_codes/{hash}`, com `owner_uid`, `status: pending` e validade de 10 minutos (as regras limitam a 15).
2. O usuário envia o código pelo WhatsApp. O n8n reconhece o formato e chama `vinculo/confirmar` direto, sem a IA, com o telefone do remetente do webhook assinado do Chatwoot.
3. A API confere o código (existe, pendente, não expirado), a conta (ativa) e grava `whatsapp_links/{telefone}` numa transação, marcando o código como usado. Um telefone ativo em outra conta é recusado (409). Vincular um telefone novo revoga o anterior da mesma conta.
4. Depois de 5 códigos inválidos em 1 hora, o telefone fica bloqueado para novas tentativas (429) até a janela passar (`whatsapp_link_attempts/{hash do telefone}`, só servidor).
5. O usuário vê o número mascarado e desvincula no mesmo card. A revogação só troca `status`, `revoked_at` e `revoked_by` (regras) e vale na próxima mensagem, inclusive para confirmações pendentes.

| Rota | Campos | Retorno |
| --- | --- | --- |
| `/internal/whatsapp/vinculo/confirmar` | `telefone`, `accountId`, `codigo` | `{ vinculado: true, ja_vinculado }` ou erro `LINK_CODE_INVALID` (400), `ACCOUNT_NOT_ACTIVE` (403), `PHONE_LINKED_OTHER_ACCOUNT` (409), `LINK_TOO_MANY_ATTEMPTS` (429) |
| `/internal/whatsapp/vinculo/status` | `telefone`, `accountId` | `{ vinculado: true, acesso }` ou `{ vinculado: false, motivo, mensagem? }` (para o n8n responder a telefone desconhecido ou sem acesso sem chamar a IA) |

O código e o telefone nunca vão para os logs (só o hash do telefone). Auditoria: `whatsapp.link_created` em `users/{uid}/audit_logs`.

## Direito de uso: assinatura ou cortesia

O assistente no WhatsApp é do Premium. A API decide se a conta pode usar o canal:

- **Cortesia:** `whatsapp_comp_access/{uid}` com `status: active`. Só um admin ativo concede ou revoga, pelo painel **Usuários do sistema** (botão "Assistente cortesia"). Serve para sócios e testes.
- **Assinatura:** `billing_subscriptions/{uid}`, gravada só pelo servidor a partir dos webhooks do Stripe. Libera com `trialing`, `active` ou `past_due` (o Stripe ainda tenta cobrar). `canceled`, `unpaid`, `incomplete` e outros bloqueiam.

`WHATSAPP_ACCESS_MODE` controla a exigência:

| Valor | Efeito |
| --- | --- |
| `open` (padrão) | Comportamento anterior: qualquer número vinculado usa o assistente. |
| `entitlement` | Exige cortesia ativa ou assinatura em dia. Sem isso, `vinculo/status` devolve `{ vinculado: false, motivo: "WHATSAPP_ACCESS_REQUIRED", assinatura, mensagem }` e as demais rotas respondem 403 `WHATSAPP_ACCESS_REQUIRED`. |

Rollout seguro: conceda a cortesia a quem precisa **antes** de trocar para `entitlement`.

**Número principal (Premium pelo Stripe):** o telefone informado no pagamento fica em `billing_subscriptions/{uid}.phone`. Só esse número usa o Premium no WhatsApp; outro número vinculado à mesma conta recebe `assinatura: "phone_mismatch"` e a mensagem para usar o número do pagamento ou trocá-lo em "Gerenciar assinatura". A cortesia do admin não depende do telefone.

## Webhook do Stripe

`POST /internal/stripe/webhook` (com a mesma `x-api-key`) recebe os eventos do Stripe repassados pelo n8n. O n8n é só o carteiro: ele precisa repassar o **corpo cru** e o cabeçalho `stripe-signature`, e a API confere a assinatura de novo (HMAC-SHA256, tolerância de 5 minutos) com `STRIPE_WEBHOOK_SECRET` (ou `STRIPE_WEBHOOK_SECRET_FILE`). Sem o segredo, a rota responde 503 e nada é gravado.

| Evento | Efeito |
| --- | --- |
| `checkout.session.completed` | Liga cliente Stripe ↔ uid (vem de `client_reference_id`, que o Dashboard acrescenta ao link de pagamento) e grava o telefone do checkout. |
| `customer.subscription.created/updated/deleted` | Atualiza status, fim do período e cancelamento. Se chegar antes do checkout, fica guardado e é aplicado depois. Evento atrasado de assinatura antiga não derruba a nova. |
| `customer.updated` | Troca do telefone pelo portal do cliente atualiza o número principal. |

Coleções (só o servidor grava): `billing_webhook_events` (idempotência), `billing_customers`, `billing_stripe_subscriptions` e `billing_subscriptions/{uid}` (o que o Dashboard e a API leem). Falha ao gravar responde 500 e libera o evento para o reenvio do Stripe.

## Rotas

Todas as rotas são `POST` com corpo JSON contendo `telefone` e `accountId` (conta do Chatwoot). `GET /health` não pede autenticação.

### Leitura

| Rota | Campos extras | Retorno |
| --- | --- | --- |
| `/internal/whatsapp/despesas` | `competencia` (YYYY-MM, padrão: mês atual) | Mesmo contrato da API readonly atual: `totalDespesas`, `despesasPagas`, `quantidadeDespesas`, `quantidadePagas` |
| `/internal/whatsapp/resumo` | `competencia` ou `competencia_inicio` + `competencia_fim` | Despesas (total, pagas, em aberto), receitas (total, recebidas, pendentes), saldo realizado e saldo previsto, já formatados em R$ |
| `/internal/whatsapp/lancamentos` | `competencia`, `tipo` (despesa/receita), `status` ("em aberto", "Pago"...), `categoria`, `busca`, `forma_pagamento`, `limite` (máx. 50) | Lista com `id`, descrição, valor, status, categoria e vencimento, além do total filtrado |
| `/internal/whatsapp/categorias` | `competencia` ou `competencia_inicio` + `competencia_fim` | Despesas por categoria, com total, pago, em aberto e % |
| `/internal/whatsapp/vencimentos` | `dias` (0–90, padrão 7) | Contas atrasadas e contas a vencer até hoje + `dias` |
| `/internal/whatsapp/opcoes` | `macro` (opcional) | Macros, categorias (globais + pessoais) e formas de pagamento já usadas, para oferecer como opções no cadastro |

Em `registrar_despesa`, a API conduz o cadastro: enquanto faltar macro, categoria ou forma de pagamento, `acoes/preparar` devolve 400 com `MACRO_REQUIRED`, `CATEGORY_REQUIRED`, `CATEGORY_NOT_FOUND`, `CATEGORY_MACRO_MISMATCH` ou `PAYMENT_REQUIRED`. O erro traz `detalhes.pergunta` e `detalhes.opcoes` (até 10; se houver mais, 9 + "Outra"), e a mensagem já inclui a linha `[opcoes: ...]` que o n8n transforma em botões. A macro é deduzida quando a categoria existe em uma só macro. A comparação ignora acento e maiúsculas e aceita a opção cortada pelo WhatsApp (terminada em "…"). A forma de pagamento reaproveita a grafia de uma já usada.

Em `resumo` e `categorias`, um período de até 24 meses pode ser pedido com `competencia_inicio` e `competencia_fim` (`YYYY-MM`). Sem `competencia_fim`, o fim é o mês atual. A resposta de período traz `periodo` (início, fim, meses) no lugar de `competencia`, e `resumo` inclui `por_mes` com os totais de cada mês.

Regras de cálculo:

- Cancelados e arquivados ficam de fora.
- Para despesas, "em aberto" significa `Em aberto`, `Vencido` ou sem status.
- O valor de uma receita é `liquido` e, na falta dele, `amount`. É a mesma regra do dashboard.

### Escrita (sempre em duas etapas)

`POST /internal/whatsapp/acoes/preparar`

```json
{ "telefone": "+...", "accountId": 3, "acao": "registrar_despesa",
  "dados": { "descricao": "Farmácia", "valor": "123,45", "categoria": "Cuidados pessoais", "forma_pagamento": "Pix", "vencimento": "2026-11-20" } }
```

| `acao` | `dados` |
| --- | --- |
| `registrar_despesa` | `descricao`*, `valor`*, `categoria`*, `forma_pagamento`*, `macro_categoria` (se a categoria existir em mais de uma macro), `data`, `vencimento`, `competencia`, `status` (Em aberto/Pago), `pessoa` |
| `registrar_receita` | `descricao`*, `valor`*, `categoria`, `data`, `competencia`, `status` (Pago/Pendente), `pessoa` |
| `marcar_pago` | `lancamento_id`* |
| `editar` | `lancamento_id`*, `alteracoes`* com `descricao`, `valor`, `categoria`, `macro_categoria`, `vencimento`, `data`, `competencia`, `status`, `forma_pagamento` ou `pessoa` |
| `excluir` | `lancamento_id`* (o lançamento é arquivado) |

A resposta traz `confirmation_id` e o `resumo` que deve ser mostrado ao usuário. Só existe uma ação pendente por vez: preparar uma nova cancela a anterior. Em `confirmar` e `cancelar`, o `confirmation_id` é opcional; sem ele (ou com `"ultima"`), a ação usada é a pendente mais recente do usuário, o que permite ao agente confirmar sem guardar o id entre mensagens. Depois disso:

- `POST /internal/whatsapp/acoes/confirmar` com `{ telefone, accountId, confirmation_id }` executa a ação. Se a ação já foi executada, a resposta é `ja_executado`.
- `POST /internal/whatsapp/acoes/cancelar` com `{ telefone, accountId, confirmation_id }` cancela a ação.

### Erros

Formato: `{ "erro": { "codigo": "...", "mensagem": "..." } }`.

| Status | Significado |
| --- | --- |
| 400 | Entrada inválida |
| 401 | Chave ausente ou inválida |
| 403 | Telefone ou conta não vinculados, conta inativa ou sem direito de uso (`WHATSAPP_ACCESS_REQUIRED`) |
| 404 | Não encontrado |
| 409 | Conflito, ação já paga ou ação cancelada |
| 410 | Confirmação expirada |
| 422 | Contrato de dados violado |

## Deploy no Portainer (Docker Swarm com secrets)

Toda variável aceita a forma `NOME_FILE`, que aponta para um arquivo. É assim que o Swarm entrega os secrets, em `/run/secrets/...`. A credencial do Firebase usa `GOOGLE_APPLICATION_CREDENTIALS` apontando para o secret.

1. A cada merge na `main` que mexa no serviço, o workflow `whatsapp-api image` publica a imagem `ghcr.io/jadsonlucaas/finance-control-whatsapp-api:latest`. Se o pacote no GHCR for privado, cadastre o registry `ghcr.io` em **Portainer > Registries**, com um token que tenha `read:packages`.
2. Crie os 3 secrets listados em `stack.example.yml`.
3. Crie a stack em **Stacks > Add stack**, colando o `stack.example.yml` com o nome da rede do n8n.

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
3. (Opcional) `WHATSAPP_PHONE_LINKS`: vínculos manuais de reserva. Novos usuários se vinculam pelo app.
4. (Opcional) `WHATSAPP_ACCESS_MODE`: `open` (padrão) ou `entitlement` (exige assinatura ou cortesia).
5. (Opcional) `STRIPE_WEBHOOK_SECRET_FILE`: segredo de assinatura do endpoint do webhook no Stripe (`whsec_...`), como secret do Portainer.
6. Forneça a service account com `FIREBASE_SERVICE_ACCOUNT_JSON` ou com um arquivo montado em `GOOGLE_APPLICATION_CREDENTIALS`.

Teste rápido:

```bash
curl -s http://financecontrol_whatsapp_api_dev:3000/health
curl -s -X POST http://financecontrol_whatsapp_api_dev:3000/internal/whatsapp/resumo \
  -H "x-api-key: $WHATSAPP_API_KEY" -H 'content-type: application/json' \
  -d '{"telefone":"+...","accountId":3}'
```

Para desenvolvimento local sem Firebase, rode `WHATSAPP_API_STORE=memory npm run dev`.

## Rollback

- O vínculo pelo app depende das regras de `whatsapp_link_codes` e `whatsapp_links` em `firestore.rules`. Revertê-las desliga só a geração de códigos e a revogação pelo app; os vínculos já gravados continuam sendo lidos pela API.
- Fora isso, a API não altera nada do app web. Para desligar, basta parar o container. As ferramentas do n8n passam a falhar, e o agente cai na resposta padrão de erro.
- A API readonly atual continua intacta. `/despesas` tem o mesmo contrato, então é possível trocar de volta só mudando a URL no n8n.
- Lançamentos criados pela API podem ser encontrados por `source_channel == "future_integration"` e `created_by_id == "whatsapp-api"`. Exclusões são arquivamentos, reversíveis no app.

## Próximo passo: cadastro do WhatsApp

Quando o cadastro existir, troque `createPhoneResolver` por um resolvedor que lê o vínculo salvo pelo usuário. A interface é a mesma: `resolve({ telefone, accountId }) -> { uid }`. O vínculo precisa ficar fora de `finance_records`, porque o contrato proíbe telefone nos lançamentos.
