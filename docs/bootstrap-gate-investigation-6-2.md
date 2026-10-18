# Investigacao do gate de bootstrap 6.2A

Executado em: 12/09/2026

## Estado inicial preservado

- Diretorio: `C:\Users\jadso\Downloads\Finance-Control-New-main`
- Branch: `melhoria-arquitetura`
- HEAD inicial: `a9d70d1 fix: corrige validacao do pagamento de parcelas nas rules`
- Remote: vazio
- Worktree sujo esperado e preservado.
- Backup local temporario criado em `C:\Users\jadso\AppData\Local\Temp\finance-control-6-2A-backup-20260912-184159`.

Arquivos pendentes preservados antes da investigacao:

- `docs/global-api-inventory.md`
- `docs/project-validation-checkpoint.md`
- `docs/regression-test-matrix.md`
- `playwright.e2e-local.config.js`
- `tests/playwright/integration-local-recurrences.spec.js`

Hashes SHA-256 iniciais:

| Arquivo | SHA-256 |
| --- | --- |
| `docs/global-api-inventory.md` | `D83EC2A327EB5CA54F07497279010927DE3C32059382E33C2EDE8BF7BAC56DC5` |
| `docs/project-validation-checkpoint.md` | `6946CA64F2509377C85B9C59170CF304EA3041D147BF203B7DD2F90C010FD124` |
| `docs/regression-test-matrix.md` | `683E35C919482683C0E25B5CFD678E044C914E780872CF154AC510743954542F` |
| `playwright.e2e-local.config.js` | `2388F8AA935EBD038262B8EFB2A0CF12B5FA8314EB81C112A529B9CE08E5847E` |
| `tests/playwright/integration-local-recurrences.spec.js` | `F19D261399F56DA44A55F7C9711AB474FA307196374D40F0DADCF767600D72D3` |

## Falha original investigada

O checkpoint 6.2 registrava:

- `npm.cmd run bootstrap:benchmark`: reprovado.
- `FAIL:app_bootstrap_ms:342>149.34`
- `FAIL:first_screen_ready_ms:364.15>185.94`

O comparador em `scripts/bootstrap-benchmark.mjs` avalia `preview.summary.warm[metric].median`, logo os valores `342ms` e `364.15ms` pertencem ao cenario `vite preview`, serie `warm`, estatistica `median`.

Baseline usada:

| Metrica | Chave da baseline | Valor | Tolerancia de falha | Limite |
| --- | --- | ---: | ---: | ---: |
| `app_bootstrap_ms` | `appBootstrapMedianMs` | `124.45` | `+20%` | `149.34` |
| `first_screen_ready_ms` | `firstScreenMedianMs` | `154.95` | `+20%` | `185.94` |

Nao foi encontrada mistura cold/warm no avaliador: a funcao `evaluateRegression()` compara explicitamente `summary?.warm?.[metric]?.median` contra as chaves versionadas da baseline.

## Escopo do diff e equivalencia de runtime

Antes da correcao de tooling, o diff pendente da etapa 6.2 tocava somente documentacao, configuracao E2E e teste Playwright. Nao havia diff em:

- `src`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `scripts/bootstrap-benchmark.mjs`
- `scripts/bootstrap-check.mjs`
- `docs/bootstrap-performance-baseline.json`
- `docs/performance-budget.md`

Conclusao: a homologacao de recorrencias nao alterava o runtime entregue ao navegador nem o bundle medido pelo benchmark.

## Ambiente confirmado

- Node: `v24.14.1`
- npm: `11.11.0`
- Playwright: `1.59.1`
- Build: `vite build`, Vite `v6.4.2`
- Entry medido: `dist/assets/app-BsMEk2PW.js`, `375264` bytes
- Budget oficial: `430080` bytes
- Benchmark: `vite preview` em `http://127.0.0.1:5177/` como gate; Vite dev em `http://127.0.0.1:5178/` apenas comparativo
- Cold: novo browser context por amostra
- Warm: mesmo browser context apos uma navegacao warmup
- Amostras: 10 cold + 10 warm
- Baseline: `docs/bootstrap-performance-baseline.json`, `sourceCommit=095b3fa`

## Plano de coleta

