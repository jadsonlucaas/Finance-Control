# Auditoria De Otimizacao Profissional

Data: 2026-04-17

## Escopo Preservado

O sistema atual foi tratado como produto em operacao. Nenhuma funcionalidade deve ser removida durante a otimizacao. A camada legada segue ativa por compatibilidade e a migracao deve continuar com testes de regressao a cada bloco.

Funcionalidades mapeadas como criticas:

- autenticacao, cadastro e logout;
- dashboard financeiro com filtros por periodo, pessoa, macro e ciclo;
- graficos de gastos diarios, fluxo mensal, categorias e pessoas;
- detalhe de barra do grafico diario;
- listagem, criacao, edicao, exclusao, arquivamento e reabertura de lancamentos;
- marcacao de saida como paga;
- entradas, consolidacao mensal, salario, INSS, IRRF, liquido e quinzena;
- banco de horas, hora extra, DSR e historico salarial;
- categorias, macros, pessoas e configuracoes;
- importacao e remocao de planilhas;
- regras percentuais automaticas;
- planner, feriados e eventos locais/nuvem;
- exportacao PDF;
- sincronizacao localStorage/Firestore;
- ponte global de compatibilidade para scripts e HTML migrados.

## Pontos Fortes

- Build moderno com Vite e chunks separados.
- `index.html` ja esta reduzido para entrada modular unica.
- Cobertura de testes evoluiu bem: dominio, arquitetura, estado, servicos e smoke no navegador.
- Dashboard ja tem modulos dedicados para dados, filtros, cards, graficos e renderizacao.
- Chart.js e Lucide estao em dependencias locais, sem CDN para esses dois pontos centrais.
- Existe camada de compatibilidade global, permitindo migracao incremental sem quebrar a tela.
- Store simples (`appState`) ja sincroniza globais legados importantes.
- Teste smoke cobre fluxo real de dashboard, grafico diario, CRUD, configuracoes, importacao, detalhes e PDF.

## Pontos Fracos E Riscos

- `src/legacy/inline/part-03.js` ainda concentra cerca de 313 KB e e o maior risco de manutencao.
- Parte relevante da UI ainda e gerada por strings e `innerHTML`, exigindo disciplina forte de escape.
- O carregamento legado ainda depende de avaliacao global para preservar semantica classica.
- Firebase ainda e importado por URL remota nos services, fora do bundle npm local.
- Regras de dominio importantes ainda dependem de `window`, DOM ou `localStorage` em alguns modulos de UI/legado.
- Alguns modulos legados sobrescrevem funcoes globais em cadeia, o que dificulta rastrear dono real da regra.
- Persistencia Firestore nao tinha uma camada central de saneamento contra `undefined`.
- Alguns dados de configuracao ainda vivem em localStorage sincronizado, o que funciona, mas exige plano de schema futuro.
- Nao ha schema formal/versionado de registros financeiros.

## Gargalos De Performance

- Carregamento de scripts legados era feito sequencialmente.
- `part-03.js`, `part-29.js` e `vendor-chart` ainda sao os maiores chunks.
- Varios renders ainda reconstroem HTML inteiro.
- Alguns calculos dependem de varreduras em `allRecords`, o que pode ficar pesado com aumento de base.
- Importacoes em massa ja trabalham em chunks, mas ainda passam por bastante logica em UI legada.

## Seguranca E Integridade

- Autenticacao existe, mas a regra de permissao depende bastante do front-end e das regras Firestore fora do repositorio.
- E necessario manter regras de seguranca do Firestore alinhadas com `owner_uid`, `shared_scope` e colecoes globais.
- Dados inseridos pelo usuario devem continuar sendo escapados antes de `innerHTML`.
- A camada de persistencia agora deve descartar `undefined` antes de gravar, evitando falhas silenciosas de documento.
- Recomendado adicionar auditoria de acoes criticas: importacao, exclusao em massa, regras percentuais e alteracao de perfil.

## Diagnostico Arquitetural

Arquitetura atual recomendada para continuidade:

- `src/core`: funcoes puras, sem DOM, sem Firebase, sem `window`.
- `src/domain`: regras financeiras puras ou quase puras.
- `src/services`: Firebase, auth, persistencia, bibliotecas externas, logs e integracoes.
- `src/state`: estado compartilhado e compatibilidade de globais.
- `src/ui`: templates, eventos e renderizacao.
- `src/ui/dashboard`: area modelo para novas migracoes.
- `src/legacy`: ponte e helpers de compatibilidade.
- `src/legacy/inline`: codigo classico ainda em processo de decomposicao.

## Plano De Evolucao Por Prioridade

1. Preservar comportamento e ampliar testes smoke antes de cada refatoracao grande.
2. Quebrar `part-03.js` por dominio: formularios, CRUD, configuracoes, importacao, horas, entradas e categorias.
3. Mover regras financeiras restantes para `src/domain`.
4. Trocar Firebase por dependencia npm local e centralizar contratos em services.
5. Criar schema/normalizador de registro financeiro versionado.
6. Reduzir `innerHTML` dinamico em areas com entrada de usuario.
7. Adicionar logs estruturados e auditoria de acoes criticas.
8. Criar indices/documentacao de Firestore e checklist de regras de seguranca.
9. Adotar lazy loading por area pesada: PDF, importacao, admin/configuracoes e relatorios.
10. Medir performance com baseline antes/depois em cada ciclo.

## Otimizacoes Aplicadas Nesta Entrega

- Carregamento dos scripts legados passou a buscar os chunks em paralelo e executar em ordem fixa.
- Persistencia Firestore passou a sanear registros antes de `create`, `update` e `upsert`.
- Foi criado teste unitario para o saneamento de registros.
- Inventario global foi regenerado em `docs/global-api-inventory.md`.

## Criterios De Nao Regressao

Para considerar uma fase segura:

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run smoke`

Fluxos obrigatorios no smoke:

- app abre;
- login aparece;
- dashboard renderiza;
- troca de mes atualiza graficos;
- grafico diario abre detalhe correto;
- criar, editar, pagar, arquivar, desarquivar e excluir lancamento;
- salvar configuracoes;
- importar saida;
- abrir detalhes de entrada e horas;
- exportar PDF.
