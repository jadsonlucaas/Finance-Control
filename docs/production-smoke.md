# Smoke de produção pós-go-live

Status: **PASS — runbook pronto; execução PENDING P5/P6**.

Este smoke só pode ser executado após autorização explícita de deploy e com usuário/dados sintéticos exclusivos de produção. Não reutilizar credenciais, usuários ou massa de staging.

Owner primário planejado: `jadsonlucaas`. O executor e um segundo observador devem ser registrados na Issue de P5 antes da janela.

## Pré-condições

- release owner e executor identificados;
- commit/tag, Hosting version ID e horário registrados;
- target esperado `finance-control-cce4f`;
- domínio aprovado definido (`finance-control-cce4f.web.app` ou custom domain autorizado);
- backup pré-release verificado;
- Sentry production ativo e sanitizado;
- Rules/Indexes nos estados aprovados;
- rollback candidate disponível;
- usuário sintético de smoke criado por processo confiável, com ciclo de vida e limpeza definidos.

## Monitor de isolamento obrigatório

Capturar todas as requests do navegador e falhar imediatamente se qualquer URL contiver:

- `finance-control-staging-260919`;
- `demo-`;
- `127.0.0.1`, `localhost`, ports `8080` ou `9099`;
- endpoints de Auth/Firestore Emulator.

O runtime deve expor projectId exatamente `finance-control-cce4f` e `useEmulators=false`.

## Smoke mínimo bloqueante

1. Abrir o domínio aprovado em sessão limpa.
2. Confirmar HTTPS, carregamento sem erro crítico e tela de login.
3. Confirmar projectId/runtime e ausência de requests proibidas.
4. Fazer login com usuário sintético active.
5. Confirmar perfil, status e isolamento do owner.
6. Fazer logout e confirmar limpeza canônica de sessão/cache.
7. Validar pending e inactive somente se as contas sintéticas tiverem sido pré-aprovadas; ambas devem permanecer fora do app.
8. Entrar novamente com active e criar um registro sintético marcado com correlation/run ID.
9. Confirmar persistência após reload, edição e remoção controlada do registro sintético.
10. Validar parcelamento/pagamento e recorrência apenas com prefixo sintético e plano de limpeza.
11. Importar XLSX sintético, recarregar e reimportar o mesmo conteúdo renomeado; contagem não pode duplicar.
12. Criar/editar horas sintéticas e confirmar auditoria create/update.
13. Gerar backup owner-scoped, fazer upload do mesmo arquivo, validar preview e executar somente dry-run.
14. Confirmar `wrote=false`, ausência de falso `ORPHAN_REFERENCE` e botão de restore real indisponível.
15. Validar settings/references pessoais sem atravessar owners.
16. Repetir telas críticas em 390x844 sem overflow bloqueante.
17. Confirmar evento/mensagem sintética no Sentry com release correta e sem PII/valor financeiro.

## Checks negativos

- usuário B não vê registros de A;
- pending/inactive não alcançam o app;
- nenhum custom claim pode ser criado no cliente;
- restore real permanece bloqueado;
- nenhuma request chega a staging/emulator;
- console não contém token, senha, backup, e-mail de usuário real ou payload financeiro;
- bundle/runtime não expõe service account, private key ou segredo server-side.

## Critérios de aprovação

Smoke aprovado somente se todos os itens bloqueantes passarem sem retry arbitrário e dentro da janela definida. Registrar:

- commit/tag;
- Hosting version ID;
- domínio;
- executor/owner;
- início/fim;
- contagens dos cenários;
- IDs sintéticos e confirmação de limpeza;
- Sentry release/event ID sanitizado;
- decisão GO/ROLLBACK.

## Critérios de rollback imediato

- target ou request de ambiente incorreto;
- falha de Auth ou isolamento;
- escrita duplicada/corrompida;
- Rules negando fluxo aprovado ou permitindo acesso indevido;
- restore real habilitado;
- segredo/PII/valor financeiro em logs ou Sentry;
- erro crítico sem diagnóstico durante a janela.

Ao ocorrer qualquer critério, parar o smoke e seguir `docs/production-rollback.md`.
