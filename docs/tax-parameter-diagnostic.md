# Diagnostico de parametros tributarios

Executado em: 21/08/2026

## Comportamento atual

O calculo de INSS, IRRF e liquido esta duplicado entre dominio moderno e legado:

- `src/domain/taxes.js`: exporta `calcularINSS`, `calcularIRRF` e `calcularLiquido`.
- `src/legacy-globals.js`: define funcoes globais equivalentes e tambem usa essas funcoes na consolidacao mensal legada.
- `src/legacy/inline/part-04.js`: redefine `calcularINSS`, `calcularIRRF` e `calcularLiquido` como funcoes globais historicas.
- `src/legacy/inline/part-09.js`: sobrescrevia `calcularINSS` e `calcularIRRF` com a memoria detalhada usada pela UI de configuracoes.
- `src/domain/entries.js`: consolida entradas mensais e calcula impostos quando nao ha lancamento manual de INSS/IRRF.
- `src/application/entries/consolidatePersonMonthlyEntry.js`: consolida salario, hora extra, DSR, descontos, INSS, IRRF e liquido para a UI e dashboard.

O calculo atual usa valores hardcoded e nao seleciona tabela por competencia. A competencia e usada para localizar entradas, horas e salario vigente, mas nao para resolver parametros tributarios.

## Tabelas encontradas

### INSS

Tabela operacional encontrada no legado detalhado de UI:

| Faixa | Aliquota | Tipo |
| --- | --- | --- |
| ate 1621.00 | 7.5% | progressiva |
| 1621.01 ate 2902.84 | 9.0% | progressiva |
| 2902.85 ate 4354.27 | 12.0% | progressiva |
| 4354.28 ate 8475.55 | 14.0% | progressiva |

O teto efetivo e o ultimo limite, `8475.55`. O metodo aplicado pela UI e soma progressiva por faixa, limitada ao teto. Para bases acima do teto, o valor legado preservado e `988.10`.

### IRRF

Tabela hardcoded encontrada em `src/domain/taxes.js`, `src/legacy-globals.js` e `src/legacy/inline/part-04.js`:

| Limite | Aliquota | Deducao |
| --- | --- | --- |
| 2428.80 | 0.0% | 0.00 |
| 2826.65 | 7.5% | 182.16 |
| 3751.05 | 15.0% | 394.16 |
| 4664.68 | 22.5% | 675.49 |
| aberto | 27.5% | 908.73 |

Ha uma regra adicional de reducao para bases ate `7350.00`:

- base bruta ate `5000.00`: IRRF final zero;
- base tributavel ate `5000.00`: reducao igual ao IRRF tradicional;
- base bruta maior que `5000.00` e ate `7350.00`: reducao `978.62 - 0.133145 * baseBruta`;
- base bruta ate `7350.00`: IRRF final igual a IRRF tradicional menos reducao.

## Origem conhecida/desconhecida

Nao ha fonte oficial registrada junto aos parametros. Os valores existentes devem ser classificados como **legado sem fonte** e nao como tabela oficial.

## Base de calculo

Na consolidacao moderna atual:

- base de trabalho para impostos = salario base + hora extra + DSR;
- outras receitas ficam fora da base tributaria;
- INSS manual cadastrado em entradas substitui calculo automatico;
- IRRF/IRPF manual cadastrado em entradas substitui calculo automatico;
- liquido = salario base + hora extra + DSR + outros proventos - INSS - IRRF - outros descontos.

## Campos persistidos e recalculados

`entrada` aceita campos `INSS`, `IRRF`, `inss`, `irrf` e `liquido`, mas o contrato nao recalcula esses valores. A UI recalcula consolidado em memoria para dashboard, detalhes e PDF.

Campos de salario historico usados no calculo:

- `salary_base`;
- `start_date`;
- `end_date`;
- `vigencia_inicio`;
- `vigencia_fim`.

## localStorage e window

Existe a chave `finance-control-tax-settings-v1`, sincronizavel, mas ela nao e fonte autoritativa versionada. As funcoes globais `calcularINSS`, `calcularIRRF` e `calcularLiquido` ainda sao parte critica da bridge legada.

## Riscos

- Alterar valores hardcoded muda historico silenciosamente.
- Competencias antigas podem ser recalculadas com tabela nova.
- Duplicacao entre moderno e legado pode gerar divergencia.
- Nao ha fonte, versao ou vigencia persistida no resultado.
- PDF e dashboard dependem da consolidacao em memoria e podem refletir alteracao de tabela sem registro da versao usada.
- Registros legados sem competencia nao possuem criterio seguro para selecionar tabela.

## Politica proposta

- Centralizar parametros em modelo versionado por vigencia.
- Classificar valores atuais como baseline legado nao verificado.
- Calcular sempre em centavos no motor canonico.
- Exigir competencia para novos calculos.
- Retornar versoes usadas no resultado.
- Nao usar data atual silenciosamente.
- Nao recalcular nem migrar dados reais nesta etapa.
- Manter bridges globais como adaptadores para o motor moderno.

## Compatibilidade

As funcoes globais devem continuar existindo. Quando chamadas sem competencia, usam a politica de compatibilidade documentada e retornam o mesmo numero historico para preservar smoke e consumidores legados, mas o motor estruturado sinaliza warning quando a competencia estiver ausente.

## Rollback

Rollback tecnico: reverter o commit local desta etapa. Como nao ha migracao nem escrita em dados reais, nao ha rollback de dados. Tabelas versionadas criadas nesta etapa sao codigo/fixtures locais e nao alteram Firebase real.
