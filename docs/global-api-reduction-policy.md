# Politica de reducao de APIs globais

Gerado em: 22/08/2026

Esta politica orienta a reducao incremental de globais do legado sem romper a aplicacao web atual e sem bloquear a futura reutilizacao por backend confiavel.

## Regra para novas funcionalidades

Nenhuma nova funcionalidade de dominio/aplicacao pode ser criada diretamente em `window`.
Se compatibilidade exigir bridge, a implementacao canonica deve existir fora de `window` e a bridge deve ser documentada/testada.

## Conceitos

- Implementacao canonica: codigo fonte unico do comportamento. Para regras financeiras, fica em `src/domain`; para casos de uso, fica em `src/application`; para infraestrutura, fica em `src/services` ou repositorios.
- Bridge: exposicao temporaria em `window` que delega para uma implementacao canonica. Bridge nao contem regra de negocio.
- Colisao: tentativa de definir a mesma API global por duas origens canonicas diferentes.
- Consumidor legado: chamada em script classico, handler inline, template string, chamada dinamica por nome ou smoke que ainda exige `window`.
- Consumidor moderno: modulo ES que pode importar a implementacao diretamente.

## O que pode ser global temporariamente

- Renderizadores e handlers ainda chamados por scripts classicos.
- Bridges de calculos antigos enquanto `part-03`, `part-04`, `part-05`, `part-06`, `part-08`, `part-16`, `part-20`, `part-28` e `part-29` ainda existirem no loader classico.
- Estado de compatibilidade que scripts legados leem diretamente, como cache, aba ativa e dados de dashboard.
- Adaptadores visuais que ainda dependem do DOM da aplicacao web.

## O que nunca deve ser global

- Nova regra financeira, tributaria, de jornada, parcelamento, recorrencia ou importacao.
- Novo caso de uso de aplicacao.
- Logica de autorizacao.
- Acesso direto a Firebase real, Admin SDK, webhook, WhatsApp, telefone ou provedor externo.
- Codigo necessario para backend futuro.

## Instalacao de bridges

- Bridges novas devem usar `defineLegacyGlobalBridge`.
- A instalacao deve ser idempotente.
- A origem canonica deve ser registrada.
- Em teste/dev, sobrescrita incompativel deve falhar.
- Quando uma bridge existir apenas para consumidor legado, o consumidor deve ser listado no diagnostico.
- Quando o ultimo consumidor for migrado para import, a bridge deve ser removida e o inventario regenerado.

## Criterios para remover uma global

Uma API global so pode ser removida quando:

- busca estatica nao encontra consumidor legado;
- nao ha handler inline, template string ou chamada dinamica conhecida;
- consumidor moderno usa import explicito;
- ha teste cobrindo o comportamento substituto;
- `npm run smoke`, Playwright e inventario passam;
- a remocao nao reduz compatibilidade de bridge ainda usada.

## Relacao com backend futuro

Backend futuro deve importar dominio, casos de uso e repositorios por modulos. Ele nao deve carregar `src/legacy/classicScripts.js`, `src/legacy/inline/*`, `window.financeApp`, `window.financeEvents` ou qualquer bridge global. Nenhum canal externo muda regra de negocio.
