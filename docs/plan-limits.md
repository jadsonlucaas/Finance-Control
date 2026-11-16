# Limites de uso por plano no backend

Etapa 5, item 4. O que cada plano pode fazer é garantido no servidor, não só na tela.

## Gratuito x Premium

Premium significa uma destas três situações:

- cortesia ativa do admin (`whatsapp_comp_access/{uid}.status == 'active'`);
- assinatura do Stripe em `trialing`, `active` ou `past_due` (`billing_subscriptions/{uid}`);
- usuário admin.

A mesma regra está em três lugares:

| Onde | Arquivo | O que bloqueia no Gratuito |
| --- | --- | --- |
| Tela | `src/ui/billing/planGate.js` | Abas Parcelamentos, Importação e Controle de horas; Planner; PDF |
| Regras do Firestore | `firestore.rules` (`hasPremiumAccess`, `isPremiumOnlyNewRecord`) | Criar lançamento `controle_horas` ou lançamento importado (`import_batch_id`) |
| whatsapp-api | `services/whatsapp-api/src/access.js` | Todo o assistente no WhatsApp (`WHATSAPP_ACCESS_MODE=entitlement`) |

As regras barram só a **criação**. Quem voltou ao Gratuito continua vendo, editando e apagando o que criou no Premium.

O que não dá para barrar no servidor, porque roda só no navegador: Planner e PDF (não gravam nada), e a tela de Parcelamentos (as parcelas também podem ser lançadas pelo formulário de saída, que é do Gratuito).

Caso raro: alguém que voltou ao Gratuito e restaura um backup com horas ou lançamentos importados recebe erro de permissão nesses itens.

## Limite diário no WhatsApp (Premium e cortesia)

Este limite controla o custo de IA por cliente. Fica em `services/whatsapp-api/src/dailyLimits.js`.

| Variável | Padrão | Ao passar do limite |
| --- | --- | --- |
| `WHATSAPP_DAILY_MESSAGE_LIMIT` | 100 mensagens/dia | `mensagem/registrar` devolve `limite_atingido: true` e `mensagem`. O n8n responde sem chamar o agente. |
| `WHATSAPP_DAILY_TOOL_LIMIT` | 400 ferramentas/dia | Rotas devolvem 429 `DAILY_LIMIT_REACHED` com a mensagem no idioma do usuário. |

O dia é o dia UTC, o mesmo do consumo em `users/{uid}/usage/{AAAA-MM}.by_day`.

A contagem fica em memória. Quando a API reinicia, ela parte do consumo já gravado no dia. O valor `0` desliga cada limite.

## Rollback

- **Regras:** publicar de novo a versão anterior no console do Firestore.
- **Limite diário:** `WHATSAPP_DAILY_MESSAGE_LIMIT=0` e `WHATSAPP_DAILY_TOOL_LIMIT=0` na stack, ou Re-pull da imagem anterior.
