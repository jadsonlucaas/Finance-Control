# Politica de Versionamento de Backup

Data: 2026-08-23

## Principios

- `backup_version` identifica a versao logica do formato.
- `schema_version` identifica a estrutura tecnica validavel.
- Snapshots futuros desconhecidos sao rejeitados como incompativeis.
- Migracoes devem acontecer em memoria, sem sobrescrever o arquivo original.

## Versoes

| Versao | Schema | Status | Acao |
| --- | --- | --- | --- |
| `0.9.0` | `0` | legado local | migrar em memoria para `1.0.0` |
| `1.0.0` | `1` | atual | validar checksum e conteudo |
| maior que atual | qualquer | futuro | rejeitar ate haver migracao explicita |

## Regras de evolucao

- Toda nova collection precisa ser adicionada ao contrato e aos testes antes de ser aceita.
- Campos sensiveis seguem proibidos mesmo em migracoes.
- Alteracao de checksum exige teste de compatibilidade.
- Restore de versao migrada deve continuar passando por `PrepareFinanceRestore`.
- A UI ativa deve rejeitar versoes futuras/desconhecidas no passo de validacao e exibir erro seguro sem executar escrita.
