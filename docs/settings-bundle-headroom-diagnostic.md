# Diagnostico de headroom do modulo Configuracoes

Executado em: 05/09/2026

## Escopo

Esta analise cobre a diferenca entre `8ea85f1` e `696e2fc`, com foco no crescimento do entry apos a modernizacao lazy de Configuracoes. Nao houve alteracao de regra financeira, interface de outros modulos, Firebase real, Firestore Rules, importacoes, Planner, Controle de Horas, Dashboard, tributos, parcelamentos, recorrencias, materializacao percentual ou backup/restore.

## Numeros observados

| Metrica | Antes 5.6 | 5.6 |
| --- | ---: | ---: |
| Entry JS | 418905 bytes | 425874 bytes |
| Crescimento absoluto | - | 6969 bytes |
| Crescimento percentual | - | 1.66% |
| Budget oficial | 430080 bytes | 430080 bytes |
| Headroom | 11175 bytes | 4206 bytes |
| Headroom percentual | 2.60% | 0.98% |

## Causa do crescimento

`src/app.js` passou a instalar `installSettingsLazyLoader(globalThis)`, o que e correto para preservar bridges globais de Configuracoes. Porem, alem do loader leve e da decisao de rota, o mesmo arquivo recebeu helpers especificos da tela:

- `createSettingsAuthContext`;
- `createSettingsReadSource`;
- `readSettingsLocalStorage`;
- `settingsBaseRecord`;
- `settingsReferenceScope`;
- `createSettingsActions`;
- `createSettingsSupplementaryRenderers`.

Esses helpers sao usados apenas quando a aba `configuracoes` e aberta, mas ficaram no bootstrap. Com isso, Configuracoes foi declarada lazy, enquanto parte da composicao web da tela continuou eager.

## Classificacao no build 5.6

| Item | Classificacao 5.6 | Evidencia |
| --- | --- | --- |
| `settingsActiveUi.js` | async settings chunk | `dist/assets/settingsActiveUi-CzqGTLk_.js` |
| `settingsController.js` | async settings chunk | carregado por `settingsActiveUi` |
| `settingsPresenter.js` | async settings chunk | carregado por `settingsController` |
| `settingsReadModel.js` | async settings chunk | carregado por `settingsController` |
| `loadSettingsActiveUi.js` | async loader chunk | `dist/assets/loadSettingsActiveUi-CpPNdGq7.js` |
| composicao web de leitura/acoes/suplementos | entry | funcoes dentro de `src/app.js` |

## Imports e dependencias

`src/app.js` nao passou a importar estaticamente `settingsActiveUi`, `settingsController`, `settingsPresenter` ou `settingsReadModel`. O import de Configuracoes permaneceu dinamico por `import('./ui/settings/loadSettingsActiveUi.js')`.

O problema nao foi import eager direto desses modulos, mas codigo settings-only escrito no proprio entry. As dependencias compartilhadas continuaram em chunks proprios, como `app-resilience`, `vendor-chart`, `vendor-icons` e `referenceData`, sem mudanca em `vite.config.js`, `scripts/bundle-budget.mjs` ou `docs/performance-budget.md`.

## Risco identificado

O helper `settingsReferenceScope` convertia qualquer tentativa nao autorizada de `global` para `personal`. Esse comportamento evitava gravacao global por usuario comum, mas escondia a intencao original do payload. A correcao desta etapa deve rejeitar `global` sem autorizacao na camada de aplicacao e manter `personal` como default somente quando o contrato permitir ausencia de escopo.

## Correcao planejada

- Mover a composicao web de Configuracoes para modulo lazy.
- Manter no entry apenas a decisao de rota e a chamada do loader dinamico.
- Criar contrato puro de resolucao de escopo, sem DOM, `window` ou Firebase.
- Reforcar `bundle:budget` e `settings-modernization:check` para detectar retorno de codigo settings-only ao entry.
- Preservar budget oficial em `430080` bytes.

## Resultado corretivo 5.6A

Executado em: 05/09/2026

| Metrica | Antes 5.6 | 5.6 | 5.6A |
| --- | ---: | ---: | ---: |
| Entry | 418905 bytes | 425874 bytes | 420552 bytes |
| Budget | 430080 bytes | 430080 bytes | 430080 bytes |
| Headroom | 11175 bytes | 4206 bytes | 9528 bytes |
| Headroom % | 2.60% | 0.98% | 2.22% |
| Globals | 50 | 50 | 50 |
| Classic/eval | 33/33 | 33/33 | 33/33 |

A correcao moveu `createSettingsReadSource`, `createSettingsActions`, `settingsBaseRecord`, `createSettingsSupplementaryRenderers` e o novo contrato `resolveReferenceWriteScope` para chunks assincronos de Configuracoes. O entry final permaneceu abaixo do budget oficial, recuperando `5322` bytes de headroom em relacao a 5.6, sem elevar limite.

O entry 5.6A ficou `552` bytes acima da meta operacional preferida de `420000` bytes. Essa diferenca foi aceita porque a meta obrigatoria e o budget oficial foram atendidos, e remover fallback legado ou reporte resiliente apenas para atingir a preferencia reduziria protecao operacional.
