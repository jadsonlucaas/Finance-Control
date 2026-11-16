# Consumo por cliente

Etapa 5, item 3 (16/11/2026). A whatsapp-api mede o uso de cada conta num documento por mes:

`users/{uid}/usage/{AAAA-MM}` (so o servidor grava; a dona da conta e o admin leem)

| Campo | O que conta |
| --- | --- |
| `messages` | Mensagens novas recebidas no WhatsApp de um numero vinculado (rota `mensagem/registrar`). Cada uma = 1 execucao do agente de IA no n8n. |
| `tool_calls` | Ferramentas chamadas pelo agente (`/internal/whatsapp/*`). |
| `writes` | Ferramentas que gravam (acoes, orcamento/definir, parar alertas). |
| `records_read` | Documentos lidos no Firestore para responder, fora do cache curto (`withReadCounting` fica por baixo do `withReadCache`). |
| `by_route.{rota}` | Chamadas por ferramenta (`/` vira `_`). |
| `by_day.{DD}` | `messages`, `tool_calls` e `records_read` por dia (UTC). |

- Uma escrita (incremento atomico) por chamada, sem `await`: medir nunca atrasa nem derruba a resposta (`usage_write_failed` no log).
- Sem telefone, texto de mensagem ou valores financeiros.
- Fica dentro de `users/{uid}`: entra na exportacao de dados e sai na exclusao da conta.
- Onde ver: Configuracoes -> Usuarios do sistema (admin), linha "Consumo no mes" de cada usuario (1 leitura por usuario da pagina).
- O Dashboard nao entra na conta (as leituras dele aparecem no Firebase -> Uso, sem separar por cliente).
- Fora do escopo por enquanto: tokens/custo do modelo de IA (o n8n nao repassa o uso de tokens para a API).
