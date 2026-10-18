# Diagnostico do controle de horas

Executado em: 21/08/2026

Este diagnostico foi produzido antes de qualquer alteracao de codigo da correcao `fix: unifica calculo de jornada e horas extras`.

## Comportamento atual

- `src/domain/hours.js` contem as funcoes modernas `parseTimeToMinutes`, `calcularHoras`, `calcularHoraExtra` e `calcularBancoHoras`.
- `src/legacy-globals.js` duplica essas mesmas funcoes e pode sobrescrever a bridge moderna quando os scripts classicos sao carregados.
- `src/legacy/inline/part-06.js` usa `calcularHoras` e `calcularHoraExtra` para preencher a previa e persistir `controle_horas`.
- `src/ui/records/recordFormValidation.js` valida hora extra em formulario moderno e rejeita `horaFinal <= horaInicial`.
- `src/legacy/inline/part-27.js` duplica a logica de DSR e envolve `updateHourControlCalculatedFields`.
- `src/domain/dsr.js` contem a implementacao moderna de DSR usada pela bridge global.
- `src/domain/hourPeriodSummary.js` agrega banco de horas e hora extra por floats de horas decimais.
- `src/domain/records/financeRecordSchemas.js` e `firestore.rules` aceitam o contrato legado de `controle_horas`, mas ainda nao expressam minutos brutos, liquidos, intervalo, virada de dia ou versao de calculo.

## Implementacoes duplicadas

| Area | Implementacoes encontradas | Risco |
| --- | --- | --- |
| Duracao | `src/domain/hours.js`, `src/legacy-globals.js`, `src/legacy/inline/part-06.js` via chamada global, `src/ui/records/recordFormValidation.js` | Divergencia entre dominio, formulario e legado. |
| Hora extra | `src/domain/hours.js`, `src/legacy-globals.js`, uso legado em `part-06.js`, defaults em `recordPayloads.js` | Percentual e quantidade podem ser interpretados por aliases diferentes. |
| Banco de horas | `src/domain/hours.js`, `src/legacy-globals.js`, agregacao em `hourPeriodSummary.js` | Sinal do saldo depende de natureza textual. |
| DSR | `src/domain/dsr.js`, `src/legacy/inline/part-27.js` | Possibilidade de formula duplicada e contagem diferente de feriados. |
| Salario vigente | `getSalarioVigente` em scripts inline e leitura indireta no dashboard/consolidacao | Edicao historica pode usar fonte salarial diferente se o consumidor escolher competencia errada. |

## Formato interno atual

- Horas sao persistidas principalmente como decimal em `quantidadeHoras` e como texto em `quantidadeHorasFormatada`.
- Valores derivados persistidos incluem `valorBaseHora`, `valorHoraCalculado`, `valorTotalCalculado`, `financial_total`, `amount`, `salary_base_snapshot` e `salary_base_reference`.
- O parser atual aceita `HH:MM`, mas nao valida faixa de hora/minuto no dominio legado anterior.
- A duracao atual e `fim - inicio`; se `fim <= inicio`, retorna zero ou erro de formulario.
- Intervalo nao e tratado como parte canonica da jornada.
- Jornada atravessando meia-noite e rejeitada ou zerada.
- O divisor salarial atual e 220 horas mensais.
- DSR usa domingos e feriados fixos do calendario brasileiro; feriado em domingo nao duplica porque a contagem usa condicao unica por data.
- A previa de DSR em edicao tenta evitar duplicidade subtraindo o valor do registro editado antes de somar o lancamento atual.

## Riscos

- Registros antigos podem conter `quantidadeHoras` decimal divergente de `quantidadeHorasFormatada`.
- Recalcular dados reais em massa mudaria historico financeiro; isso esta fora do escopo.
- Alterar a formula de INSS/IRRF ou a base tributaria afetaria entradas consolidadas; isso nao deve ser feito aqui.
- Como `src/legacy-globals.js` duplica funcoes, uma correcao apenas no modulo moderno nao garante o comportamento real em runtime.
- Firestore Rules nao devem recalcular jornada; elas so podem validar shape e isolamento.
- Uma integracao futura server-side precisa chamar dominio puro, sem depender de DOM, `window`, modal ou clique.

## Politica proposta

- Usar minutos inteiros internamente em um motor canonico puro.
- Aceitar jornada noturna quando `allowCrossMidnight = true`; se `endTime < startTime` e a flag for falsa, rejeitar.
- Rejeitar `startTime == endTime` por padrao.
- Manter limite inicial de 24h por lancamento.
- Suportar intervalo explicito (`breakStartTime`/`breakEndTime`) ou por duracao (`breakMinutes`), mas nao ambos ao mesmo tempo.
- Garantir que o intervalo fique contido na jornada e que `netMinutes` nunca fique negativo.
- Calcular valores monetarios em centavos e derivar formato decimal apenas na borda de compatibilidade.
- Preservar campos legados e adicionar campos canonicos sem migracao automatica.
- Expor bridges antigas apontando para o motor novo.
- Consolidar DSR em uma funcao canonica sem dupla contagem de feriados.

## Compatibilidade

- Registros legados continuam legiveis.
- Ao editar, apenas o registro editado deve ser normalizado/recalculado.
- `source_channel` e `idempotency_key` nao alteram calculo.
- Nenhum telefone, webhook, chatbot, provedor Meta ou Firebase Admin SDK faz parte deste escopo.
- Consumidores server-side futuros devem chamar o motor de dominio com `occurredDate`, `startTime`, `endTime`, intervalo, tipo, competencia e base salarial explicitos.

## Rollback

- Como nao ha migracao automatica nem escrita em dados reais, rollback tecnico consiste em reverter o commit local desta etapa.
- Dados persistidos existentes nao sao reprocessados.
- Em caso de regressao, preservar o contrato legado permite voltar as funcoes anteriores sem conversao de base.
