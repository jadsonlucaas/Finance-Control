# Plano de massa sintetica de staging

Executado em: 19/09/2026

Nao usar dados reais, prints pessoais, exportacoes de producao, backups reais ou planilhas reais nesta etapa.

## Perfis ficticios

| Perfil | Finalidade |
| --- | --- |
| `owner.staging@example.test` | valida administracao maxima por perfil ativo |
| `admin.staging@example.test` | valida administracao comum |
| `user.a.staging@example.test` | valida isolamento de dados A |
| `user.b.staging@example.test` | valida isolamento de dados B |
| `inactive.staging@example.test` | valida bloqueio de usuario inativo |
| `pending.staging@example.test` | valida conta pendente |

## Registros financeiros

- Saidas simples, editadas e excluidas.
- Parcelamento com arredondamento e parcelas marcadas como pagas.
- Recorrencia mensal explicita.
- Entradas consolidadas com salario, hora extra e DSR.
- Outras receitas separadas de salario/H.E/DSR.
- Controle de horas com hora extra e banco de horas.
- Importacao XLSX sintetica com reimportacao duplicada.
- Backup dry-run e restore dry-run com snapshot ficticio.
- Exportacao PDF sem informacao real.

## Criterios de limpeza

- Cada cenario deve usar prefixo unico `staging-rc-<data>-<cenario>`.
- O responsavel deve apagar usuarios ficticios e subcolecoes criadas depois da homologacao.
- Nenhuma massa sintetica pode ser promovida para producao.
