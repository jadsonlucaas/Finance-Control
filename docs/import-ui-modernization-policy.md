# Politica de modernizacao da UI de importacao

Executado em: 06/09/2026

## Escopo

Esta politica cobre somente a interface ativa local de importacao financeira. A etapa conecta a tela de Importacao aos contratos modernos ja existentes sem alterar regras financeiras, parser canonico, Firestore Rules, autenticacao, Dashboard, Entradas, Saidas, Parcelamentos, Controle de Horas, Planner, Configuracoes, Administracao de Usuarios, backup/restore, tributos, recorrencias ou canais externos.

Nao fazem parte desta etapa: Firebase real, deploy, push, PR, WhatsApp, webhook, provider externo, telefone, Admin SDK, migracao de dados ou publicacao.

## Fronteira moderna

O caminho ativo de XLSX passa por:

1. `src/ui/imports/loadImportActiveUi.js`
2. `src/ui/imports/importActiveUi.js`
3. `src/ui/imports/importController.js`
4. `src/application/imports/spreadsheetImportParser.js`
5. `PrepareImportBatch`
6. `src/application/readModels/importPreviewReadModel.js`
7. `src/ui/imports/importPresenter.js`
8. `CommitImportBatch`

O controller nao pode chamar `window.dataSdk`, Firebase Web SDK, `create/update` direto nem recriar regra de parsing, fingerprint ou deduplicacao. Persistencia continua concentrada em `CommitImportBatch`, com `createMany` por lote atomico.

## Preview

O preview deve exibir grupos derivados diretamente do pipeline:

- `ready`;
- `invalid`;
- `duplicate_in_file`, `already_imported` e `legacy_match` como duplicidades;
- `conflict`;
- linhas ignoradas ou vazias;
- warnings do parser/preparo.

Somente candidatos `ready` podem ser enviados ao commit. A UI nao corrige linha silenciosamente, nao mascara conflito como duplicidade e nao transforma mensagem visual em regra de dominio.

## Idempotencia e resposta incerta

O commit preserva `batch_id`, `idempotency_key`, `correlation_id`, `file_fingerprint` e lista de candidatos prontos. Clique duplo no botao de commit e bloqueado pelo controller. Replay do mesmo batch deve passar por `CommitImportBatch`/receipts e nao duplicar registros.

Antes de reenviar uma tentativa existente, o controller chama `ReconcileMutationAttempt` quando ha contexto tecnico suficiente. Se a confirmacao for perdida e o contrato nao permitir conclusao total, o estado deve ser tratado como incerto e o preview deve permanecer visivel para suporte/retry seguro. Nunca gerar automaticamente novo batch para resolver incerteza.

## Estado e isolamento

Erros de validacao, parse, lazy-load, rede ou commit preservam preview/metadata quando isso e seguro. Troca de usuario limpa arquivo selecionado, preview, batch e tentativa em memoria. Nenhum arquivo bruto ou cache de batch pode ser compartilhado entre owners.

## Lazy loading

`src/app.js` instala somente um loader leve para Importacao. A UI ativa, presenter, controller, read model, renderer legado de compatibilidade e parser XLSX carregam sob demanda. A biblioteca XLSX deve ser carregada somente quando o usuario selecionar/importar planilha.

Guardrails obrigatorios:

- budget oficial de Entry JS: `430080` bytes;
- APIs globais: `<= 50`;
- scripts classicos/eval: `<= 33/33`;
- nenhum novo `eval`;
- `npm run import-ui-modernization:check` deve retornar `ok: true` e `wrote: false`.

## Bridges preservadas

As bridges legadas de importacao permanecem por compatibilidade enquanto houver consumidores classicos. A modernizacao redireciona `renderImportacao` pelo loader lazy, mas nao remove os scripts legados nem autoriza retirada de `part-03.js`, `part-08.js` ou `src/ui/importacao.js`.

Qualquer remocao futura exige busca completa de consumidores, testes Playwright/smoke especificos, validacao de bundle e preservacao temporaria de bridge global quando houver consumo legado.
