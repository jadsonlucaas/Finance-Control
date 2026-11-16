import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Simulador do caminho n8n -> whatsapp-api, sem IA (Etapa 5, item 5).
 *
 * Usa as expressoes e o codigo copiados do n8n em tests/fixtures/n8n/finance-control-agent.json:
 * - "Registrar mensagem" + gate "Mensagem nova?";
 * - gates "É código de vínculo?" e "Vinculado?", e as chamadas de vinculo;
 * - cada ferramenta do agente: monta `parametros` com $fromAI, passa pelo "Valida e monta pedido"
 *   do finance-control-tool-api, chama a API e formata com "Formata resposta".
 * O teste faz o papel da IA escolhendo a ferramenta e os argumentos.
 */
const FIXTURE_PATH = fileURLToPath(new URL('../../fixtures/n8n/finance-control-agent.json', import.meta.url));

export function loadAgentFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

/** Avalia um campo do n8n: '={{ expr }}' (expressao), '=texto' (texto) ou literal. */
export function evaluateN8nValue(value, scope) {
  const text = String(value ?? '');
  const match = text.match(/^=\{\{([\s\S]*)\}\}$/);
  if (match) {
    const names = Object.keys(scope);
    // eslint-disable-next-line no-new-func
    return new Function(...names, `return (${match[1]});`)(...names.map((name) => scope[name]));
  }
  return text.startsWith('=') ? text.slice(1) : text;
}

/** Executa um no Code do n8n (modo "uma vez para todos os itens"). */
export function runN8nCode(jsCode, inputJson, extraScope = {}) {
  const $input = { first: () => ({ json: inputJson }), all: () => [{ json: inputJson }] };
  const names = ['$input', ...Object.keys(extraScope)];
  // eslint-disable-next-line no-new-func
  const result = new Function(...names, jsCode)($input, ...Object.values(extraScope));
  return result[0].json;
}

/**
 * Cria a conversa de um telefone. app = createApp(...) da whatsapp-api.
 * webhook: { telefone, accountId } como o "Edit Fields" do fluxo principal entrega.
 */
export function createN8nConversation({ app, apiKey, telefone, accountId = 3, fixture = loadAgentFixture() }) {
  let lastMessage = { id: '0', text: '' };
  const toolsByName = new Map(fixture.tools.map((tool) => [tool.name, tool]));

  const $ = (nodeName) => {
    if (nodeName === 'Edit Fields') {
      return { first: () => ({ json: { telefone_remetente: telefone, account_id: String(accountId), mensagem: lastMessage.text } }) };
    }
    if (nodeName === 'Webhook') return { first: () => ({ json: { body: { id: lastMessage.id } } }) };
    throw new Error(`No nao simulado: ${nodeName}`);
  };

  async function post(path, body) {
    return app.handle({ method: 'POST', path, headers: { 'x-api-key': apiKey }, body });
  }

  /** Sub-workflow finance-control-tool-api: valida, chama a API e formata. */
  async function toolApi(rota, parametros) {
    const pedido = runN8nCode(fixture.toolApi.validaEMontaPedido, { telefone, accountId, rota, parametros });
    const response = await post(`/internal/whatsapp/${pedido.rota}`, pedido.body);
    return { ...runN8nCode(fixture.toolApi.formataResposta, { statusCode: response.status, body: response.body }), statusCode: response.status, request: pedido.body };
  }

  return {
    /** Nova mensagem do Chatwoot: registra e diz se o fluxo segue (gate "Mensagem nova?"). */
    async receive(text, id) {
      lastMessage = { id: String(id), text: String(text) };
      const body = JSON.parse(evaluateN8nValue(fixture.registrarMensagem.jsonBody, { $ }));
      const response = await post('/internal/whatsapp/mensagem/registrar', body);
      const nova = evaluateN8nValue(fixture.gates.mensagemNova, { $json: { statusCode: response.status, body: response.body } });
      return { nova, response, isLinkCode: evaluateN8nValue(fixture.gates.codigoVinculo, { $ }) };
    },

    /** "Confirmar vínculo" (quando a mensagem e um codigo). */
    async confirmLink() {
      const call = fixture.linkCalls.confirmar;
      return toolApi(call.rota, evaluateN8nValue(call.parametros, { $ }));
    },

    /** "Status do vínculo" + gate "Vinculado?". */
    async linkStatus() {
      const call = fixture.linkCalls.status;
      const result = await toolApi(call.rota, evaluateN8nValue(call.parametros, { $ }));
      return { ...result, vinculado: evaluateN8nValue(fixture.gates.vinculado, { $json: result }) };
    },

    /** O agente chama uma ferramenta. args = o que a IA preencheria em cada $fromAI. */
    async tool(name, args = {}) {
      const tool = toolsByName.get(name);
      if (!tool) throw new Error(`Ferramenta desconhecida no fixture: ${name}`);
      const $fromAI = (key, _description, type = 'string', fallback) => {
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          const value = args[key];
          return type === 'string' && value && typeof value === 'object' ? JSON.stringify(value) : value;
        }
        return fallback;
      };
      return toolApi(tool.rota, evaluateN8nValue(tool.parametros, { $, $fromAI }));
    },

    /** Chaves que a IA pode preencher em cada ferramenta (lidas das chamadas $fromAI). */
    fromAiKeys(name) {
      const tool = toolsByName.get(name);
      return [...String(tool?.parametros || '').matchAll(/\$fromAI\('([^']+)'/g)].map((item) => item[1]);
    }
  };
}
