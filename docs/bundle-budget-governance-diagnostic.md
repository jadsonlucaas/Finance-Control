# Diagnostico de governanca do bundle budget

Executado em: 03/09/2026

Escopo: auditoria local do budget apos o commit `894eded fix: conecta controle de horas moderno a interface ativa`. Nenhum push, deploy, Firebase real, provider externo, WhatsApp, webhook, telefone ou Admin SDK foi usado.

## Ambiente verificado

- Branch: `melhoria-arquitetura`.
- Worktree inicial: limpa.
- Remote: vazio.
- Ultimo commit inicial: `894eded fix: conecta controle de horas moderno a interface ativa`.

## Auditoria 9cb8ba7..894eded

Comandos consultados:

- `git diff 9cb8ba7..894eded -- scripts/bundle-budget.mjs`
- `git diff 9cb8ba7..894eded -- docs/performance-budget.md`
- `git diff 9cb8ba7..894eded -- docs/performance-optimization-policy.md`
- `git show 9cb8ba7:scripts/bundle-budget.mjs`
- `git show 9cb8ba7:docs/performance-budget.md`

Resultado objetivo:

| Pergunta | Resposta |
| --- | --- |
| Qual era o budget antes? | `420 * 1024` = 430080 bytes. |
| Qual e o budget depois? | `422 * 1024` = 432128 bytes. |
| O limite aumentou? | Sim. |
| Aumento em bytes e percentual | 2048 bytes, aproximadamente 0,48% sobre 430080 bytes. |
| Motivo declarado | Acomodar o bootstrap lazy do adapter ativo de Controle de Horas. |
| A alteracao estava prevista por politica anterior? | Nao foi encontrada aprovacao previa em etapa propria. |
| O budget foi alterado antes ou depois de medir o novo entry? | Depois de medir o novo entry da correcao 5.4A. |
| O teste falharia com o budget anterior? | Sim. Entry 5.4A `431251` bytes ficava 1171 bytes acima do budget anterior. |
| O script mudou apenas limite ou tambem logica? | Apenas o limite `entryChunkBytes`; a logica de calculo permaneceu igual. |
| Houve mudanca que possa mascarar regressao? | Sim: aumentar o limite no mesmo commit da feature reduz a forca do guardrail e caracteriza risco de moving goalpost. |

## Conclusao

O aumento de 420 KiB para 422 KiB nao deve permanecer como solucao desta etapa. A correcao 5.4B deve restaurar o budget oficial anterior de 430080 bytes e criar headroom por code splitting/lazy loading seguro, mantendo a UI ativa de Controle de Horas moderna e funcional.

## Meta 5.4B

- Budget oficial restaurado: 430080 bytes.
- Meta recomendada: entry <= 425000 bytes quando tecnicamente seguro.
- `hourControlActiveUi.js`, `hourControlController.js`, `hourControlPresenter.js` e `hourControlReadModel.js` devem permanecer fora do bootstrap inicial e carregar sob demanda ao abrir Controle de Horas.
- `bundle:budget` deve falhar se um modulo lazy marcado reaparecer no entry.
