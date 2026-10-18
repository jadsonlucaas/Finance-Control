# Politica de controle de horas

Executado em: 21/08/2026

## Representacao canonica

- O motor canonico e `CalculateWorkSession`, em `src/domain/workSession.js`.
- Todo calculo interno usa minutos inteiros.
- `HH:MM` e aceito somente entre `00:00` e `23:59`.
- Decimal de horas e campos legados sao derivados no final para compatibilidade.
- O limite inicial de jornada e 24h por lancamento.

## Jornada normal e noturna

- Jornada normal usa `startTime < endTime`.
- Jornada atravessando meia-noite e aceita quando `allowCrossMidnight = true`.
- Se `endTime < startTime` e `allowCrossMidnight = false`, o motor rejeita.
- `startTime == endTime` e rejeitado por padrao.
- `occurredDate` representa a data de inicio; `endedDate` e derivada quando cruza meia-noite.

## Intervalos

- O motor aceita intervalo por duracao (`breakMinutes`) ou por horario explicito (`breakStartTime`/`breakEndTime`).
- Os dois modos juntos sao rejeitados.
- O intervalo deve estar contido na jornada.
- `netMinutes = grossMinutes - breakMinutes`.
- `netMinutes` nunca pode ser negativo.
- Multiplos intervalos nao foram implementados nesta etapa.

## Hora extra e banco

- Hora extra usa `hourControlType = Hora Extra`.
- Banco usa `hourControlType = Banco de Horas` e `bankNature`.
- Percentuais sao normalizados: `50` e `0.5` representam 50%.
- Valores financeiros sao calculados em centavos.
- O divisor salarial legado permanece 220 horas mensais.
- Banco individual mantem natureza clara; saldo agregado pode usar sinal.

## DSR

- `CalculateDSR` centraliza o calculo de DSR.
- Domingos e feriados compartilham a mesma data de calendario e nao duplicam descanso.
- Feriado duplicado na entrada nao duplica descanso.
- A UI pode coletar feriados customizados/planner e injetar `holidayDates`.
- Edicao de registro deve subtrair o valor anterior do lancamento editado antes de incluir a previa atual.

## Salario vigente

- `ResolveEffectiveSalary` resolve salario por pessoa e competencia.
- Historico salarial valido prevalece sobre salario atual da pessoa.
- Ausencia de historico pode retornar warning quando houver fallback explicito de pessoa.
- Edicao historica deve usar a competencia do registro, nao a data atual.

## Legado

- Campos legados continuam aceitos: `horaInicial`, `horaFinal`, `quantidadeHoras`, `quantidadeHorasFormatada`, `percentualUsado`, `valorBaseHora`, `valorHoraCalculado`, `valorTotalCalculado`.
- Campos canonicos novos sao adicionados sem remover os antigos.
- Nao ha migracao automatica nem recalculo em massa.

## Dry-run

- `buildHourControlDryRun` classifica registros localmente com `wrote: false`.
- O dry-run detecta possivel jornada noturna antiga, divergencia de horas, divergencia de valor, intervalo invalido e possivel DSR duplicado.
- Qualquer reconciliação exige backup, aprovacao manual e execucao controlada fora deste escopo.

## Uso futuro por integracoes

- Web e backend futuro devem usar `CalculateWorkSession`.
- Consumidores devem informar `occurredDate`, `startTime`, `endTime`, intervalo, tipo, competencia e base salarial de forma explicita.
- `source_channel` nao altera o calculo.
- Identidade externa nao substitui `person`, `owner_uid` ou autorizacao.
- Nenhum WhatsApp foi implementado.
- Telefone nao faz parte do contrato.
