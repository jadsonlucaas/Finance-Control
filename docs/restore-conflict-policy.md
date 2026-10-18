# Politica de Conflitos de Restore

Data: 2026-08-23

## Status de item

| Status | Significado | Commit automatico |
| --- | --- | --- |
| `new` | Registro nao existe no destino | Sim |
| `identical` | Registro existe com conteudo equivalente | Nao duplica |
| `conflict` | Mesmo ID existe com conteudo divergente | Bloqueia |
| `incompatible` | Registro sem contrato minimo para restaurar | Bloqueia |
| `orphaned` | Referencia obrigatoria ausente | Bloqueia |
| `skipped_operational` | Dado fora do restore financeiro | Nao grava |

## Regras de seguranca

- Restore nunca sobrescreve registro existente divergente.
- Registro pago, arquivado, editado manualmente ou materializado por regra percentual deve ser preservado.
- Owner do destino vem do contexto autorizado, nao do arquivo.
- Conflitos exigem revisao manual ou caso de uso futuro especifico.
- Dados operacionais nao sao transformados em lancamentos.

## Auditoria

`RESTORE_PREPARED`, `RESTORE_COMMITTED`, `RESTORE_FAILED`, `RESTORE_ROLLBACK_PREPARED` e `RESTORE_ROLLBACK_COMMITTED` registram resumo e correlacao. O backup completo nao deve ser colocado na auditoria.

## UI ativa

Atualizacao em: 2026-09-08

A interface web exibe apenas o plano de restore em modo dry-run. Itens `conflict`, `incompatible`, `orphaned` e `skipped_operational` ficam visiveis para diagnostico, mas nenhum deles e gravado pela UI.

O botao de restore real permanece desabilitado. Qualquer execucao futura deve acontecer em backend confiavel, com permissao administrativa real, auditoria server-side, snapshot pre-restore e rollback testado em Firebase Emulator.