1. Preservar worktree 6.2 sujo e arquivos nao versionados.
2. Conferir diff efetivo e portas locais.
3. Executar uma campanha controlada do benchmark com portas livres.
4. Identificar defeitos de tooling/ambiente sem alterar baseline, tolerancias ou budget.
5. Corrigir somente tooling se a causa fosse reproduzida.
6. Reexecutar jornadas financeiras emuladas.
7. Executar campanha final do benchmark apos as suites e confirmar ausencia de servidores orfaos.

## Campanhas e resultados

Campanha controlada antes da correcao de tooling:

- Saida bruta: `docs/bootstrap-benchmark-6-2A-last-output.json`
- Resultado: `ok=true`, `status=ok`, sem violacoes
- Preview warm `app_bootstrap_ms`: `89.65ms`
- Preview warm `first_screen_ready_ms`: `115ms`
- Preview cold `app_bootstrap_ms`: `255.8ms`
- Preview cold `first_screen_ready_ms`: `276.35ms`

Defeito de tooling reproduzido depois da campanha e das E2Es:

- `vite preview` permaneceu em `Listen` na porta `5177`.
- `vite dev` permaneceu em `Listen` na porta `5178`.
- Isso bloqueou a E2E local completa com erro operacional: `http://127.0.0.1:5178 is already used`.
- Causa no script: `server.kill()` encerrava apenas o processo pai no Windows, deixando o processo filho do Vite ativo.

Correcao aplicada:

- `scripts/bootstrap-benchmark.mjs` passou a encerrar a arvore do processo iniciado pelo benchmark no Windows com `taskkill.exe /pid <pid> /t /f`.
- `tests/architecture/bootstrapBenchmarkTooling.test.js` congela que o benchmark continua usando o gate warm aprovado, nao escreve baseline e encerra a arvore de processos no Windows.

Campanha final apos correcao:

- Saida bruta: `docs/bootstrap-benchmark-6-2A-final-output.json`
- Exit code: `0`
- Resultado: `ok=true`, `status=ok`, sem violacoes
- Preview warm `app_bootstrap_ms`: `95ms`
- Preview warm `first_screen_ready_ms`: `115.7ms`
- Preview cold `app_bootstrap_ms`: `236.1ms`
- Preview cold `first_screen_ready_ms`: `254.95ms`
- Apos a execucao nao restou processo em `Listen` nas portas `5177` ou `5178`; apenas entradas `TIME_WAIT` sem processo dono.

Amostras brutas da campanha final:

| Serie | `app_bootstrap_ms` | `first_screen_ready_ms` |
| --- | --- | --- |
| preview warm | `116.8; 108.3; 116.4; 105.7; 83.5; 75.1; 77.8; 76.9; 87.3; 102.7` | `142.8; 137.6; 134.4; 132.5; 106.3; 97.8; 103.9; 104.6; 111.2; 120.2` |
| preview cold | `176.1; 242.8; 237.5; 241.1; 257.2; 189.3; 201.2; 188.8; 234.7; 240.7` | `281; 255.6; 252.3; 301.4; 270.2; 249; 263.2; 254.3; 237.3; 242.6` |

## Interpretacao

- A homologacao funcional de recorrencias nao introduziu runtime no bundle medido.
- Nao houve evidencia de mistura cold/warm no comparador.
- O valor original `342ms/364.15ms` nao foi reproduzido em campanha controlada.
- A causa comprovada na investigacao foi defeito de tooling/ambiente: o benchmark deixava servidores Vite orfaos no Windows, criando risco de porta ocupada, servidor reaproveitado e medicao nao comparavel.
- A correcao manteve baseline, tolerancias, budget e metricas de gate inalterados.

## Homologacao funcional preservada

- E2E local completa com Auth Emulator e Firestore Emulator: `4 passed`.
- Teste focado de recorrencias: `2 passed`.
- As recorrencias continuam exigindo criacao via UI, quantidade correta, valor por ocorrencia, datas canonicas, identificadores, owner, reload sem duplicacao e isolamento A -> B -> A.

## Resultado geral da etapa

Etapa 6.2A aprovada: o gate de bootstrap passou em execucao valida, a causa de tooling foi corrigida e a homologacao funcional de recorrencias foi preservada.

Nenhuma baseline, tolerancia, budget, regra financeira, Firestore Rules, timeout ou retry foi relaxado.
