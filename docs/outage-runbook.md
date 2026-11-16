# Indisponibilidade: o que acontece e o que fazer

Etapa 5, item 6. Para cada peça do sistema, este runbook mostra o que o usuário vê quando ela cai, qual alerta avisa, o que fazer e como testar. Os testes automatizados ficam em `tests/services/whatsappApi/outages.test.js`.

## Mapa rápido

| Peça | O usuário vê | Alerta | Teste |
| --- | --- | --- | --- |
| Firestore (cota, rede, lentidão) | WhatsApp: "Estou com instabilidade… tente em alguns minutos" (ou responde com a leitura de até 10 min atrás). Dashboard: pode não carregar ou não salvar | Monitor FC (e-mail após 2 falhas de 5 min); orçamento GCP | automatizado |
| whatsapp-api (container parado) | WhatsApp: "Não consegui concluir sua consulta agora" | Monitor FC | simulado manual |
| n8n (editor/webhook/worker) | WhatsApp não responde; checkout/portal do Stripe não abre pelo app | **nenhum** (os alertas rodam dentro do n8n) | simulado manual |
| Chatwoot | WhatsApp não responde; exportação de dados sai sem as conversas | Alerta Chatwoot sem resposta (só se o n8n estiver de pé) | automatizado (export/exclusão) |
| OpenAI | WhatsApp: "Não consegui concluir sua consulta agora" | Alertas FC (errorWorkflow) | — |
| Stripe | Checkout/portal falham; webhooks atrasam (o Stripe reenvia por até 3 dias) | e-mail "Webhook failures" do Stripe | automatizado (webhook idempotente) |
| Vercel | Dashboard fora | — (status.vercel.com) | — |
| Servidor (Portainer/VPS) | WhatsApp inteiro fora | **nenhum** | — |

## Firestore

O que a API faz:

- erro de cota (`RESOURCE_EXHAUSTED`), rede (`UNAVAILABLE`, `ECONN*`) ou prazo (`DEADLINE_EXCEEDED`) vira **503 `SERVICO_INDISPONIVEL`** com `detalhes.motivo` (`COTA_ESGOTADA`, `INDISPONIVEL`, `TIMEOUT`) e a mensagem pronta em pt ou es; o log tem `event: dependency_unavailable`;
- leitura travada passa a 503 `TIMEOUT` em 10 s (antes do limite de 15 s do n8n). Escritas não têm prazo: uma escrita interrompida poderia ser gravada depois da resposta;
- consultas usam a última leitura boa do mesmo pedido por até 10 minutos (`event: read_cache_stale_served` no log). Depois de uma escrita do próprio usuário, não usa leitura antiga;
- cadastro que falha não grava nada; o usuário repete e grava uma vez só;
- registrar mensagem falhando: o n8n segue o atendimento (só perde a proteção contra mensagem duplicada);
- status do vínculo falhando: o n8n responde "Não consegui verificar seu cadastro agora", nunca "vincule seu WhatsApp".

O que fazer:

1. Console do Firebase → Firestore → Uso: ver se é cota (Blaze ativo desde 11/11; o orçamento GCP avisa em 50/90/100% de R$ 25).
2. status.cloud.google.com para falha do Google.
3. Se for leitura demais de um usuário, `users/{uid}/usage/{mês}` mostra quem (Configurações → Usuários do sistema).

## whatsapp-api

1. Portainer → Stacks → `financecontrol_whatsapp_api_dev`: serviço 1/1?
2. Logs do serviço: procurar `dependency_unavailable`, `unhandled_error`.
3. Rollback: Re-pull com a imagem anterior (tag do commit no GHCR).

## n8n

Ponto cego: o Monitor FC, o Alerta Chatwoot e os Alertas FC rodam **dentro** do n8n. Se o n8n cair, nenhum alerta sai. Recomendação: um monitor externo gratuito (ex.: UptimeRobot) checando o `/healthz` do n8n (webhook e editor) e o `GET /health` da whatsapp-api exposto pelo n8n, a cada 5 min, com e-mail. Confirmar as URLs públicas antes de configurar.

1. Portainer → stack `n8n`: `n8n_editor`, `n8n_webhook` e `n8n_worker` 1/1? (levam ~1 min para subir; 0/1 logo após update é normal).
2. Redis e Postgres (stack `postgres`) de pé?
3. Rollback de workflow: versão publicada anterior no histórico do workflow.

## Chatwoot

- Mensagem chega mas não sai resposta: o "Alerta Chatwoot sem resposta" avisa após 3 min.
- Exportação de dados: sai com `conversas_whatsapp.situacao = "indisponivel"`, sem derrubar o resto.
- Exclusão de conta: apaga os dados no Firestore e registra a falha do Chatwoot no log (`account_deletion_chatwoot_failed`); apagar o contato no Chatwoot à mão depois.

## Simulado manual (fazer num horário calmo, ~20 min)

| # | Passo | Esperado | Volta |
| --- | --- | --- | --- |
| 1 | Portainer: `financecontrol_whatsapp_api_dev_api` → Scale 0 | WhatsApp responde "Não consegui concluir…"; e-mail do Monitor FC em até ~10 min | Scale 1; e-mail de recuperação |
| 2 | Mandar a mesma pergunta 2x seguidas com a API de volta | Respostas normais | — |
| 3 | Stack n8n: `n8n_worker` → Scale 0 por 5 min | WhatsApp sem resposta; **nenhum alerta** (confirma o ponto cego) | Scale 1; as mensagens que ficaram na fila do Redis são respondidas com atraso |

Registrar data, hora e o que aconteceu em cada passo.
