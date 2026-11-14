# Privacidade: inventário, retenção e direitos do titular

Etapa 4 da checklist (LGPD / RGPD). Este documento é a referência técnica: onde fica cada dado pessoal, por quanto tempo, como é limpo, e como exportação e exclusão cobrem cada sistema. Ao criar uma coleção ou integração nova com dado de usuário, atualize este arquivo, `ACCOUNT_DATA_LOCATIONS` (`services/whatsapp-api/src/accountDeletion.js`), `exportAccountData` (stores da whatsapp-api) e `tests/firestore/account-isolation-rules.test.js`.

O texto para o usuário fica em `public/legal/privacidade.html` (seção 5). Se um prazo mudar aqui, mude lá também e suba `PRIVACY_VERSION`.

## Inventário e prazos

| Sistema | Dado | Prazo | Limpeza | Exclusão de conta | Exportação |
|---|---|---|---|---|---|
| Firebase Auth | e-mail, senha (hash do Google) | enquanto a conta existir | — | apagado | e-mail no cabeçalho |
| Firestore `users/{uid}` e subcoleções | perfil, lançamentos, orçamentos, `local_storage`, auditoria própria, recibos de idempotência, ações pendentes do WhatsApp | enquanto a conta existir; ações pendentes expiram em 10 min | — | `recursiveDelete` (pega subcoleções futuras) | todas as subcoleções |
| Firestore `user_onboarding/{uid}` | nome, país, telefone, idioma, moeda, fuso, aceite de mensagens | enquanto a conta existir | — | apagado | sim |
| Firestore `notification_settings/{uid}` + `consent_events` | preferências e histórico do consentimento de alertas | enquanto a conta existir | — | apagado | sim |
| Firestore `legal_consents/{uid}` + `events` | versões aceitas de Termos/Privacidade, data, origem, idioma | enquanto a conta existir | — | apagado | sim |
| Firestore `notification_state`, `notification_deliveries`, `notification_messages` | estado e textos dos alertas enviados | mensagens 30 dias; chaves de repetição 120 dias | API a cada 6 h (`expires_at`) | apagado | sim |
| Firestore `whatsapp_links`, `whatsapp_comp_access` | telefone vinculado, cortesia | enquanto a conta existir | — | apagado | sim |
| Firestore `whatsapp_link_codes`, `whatsapp_link_attempts` | códigos de vínculo, tentativas (hash do telefone) | código expira em minutos | — | apagado | não (segurança) |
| Firestore `whatsapp_inbound_messages` | hash da mensagem e do telefone (sem texto) | 3 dias | API a cada 6 h | expira sozinho | não (sem dado legível) |
| Firestore `billing_*` | assinatura, id de cliente Stripe | enquanto a conta existir | — | apagado | assinatura |
| Firestore `account_deletions` | hash do uid, contagens, data | permanente (auditoria) | — | é o registro da exclusão | — |
| Firestore audit de admins / referências compartilhadas | citações à conta | enquanto existir | — | anonimizado (`conta-excluida`) | — |
| Stripe | cliente, assinatura, faturas | faturas: prazo fiscal (Stripe) | — | cliente apagado, assinatura cancelada | id na seção assinatura |
| Chatwoot (eurochat) | contato (nome, telefone), conversas e mensagens | enquanto a conta existir | — | contatos com os telefones da conta apagados (o Chatwoot apaga as conversas junto) quando `CHATWOOT_API_*` está configurado | conversas e mensagens públicas (sem notas privadas), até 2000 mensagens |
| n8n | execuções | sucesso: não salvas; erro: até 7 dias | `EXECUTIONS_DATA_PRUNE=true`, `MAX_AGE=168` | expira sozinho | não |
| n8n agente | memória de curto prazo (`memoryBufferWindow`) | últimas mensagens, em RAM | reinício do processo | expira sozinho | não |
| Supabase `finance-control-ia-memory` | memória antiga do agente (`assistente_privado.contexto_conversa`, `expira_em`) | projeto **pausado** | — | **se for reativado**, incluir exclusão e exportação aqui antes de usar | — |
| OpenAI | texto da conversa enviado para gerar a resposta | política do fornecedor (API: sem treino) | — | fora do nosso controle | — |
| whatsapp-api (logs do container) | rota, status, `phone_hash`, duração; nunca telefone ou valores | rotação do Docker (ver pendências) | Docker | — | — |
| Navegador | sessão do Firebase, preferências de tela | até sair / limpar o navegador | logout limpa dados da conta | — | — |

## Exportação (`acao: exportar_dados`)

- Endpoint: mesmo relay do checkout (`finance-control-billing` no n8n → `POST /internal/billing`).
- Só a própria conta, com ID token do Firebase conferido no servidor. Limite: 3 por 10 min por conta.
- Resposta: `secoes` (tudo acima marcado "sim") + `lancamentos_csv` (`;` e decimal com vírgula). O Dashboard salva `meus-dados-AAAA-MM-DD.json` e `lancamentos-AAAA-MM-DD.csv` (es: `mis-datos` / `movimientos`).
- Chatwoot fora do ar não impede a exportação: a seção diz `situacao: indisponivel`.

## Exclusão

Ordem e garantias em `services/whatsapp-api/src/accountDeletion.js`. O Chatwoot vem antes do Firestore (os telefones saem dele); falha no Chatwoot deixa a conta bloqueada e a nova tentativa refaz. Sem Chatwoot configurado, a exclusão segue e o registro em `account_deletions` diz `chatwoot: nao_configurado`.

### Configuração do Chatwoot na whatsapp-api

| Variável | Exemplo |
|---|---|
| `CHATWOOT_API_URL` | `https://eurochat.financecontrol.tech` |
| `CHATWOOT_ACCOUNT_ID` | `3` |
| `CHATWOOT_API_TOKEN_FILE` | `/run/secrets/financecontrol_chatwoot_api_token_v1` |

O token é o "Access Token" de um usuário administrador do Chatwoot (Perfil → Access Token). O header vai como `api-access-token` (o proxy descarta headers com `_`).

## Isolamento

- `tests/firestore/account-isolation-rules.test.js`: outra conta não lê, grava nem apaga nenhum caminho com dado pessoal; sem login nada é lido; consultas amplas falham.
- `tests/firestore/privacy-store-emulator.test.js`: exportação traz só a conta pedida; exclusão não toca a outra conta.
- `tests/services/whatsappApi/privacyRights.test.js`: exportação e exclusão pela rota, incluindo Chatwoot.

## Pendências

- Configurar rotação dos logs do Docker no servidor (`max-size`/`max-file`) e registrar o prazo aqui.
- Textos legais: validação jurídica e dados da empresa (`[RAZÃO SOCIAL]`, e-mail de privacidade).
- Supabase: decidir entre apagar o projeto pausado ou integrá-lo à exclusão/exportação antes de reativar.
