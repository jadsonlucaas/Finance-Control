# Runbook de observabilidade

## Objetivo e estado atual

A camada `src/services/observability` fornece uma fronteira única para erros, mensagens, contexto de usuário e traces. O frontend usa Sentry quando `VITE_SENTRY_DSN` está configurado e permanece funcional em modo `noop` quando não há DSN ou quando a inicialização do provedor falha.

OpenTelemetry é a base vendor-neutral para traces futuros. O adaptador recebe um `Tracer` da API OpenTelemetry, sem escolher exporter no domínio ou na UI. Datadog e New Relic ficam para uma integração posterior por OTLP/OpenTelemetry Collector.

## Configuração

Variáveis públicas de build:

| Variável | Uso | Exemplo |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | ativa o Sentry no frontend | DSN público do projeto, nunca auth token |
| `VITE_APP_RELEASE` | correlaciona eventos com release/deploy | hash completo do commit |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | amostragem entre 0 e 1 | `0.05` |
| `VITE_FINANCE_ENV` | tag de ambiente já usada pelo Firebase | `staging` |

O DSN do browser é um identificador público, mas tokens de upload, auth tokens e credenciais nunca devem usar prefixo `VITE_`. Sem `VITE_SENTRY_DSN`, eventos ficam no reporter local existente e nenhum request ao Sentry é feito.

## Política de redaction

Antes do envio, eventos, transactions, breadcrumbs, contexto e atributos passam pelo sanitizador central. São removidos ou substituídos por `[REDACTED]`:

- e-mail, telefone, WhatsApp, endereço, documentos, nomes de pessoa e caminhos de diretório pessoal;
- senhas, cookies, sessões, tokens, JWT, API keys, private keys e credenciais;
- valores, saldos, salários, impostos, descontos, preços e demais números financeiros;
- payloads, request bodies, conteúdo bruto e metadados livres;
- backups, snapshots de restore, arquivos, nomes de arquivo, planilhas, workbook e linhas de importação.

São permitidos metadados operacionais de baixa cardinalidade: nome da operação, código/categoria/severidade do erro, ambiente, versão, booleanos, duração e contagens agregadas. Arrays de dados de negócio são resumidos, nunca serializados. O UID é convertido localmente em identificador pseudônimo; e-mail não integra o contexto de usuário.

Qualquer novo campo de telemetria deve ser agregado ao sanitizador e coberto por teste antes do uso. Não registrar objetos de domínio completos mesmo que o SDK também possua `beforeSend`.

## Cobertura implementada

- bootstrap do app e inicialização Firebase;
- login, cadastro, logout, claims, persistência e mudança de estado Auth;
- operações Firestore do provider (`subscribe`, `create`, `create_many`, `update`, `upsert`, `delete`);
- carregamento e preparação XLSX, commit e replay de importação;
- criação/validação de backup e dry-run de restore;
- erros já encaminhados ao `InMemoryErrorReporter`, incluindo lazy loading e fluxos críticos de aplicação.

## Triagem de incidentes

1. Confirmar `environment`, `release`, operação, código e correlation ID no evento.
2. Verificar se o incidente é isolado a uma release ou ambiente.
3. Correlacionar com audit logs pelo `correlation_id`; nunca copiar payload financeiro para Sentry.
4. Para Auth, separar configuração, credencial inválida, bloqueio de conta e indisponibilidade.
5. Para Firestore, separar permission denied esperado de falha inesperada, indisponibilidade e contrato inválido.
6. Para XLSX/backup, usar somente contagens, estágio e códigos; obter o arquivo diretamente do usuário por canal seguro se indispensável.
7. Em regressão de release, seguir o checklist e rollback documentados; preservar o evento e o hash do deploy.

## Alertas iniciais

- erro fatal de bootstrap ou inicialização Firebase: alertar na primeira ocorrência em produção;
- aumento de `auth.sign_in` ou `firestore.*` com erro: alertar por taxa e por release;
- falha de `import.xlsx.prepare`, `import.commit`, `backup.preview` ou `backup.restore_dry_run`: alertar por repetição, não por payload;
- ausência completa de eventos após deploy: verificar DSN, CSP, ad blockers e release tag antes de assumir estabilidade.

Dashboards mínimos: erros por release/ambiente/operação, usuários pseudônimos afetados, taxa de erro Auth/Firestore, latência p50/p95 dos fluxos críticos e regressões de bootstrap.

## OpenTelemetry, Datadog e New Relic

O próximo passo é instalar um provider web e exportar OTLP/HTTP para um OpenTelemetry Collector protegido por TLS, CORS restrito, rate limiting e autenticação apropriada. O Collector roteará os mesmos sinais para Datadog ou New Relic, sem imports desses vendors em domínio, application ou UI.

Instrumentação automática de browser deve ser adotada com cautela: a implementação OpenTelemetry web ainda é experimental. Propagação para endpoints externos só pode ser habilitada com allowlist explícita para evitar vazamento de headers de trace.

## Source maps

O build público mantém `sourcemap: false`. Para source maps no Sentry, gerar mapas apenas em job protegido, fazer upload autenticado com token secreto server-side e remover os `.map` antes de publicar `dist`. Nunca versionar token Sentry nem publicar source maps no Hosting.

## Teste operacional

1. Configurar um projeto Sentry não produtivo e as três variáveis Sentry no build de staging.
2. Publicar uma release identificada pelo hash do commit.
3. Disparar um erro sintético sem dados reais e confirmar ambiente/release/operação.
4. Confirmar que e-mail, UID original, valores, token, backup e import rows aparecem redigidos ou ausentes.
5. Executar login, uma operação Firestore sintética, import XLSX sintético e backup/dry-run sintético.
6. Remover o erro sintético e registrar a evidência. Não testar erros deliberados em produção.

## Rollback

Remover `VITE_SENTRY_DSN` e rebuildar desativa imediatamente o envio sem alterar fluxos de negócio. Se a regressão estiver no código da camada, reverter a PR; o reporter local e os fluxos funcionais continuam independentes do provedor.
