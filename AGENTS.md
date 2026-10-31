# AGENTS.md — Regras obrigatórias para humanos e agentes de IA

Este arquivo define o padrão operacional obrigatório para qualquer pessoa, agente, modelo ou automação que altere este repositório.

## 1. Governança por Issue → Branch → Pull Request

Toda correção, melhoria, refatoração, tarefa técnica ou nova função DEVE começar por uma GitHub Issue.

Fluxo obrigatório:

1. Criar ou localizar a Issue correspondente.
2. Criar branch própria a partir da base aprovada.
3. Implementar somente o escopo da Issue.
4. Executar os gates aplicáveis.
5. Abrir Pull Request.
6. Mencionar a Issue na descrição do PR usando `Closes #<numero>` ou `Fixes #<numero>`.
7. Registrar no PR: objetivo, mudanças, testes, riscos, rollback, impacto de dados/segurança/performance.
8. Merge/deploy somente após os gates e revisão aplicáveis.

É proibido usar commits funcionais diretos na `main` como fluxo normal.

## 2. Deploys

Deploys devem ser gerenciados por PRs e ambientes explícitos.

- Produção e staging nunca podem compartilhar configuração implícita.
- Toda seleção de ambiente deve ser fail-closed.
- Nenhum deploy pode depender de fallback silencioso para produção.
- Staging deve ser validado antes de produção.
- Toda mudança com risco operacional deve possuir plano de rollback.
- Segredos nunca devem ser versionados.

## 3. Motion e experiência de interface

Toda mudança de interface deve seguir os princípios da skill pública `kylezantos/design-motion-principles`.

Requisitos obrigatórios:

- aplicar motion apenas quando melhora compreensão, continuidade ou feedback;
- usar skeleton para carregamentos relevantes quando a estrutura do conteúdo é previsível;
- usar lazy loading para recursos/telas pesados quando aplicável;
- estados de loading, empty, success, progress e error devem ser explícitos;
- entradas/saídas de elementos dinâmicos devem ser suaves e discretas;
- ações frequentes devem ter motion mínimo;
- respeitar `prefers-reduced-motion`;
- priorizar animações em `transform`, `opacity` e, quando justificado, `filter`;
- evitar animação decorativa, pulsing excessivo, hover-scale generalizado, stagger excessivo e springs exageradas;
- preservar acessibilidade de teclado, foco e nomes acessíveis;
- não degradar performance para obter efeitos visuais.

## 4. Observabilidade

Toda nova feature deve considerar observabilidade desde o desenho.

Objetivo da plataforma:

- OpenTelemetry como base vendor-neutral quando aplicável;
- Sentry para erros e diagnóstico de frontend;
- integração compatível com Datadog e New Relic quando adotados no ambiente;
- correlação por request/operation/idempotency key quando existir;
- logs sem dados financeiros sensíveis;
- métricas e traces para fluxos críticos;
- alertas e runbooks para falhas críticas.

Não enviar PII, credenciais, tokens ou conteúdo financeiro sensível para ferramentas de observabilidade sem política explícita.

## 5. Qualidade e lint

A plataforma de qualidade deve evoluir para incluir:

- contratos arquiteturais / arch-contract;
- Biome para lint/format quando aprovado;
- Commitlint para padrão de commits;
- Knip para código/dependências não utilizados;
- Stryker para mutation testing de regras críticas;
- checks arquiteturais já existentes no projeto.

Nenhuma ferramenta deve ser adicionada apenas para “marcar caixa”: deve haver configuração, gate e documentação.

## 6. Testes

Mudanças devem manter ou ampliar:

- testes unitários;
- testes de integração;
- testes E2E com Playwright;
- emuladores Firebase para fluxos de Auth/Firestore;
- smoke e regression gates;
- Codecov/coverage em CI quando configurado;
- testes negativos de isolamento/authorization;
- testes de idempotência para integrações externas.

É proibido resolver falhas apenas com aumento de timeout, retry arbitrário, `skip` ou redução de assertions.

## 7. Integrações externas e n8n

Integrações n8n/webhooks NÃO devem escrever diretamente no frontend nem depender de segredos client-side.

Requisitos:

- contrato server-side explícito;
- autenticação do webhook;
- assinatura/secret rotation;
- idempotência;
- rate limiting quando necessário;
- validação de payload;
- auditoria;
- retries controlados e dead-letter/reprocessamento quando aplicável;
- isolamento entre usuários;
- testes de contrato;
- observabilidade;
- nenhum dado real em fixtures públicas.

Workflows n8n relevantes devem ser versionados ou documentados de forma reprodutível.

## 8. Arquitetura e escalabilidade

Preferir dependências na direção:

UI → application → domain → ports/repositories → infrastructure

Evitar novos acoplamentos a `window`, globals e loader legado.

Novas features não devem aumentar dívida legada sem Issue explícita e justificativa.

Para fluxos críticos:

- comandos devem ser idempotentes quando houver possibilidade de repetição;
- contratos de dados devem ser versionados;
- ownership e authorization devem ser explícitos;
- operações externas devem ser reconciliáveis;
- estado de UI não deve ser fonte de verdade para regras de domínio.

## 9. Segurança

É proibido versionar:

- `.env*.local`;
- service accounts;
- private keys;
- tokens;
- senhas;
- cookies/storageState autenticado;
- dumps reais;
- dados financeiros reais.

Admin SDK e custom claims pertencem exclusivamente a ambiente confiável server-side.

## 10. Definition of Done

Uma tarefa só pode ser considerada concluída quando, conforme o escopo:

- Issue existe e está vinculada;
- implementação está em branch própria;
- testes aplicáveis estão verdes;
- lint/quality gates aplicáveis estão verdes;
- observabilidade foi considerada;
- acessibilidade/performance foram consideradas;
- documentação foi atualizada;
- PR referencia a Issue;
- riscos e rollback estão registrados;
- nenhum segredo foi introduzido;
- nenhuma proteção foi relaxada para fazer o gate passar.
