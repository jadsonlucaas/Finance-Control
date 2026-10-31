# Rollback de produção

Status: **PASS — runbook pronto; execução NOT APPLICABLE até existir release**.

Este runbook não autoriza deploy ou rollback. Qualquer execução exige release owner, incident owner, aprovação explícita e target `finance-control-cce4f` conferido por duas pessoas.

Owners planejados: `jadsonlucaas` como release/incident owner primário e um segundo executor obrigatório, a registrar na Issue de P5. Janela padrão: 60 minutos, com no mínimo 30 minutos de observação após o smoke.

## Princípios

- Interromper a release ao primeiro sinal de target incorreto, erro de Auth, negação inesperada de Rules, corrupção/isolamento de dados ou request para staging/emulator.
- Não usar restore client-side em produção.
- Não tentar corrigir durante o incidente com relaxamento de Rules, timeout, retry ou alteração financeira.
- Preservar logs, IDs de release, hashes e horários sem copiar PII ou valores financeiros.
- Separar rollback de frontend, Rules, indexes e dados; um não reverte automaticamente os outros.

## Pré-requisitos obrigatórios

- release owner e rollback owner nomeados;
- commit/tag e artefato imutável registrados;
- versão Hosting anterior conhecida e validada;
- backup Firestore pré-release validado;
- ruleset anterior `62167b62-f34f-45cc-8f99-fad42ab803af` preservado até a nova Rules ser aprovada;
- manifest dos indexes antes/depois;
- credencial operacional fora do repositório;
- canal de comunicação e janela de observação definidos.

## Particularidade do primeiro go-live

O canal live de produção não possuía releases no preflight de 31/10/2026. Portanto, não existe versão anterior do app para rollback imediato.

Antes do primeiro go-live deve existir uma estratégia aprovada entre:

1. release de manutenção/holding previamente validada e registrada como rollback candidate; ou
2. procedimento aprovado para retirar a nova release de serviço até a correção.

Sem rollback candidate previamente testada: **NO-GO**.

## Gatilhos de rollback

- runtime projectId diferente de `finance-control-cce4f`;
- qualquer request para `finance-control-staging-260919`, `demo-*`, localhost ou emulator;
- login Email/Password indisponível;
- usuários ativos bloqueados ou pending/inactive obtendo acesso;
- vazamento A → B;
- CRUD, pagamento, recorrência, XLSX ou horas gerando duplicidade/corrupção;
- `ORPHAN_REFERENCE` falso em backup de parcelas;
- erro crítico sem telemetria ou envio de PII/valores ao Sentry;
- aumento sustentado de erros críticos durante a janela.

## Procedimento de frontend Hosting

1. Congelar novas ações operacionais e registrar horário/commit/release ID.
2. Confirmar duas vezes o site `finance-control-cce4f`; nunca usar alias implícito.
3. Selecionar a versão anterior aprovada no histórico do Hosting; no primeiro go-live, usar a holding/rollback candidate registrada na Issue de P5.
4. Criar release de rollback apontando para essa versão.
5. Confirmar que o canal `live` aponta para o version ID esperado.
6. Executar o smoke mínimo de `docs/production-smoke.md`.
7. Manter observação e registrar decisão final.

Os comandos/API exatos devem ser preenchidos e revisados na janela; este documento não inclui token nem automatiza mutação.

## Rules e indexes

- Rules: se a nova release causar bloqueio/autorização indevida, publicar o ruleset anterior aprovado somente após confirmar compatibilidade com o frontend revertido.
- Indexes: criação pode ser assíncrona. Não promover frontend que dependa de índice ainda não `READY`.
- Remoção de índice durante incidente é proibida sem análise específica; rollback de frontend/Rules deve ser preferido.
- Registrar ruleset IDs, hashes e estados dos três índices.

## Dados

- Restore real pelo navegador permanece proibido.
- Não apagar documentos sintéticos ou reais durante triagem sem plano e autorização.
- Se houver suspeita de escrita incorreta, bloquear a fonte da escrita, preservar evidência e preparar reconciliação/dry-run.
- Restauração a partir do backup pré-release exige ambiente confiável, plano de conflito, auditoria e aprovação separada.

## Sentry e comunicação

- Registrar issue/event IDs sanitizados, release e correlação.
- Não anexar payload bruto, e-mail, token, backup ou valor financeiro.
- Comunicar início do rollback, versão alvo, resultado do smoke e encerramento.

## Critério de encerramento

Rollback concluído somente quando:

- versão live conferida;
- projectId e rede confirmados;
- Auth e isolamento mínimo aprovados;
- nenhum erro crítico novo durante a janela definida;
- incidente e ações futuras registrados.
