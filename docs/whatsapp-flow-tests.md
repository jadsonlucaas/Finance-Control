# Testes automatizados do fluxo WhatsApp

Etapa 5, item 5. Estes testes simulam o caminho n8n → whatsapp-api, sem chamar a IA.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `tests/fixtures/n8n/finance-control-agent.json` | Cópia, sem credenciais, das partes do n8n que falam com a API (veja abaixo). |
| `tests/services/whatsappApi/n8nFlowHarness.js` | Executa essas expressões e esse código como o n8n faria. O teste faz o papel da IA. |
| `tests/services/whatsappApi/whatsappFlow.test.js` | Testes de contrato e de conversas. |

Partes do n8n copiadas para o fixture:

- o fluxo principal `finance-control-ia-dev`:
  - "Registrar mensagem";
  - os gates "Mensagem nova?", "É código de vínculo?" e "Vinculado?";
  - as chamadas de vínculo;
  - as ferramentas do agente: rota e `parametros` com `$fromAI`;
- o sub-workflow `finance-control-tool-api`:
  - "Valida e monta pedido";
  - "Formata resposta".

## O que é coberto

- **Contrato:** cada ferramenta do agente aponta para uma rota da lista `ROTAS` do n8n, e essa rota existe na API. Campos vazios da IA são removidos. Telefone e conta nunca vêm da IA. Erros chegam ao agente como `{ ok: false, erro }`.
- **Conversas:**
  - mensagem repetida pelo Chatwoot;
  - número novo → código do app → vinculado;
  - conta sem Premium;
  - cadastro direto e "sim" repetido sem duplicar;
  - compra parcelada;
  - marcar pago com confirmação;
  - cancelar;
  - contas a vencer, incluindo atrasadas antigas;
  - orçamento;
  - parar alertas.

Os testes rodam no `npm test` e no CI ("Quality gates").

## Quando mudar o n8n

Toda mudança no n8n que mexe nestas partes exige atualizar o fixture no mesmo PR:

- o prompt não entra no fixture;
- entram as ferramentas, os `$fromAI`, a lista `ROTAS` e os gates.

No fixture, `source.main.versionId` e `source.toolApi.versionId` dizem de qual versão publicada a cópia foi tirada.

A forma mais simples de atualizar é pedir ao Claude (MCP do n8n) para regenerar o arquivo a partir da versão publicada.

## Limites

- A IA não é testada: escolher a ferramenta certa depende do modelo e do prompt.
- O envio pelo Chatwoot e a assinatura HMAC do webhook não são testados aqui.
- A ferramenta antiga `consultar_despesas_mes` usa outra API (`financecontrolapi_readonly_dev`) e não está no fixture.
