# Politica de modernizacao de Configuracoes

Data: 04/09/2026

## Objetivo

Configurar a tela ativa de Configuracoes como composicao modular: `settingsActiveUi -> settingsController -> settingsReadModel -> settingsPresenter`, preservando comportamento legado, permissoes e contratos.

## Permitido

- Ler registros ja autorizados por repositorio ou fonte injetada.
- Renderizar Pessoas, Categorias Macro, Categorias Personalizadas e resumo das secoes legadas.
- Delegar criacao/edicao/exclusao para acoes injetadas pela composition root.
- Manter bridges globais legadas enquanto houver consumidores classicos.
- Carregar UI moderna de Configuracoes sob demanda apos o legacy loader.

## Proibido

- Usar Firebase, `dataSdk` ou `window.financeApp` dentro de read model, controller ou presenter como regra de negocio.
- Autoelevar usuario comum para admin.
- Converter referencia global em pessoal silenciosamente.
- Recalcular regra percentual, materializar ocorrencia ou alterar historico pago.
- Recalcular INSS/IRRF ou reprocessar historico tributario.
- Criar novo global, novo eval, WhatsApp, webhook, provider externo, telefone ou Admin SDK.
- Aumentar o budget oficial de `430080` bytes.

## Compatibilidade

`part-03.js`, `part-09.js` e `part-29.js` permanecem carregados. A UI moderna deve ser idempotente, nao duplicar handlers e voltar ao fallback legado se o chunk falhar.

## Correcao 5.6A - escopo e lazy real

Data: 05/09/2026

- A composicao web de Configuracoes saiu de `src/app.js` e passou para `src/ui/settings/settingsWebAdapter.js`, carregada por `loadSettingsActiveUi.js`.
- `src/app.js` mantem apenas a decisao de rota, bridge/fallback e import dinamico.
- `resolveReferenceWriteScope` define o contrato puro de escopo sem DOM, `window` ou Firebase.
- Usuario comum com payload `global` e rejeitado, sem fallback silencioso para `personal`.
- `personal` continua sendo default apenas quando o escopo e omitido em operacoes cujo contrato permite esse default.
- `scripts/bundle-budget.mjs` e `scripts/settings-modernization-check.mjs` falham se codigo settings-only voltar ao entry ou se o budget oficial deixar de ser `430080` bytes.
