/**
 * Gera src/i18n/pt-BR.js: correcoes de acentuacao para os textos da tela em portugues.
 *
 * O texto-fonte antigo do app foi escrito sem acentos ("Saidas", "Visao estrategica").
 * As chaves do dicionario em espanhol sao exatamente esses textos; aqui cada chave ganha
 * a grafia correta, palavra por palavra, a partir da lista ACCENTS abaixo. Assim a tela em
 * pt-BR mostra "Saídas" sem trocar o texto-fonte (que segue como chave das traducoes).
 *
 * Uso: node scripts/build-pt-br-display-catalog.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ES_ES } from '../src/i18n/es-ES.js';

// Somente palavras sem ambiguidade (ex.: "esta"/"está" e "e"/"é" ficam de fora).
export const ACCENTS = Object.freeze({
  acao: 'ação', acoes: 'ações', alteracao: 'alteração', alteracoes: 'alterações', analise: 'análise',
  apos: 'após', aprovacao: 'aprovação', ate: 'até', atencao: 'atenção', automatico: 'automático',
  automatica: 'automática', automaticos: 'automáticos', automaticas: 'automáticas', autorizacao: 'autorização',
  bancaria: 'bancária', bancarias: 'bancárias', bancario: 'bancário', bancarios: 'bancários', basico: 'básico',
  cartao: 'cartão', cartoes: 'cartões', codigo: 'código', comparacao: 'comparação', competencia: 'competência',
  competencias: 'competências', concluida: 'concluída', concluido: 'concluído', condicao: 'condição',
  conexao: 'conexão', configuracao: 'configuração', configuracoes: 'configurações', confianca: 'confiança',
  conteudo: 'conteúdo', credito: 'crédito', creditos: 'créditos', debito: 'débito', debitos: 'débitos',
  descricao: 'descrição', disponivel: 'disponível', disponiveis: 'disponíveis', distribuicao: 'distribuição',
  estrategica: 'estratégica', estrategico: 'estratégico', evolucao: 'evolução', excluida: 'excluída',
  excluido: 'excluído', exclusao: 'exclusão', frequencia: 'frequência', grafico: 'gráfico', graficos: 'gráficos',
  gravacao: 'gravação', historico: 'histórico', historicos: 'históricos', horarios: 'horários', icone: 'ícone',
  importacao: 'importação', importacoes: 'importações', informacoes: 'informações', inicio: 'início',
  integracao: 'integração', invalida: 'inválida', invalido: 'inválido', ja: 'já', lancamento: 'lançamento',
  lancamentos: 'lançamentos', lancar: 'lançar', logica: 'lógica', maximo: 'máximo', media: 'média',
  medio: 'médio', mes: 'mês', minimo: 'mínimo', nao: 'não', necessario: 'necessário', necessaria: 'necessária',
  numero: 'número', observacao: 'observação', operacao: 'operação', opcao: 'opção', opcoes: 'opções',
  orcamento: 'orçamento', orcamentos: 'orçamentos', padrao: 'padrão', pagina: 'página', pendencia: 'pendência',
  pendencias: 'pendências', periodo: 'período', periodos: 'períodos', permissao: 'permissão', possivel: 'possível',
  possiveis: 'possíveis', previa: 'prévia', projecao: 'projeção', proxima: 'próxima', proximas: 'próximas',
  proximo: 'próximo', proximos: 'próximos', rastreaveis: 'rastreáveis', recorrencia: 'recorrência',
  recorrencias: 'recorrências', referencia: 'referência', relatorio: 'relatório', relatorios: 'relatórios',
  remocao: 'remoção', responsavel: 'responsável', revisao: 'revisão', saida: 'saída', saidas: 'saídas',
  salario: 'salário', saude: 'saúde', selecao: 'seleção', serie: 'série', servico: 'serviço', sessao: 'sessão',
  situacao: 'situação', so: 'só', superfluos: 'supérfluos', tambem: 'também', tatico: 'tático', termino: 'término',
  titulo: 'título', transacao: 'transação', transacoes: 'transações', ultima: 'última', ultimas: 'últimas',
  ultimo: 'último', ultimos: 'últimos', unico: 'único', usuario: 'usuário', usuarios: 'usuários',
  valido: 'válido', validos: 'válidos', valida: 'válida', variavel: 'variável', variaveis: 'variáveis',
  versao: 'versão', visao: 'visão', voce: 'você'
});

function withCase(source, accented) {
  if (source === source.toUpperCase() && source.length > 1) return accented.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return accented[0].toUpperCase() + accented.slice(1);
  return accented;
}

export function accentuate(text) {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const accented = ACCENTS[word.toLowerCase()];
    return accented ? withCase(word, accented) : word;
  });
}

export function buildCatalog(keys) {
  const entries = {};
  for (const key of [...keys].sort()) {
    const fixed = accentuate(key);
    if (fixed !== key) entries[key] = fixed;
  }
  return entries;
}

function render(entries) {
  const lines = Object.entries(entries).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  return `/**
 * Portugues (Brasil): grafia correta dos textos antigos escritos sem acento.
 * ARQUIVO GERADO por scripts/build-pt-br-display-catalog.mjs a partir das chaves do es-ES.
 * Nao edite a mao: ajuste a lista ACCENTS no script e rode \`npm run i18n:pt-br\`.
 */
const messages = {
${lines.join('\n')}
};

export const PT_BR = Object.freeze({ messages: Object.freeze(messages), patterns: Object.freeze([]) });
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const target = new URL('../src/i18n/pt-BR.js', import.meta.url);
  const output = render(buildCatalog(Object.keys(ES_ES.messages)));
  if (process.argv.includes('--check')) {
    const current = readFileSync(target, 'utf8');
    if (current !== output) {
      console.error('src/i18n/pt-BR.js desatualizado: rode npm run i18n:pt-br');
      process.exit(1);
    }
    console.log('pt-BR display catalog OK');
  } else {
    writeFileSync(target, output);
    console.log(`pt-BR display catalog: ${Object.keys(buildCatalog(Object.keys(ES_ES.messages))).length} textos`);
  }
}
