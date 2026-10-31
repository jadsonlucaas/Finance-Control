# Diff Firestore de produção

Leitura realizada em 31/10/2026. Nenhuma mutação foi executada.

## Rules

- produção: ruleset `62167b62-f34f-45cc-8f99-fad42ab803af`, 193 linhas, SHA-256 normalizado `11152512D76F80ADAB0333A79CFE249275063C4C769C844F33A557004FB9D8F1`;
- staging: ruleset `b5fc5ac6-677d-4df6-af9b-740e7a307c88`, 735 linhas, SHA-256 normalizado `B29FB6E667156C535AB54ADF3D2A58B12E08A87956EAB0E9EACA05D8E9EE7EDE`;
- candidata local: 735 linhas e o mesmo SHA-256 de staging;
- comparação produção → candidata: 595 linhas adicionadas e 53 removidas, considerando comparação de conteúdo por linha.

Principais blocos presentes na candidata homologada e ausentes no ruleset antigo:

- status/role de conta e transições administrativas;
- active self e acesso administrativo a outros usuários;
- ownership e shapes por tipo financeiro;
- validação de competência, datas, horários e metadados de origem;
- referências pessoais e compartilhadas;
- idempotency receipts e transições permitidas;
- parâmetros tributários;
- regras específicas para saídas percentuais geradas.

O artefato a aplicar deve ser exatamente `firestore.rules` com o hash acima. Qualquer alteração de hash exige nova homologação em staging.

## Indexes

Produção: zero indexes compostos. Candidato:

```text
users(status ASC, email ASC)
users(role ASC, email ASC)
users(status ASC, role ASC, email ASC)
```

Comando preparado para a etapa isolada de P5/predeploy:

```text
firebase deploy --only firestore:indexes --project finance-control-cce4f
```

Não executar por alias/default. Aguardar todos os indexes em `READY` antes de qualquer fluxo dependente.

Rules, se aprovadas para aplicação em P5, devem usar etapa separada:

```text
firebase deploy --only firestore:rules --project finance-control-cce4f
```

Não combinar Rules, indexes e Hosting em um único comando.
