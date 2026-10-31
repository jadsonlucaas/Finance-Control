# CI e checks obrigatórios

O workflow `.github/workflows/ci.yml` executa em todo `pull_request` e em pushes para `main`.

## Gate obrigatório

O job `Quality gates` executa, nesta ordem:

1. instalação reproduzível com `npm ci`;
2. testes Vitest com `npm test`;
3. coverage Vitest em texto, HTML e LCOV;
4. publicação de `coverage/lcov.info` no Codecov;
5. build de produção;
6. smoke em Chromium instalado pelo Playwright;
7. inventário de APIs globais;
8. orçamento de bundle;
9. verificação do bootstrap.

Se qualquer etapa falhar, logs e artefatos disponíveis (`coverage`, `dist`, `playwright-report` e `test-results`) são enviados para a execução do GitHub Actions por 14 dias.

## Branch protection

Na proteção da branch `main`, configurar `Quality gates` como required status check e exigir que a branch esteja atualizada antes do merge. Push direto para `main` deve permanecer bloqueado; mudanças entram por Pull Request vinculado a uma Issue com `Closes #N` ou `Fixes #N`.

O Codecov faz parte do job obrigatório e autentica o upload com OIDC, sem armazenar `CODECOV_TOKEN`. A permissão `id-token: write` serve somente para emitir essa identidade temporária; o conteúdo do repositório permanece com acesso apenas de leitura.

## Adoção gradual de qualidade

Biome pode ser introduzido primeiro como relatório ou aplicado somente a arquivos novos/alterados. Knip e Stryker não são checks obrigatórios enquanto a dívida existente não estiver inventariada e houver uma baseline acordada. Nenhum desses três gates deve ser ativado como bloqueador apenas para aparentar uma pipeline verde.

## Segurança

O workflow usa permissão de leitura do conteúdo, identidade OIDC temporária para o Codecov, cache nativo do npm baseado no lockfile e não executa deploy. Segredos e credenciais Firebase não são necessários para os gates atuais.
