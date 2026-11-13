/**
 * Espanol (Espana): frases do relatorio PDF montadas com valores no meio
 * (Leitura gerencial, diagnostico, projecao e recomendacoes).
 */
const INNER = Object.freeze({
  'superávit': 'superávit',
  'déficit': 'déficit',
  'alto': 'alto',
  'moderado': 'moderado',
  'baixo': 'bajo',
  'sem concentração relevante': 'sin concentración relevante',
  'nenhuma categoria dominante': 'ninguna categoría dominante',
  'despesa e pendência superam a receita disponível': 'los gastos y pendientes superan los ingresos disponibles',
  'resultado sustentado por receita superior aos compromissos': 'resultado sostenido por ingresos superiores a los compromisos',
  'sem despesa dominante identificada': 'sin gasto dominante identificado',
  'predominantemente estrutural, puxado por custos fixos': 'principalmente estructural, impulsado por costes fijos',
  'misto, com peso de gastos variáveis/eventuais': 'mixto, con peso de gastos variables/puntuales',
  'pontual no recorte analisado': 'puntual en el periodo analizado',
  'existe risco de ruptura de caixa se o padrão for mantido': 'existe riesgo de falta de liquidez si se mantiene el patrón',
  'não há ruptura projetada no recorte atual': 'no hay falta de liquidez prevista en el periodo actual',
  'Outros': 'Otros'
});
const inner = (text) => INNER[text] ?? text;

export const PDF_INSIGHT_PATTERNS = Object.freeze([
  [/^Situação geral: (.+?) de (.+) no recorte analisado\.$/, (_, kind, value) => `Situación general: ${inner(kind)} de ${value} en el periodo analizado.`],
  [/^Principal driver: despesas pagas de (.+) contra receita de (.+)\.$/, 'Factor principal: gastos pagados de $1 frente a ingresos de $2.'],
  [/^Risco financeiro: (.+?), com (.+) em contas ainda pendentes\.$/, (_, risk, value) => `Riesgo financiero: ${inner(risk)}, con ${value} en cuentas aún pendientes.`],
  [/^Comportamento relevante: maior concentração em (.+?) \((.+) das despesas pagas\)\.$/, (_, cat, pct) => `Comportamiento relevante: mayor concentración en ${inner(cat)} (${pct} de los gastos pagados).`],
  [/^Comportamento relevante: maior concentração em (.+)\.$/, (_, cat) => `Comportamiento relevante: mayor concentración en ${inner(cat)}.`],
  [/^Resultado operacional de (.+) após excluir investimento, reserva e transferência do custo operacional\.$/, 'Resultado operativo de $1 tras excluir inversión, reserva y transferencias del coste operativo.'],
  [/^A causa principal é despesa operacional superior à capacidade de receita em (.+)\.$/, 'La causa principal es un gasto operativo superior a la capacidad de ingresos en $1.'],
  [/^A operação cobre seus custos diretos com folga de (.+)\.$/, 'La operación cubre sus costes directos con un margen de $1.'],
  [/^Cobertura financeira de (.+) para obrigações pagas e em aberto\.$/, 'Cobertura financiera de $1 para obligaciones pagadas y pendientes.'],
  [/^Pendências de (.+) reduzem o saldo projetado e exigem priorização de caixa\.$/, 'Pendientes de $1 reducen el saldo previsto y exigen priorizar la caja.'],
  [/^Categoria dominante: (.+?), com (.+)\.$/, (_, cat, value) => `Categoría dominante: ${inner(cat)}, con ${value}.`],
  [/^Gastos não essenciais representam (.+) da despesa paga\.$/, 'Los gastos no esenciales representan $1 del gasto pagado.'],
  [/^Há potencial de ajuste rápido em consumo discricionário estimado em (.+)\.$/, 'Hay margen de ajuste rápido en consumo discrecional estimado en $1.'],
  [/^Principal causa: (.+) \((.+)\)\.$/, (_, cause, value) => `Causa principal: ${inner(cause)} (${value}).`],
  [/^Segunda causa relevante: (.+) consome (.+)\.$/, 'Segunda causa relevante: $1 consume $2.'],
  [/^Segunda causa relevante: (.+)\.$/, (_, cause) => `Segunda causa relevante: ${inner(cause)}.`],
  [/^Natureza do resultado: (.+)\.$/, (_, kind) => `Naturaleza del resultado: ${inner(kind)}.`],
  [/^Cenário atual: saldo projetado de (.+) mantendo o padrão de gasto\.$/, 'Escenario actual: saldo previsto de $1 manteniendo el patrón de gasto.'],
  [/^Cenário ajustado: corte de 30% nos não essenciais \((.+)\) elevaria o saldo para (.+)\.$/, 'Escenario ajustado: un recorte del 30% en no esenciales ($1) elevaría el saldo a $2.'],
  [/^Risco de ruptura de caixa: (.+)\.$/, (_, risk) => `Riesgo de falta de liquidez: ${inner(risk)}.`],
  [/^Cortar primeiro: (.+), impacto de (.+) \((.+) da despesa\)\.$/, 'Recortar primero: $1, impacto de $2 ($3 del gasto).'],
  [/^Priorizar pagamento\/renegociação de contas em aberto: (.+)\.$/, 'Priorizar el pago/renegociación de cuentas pendientes: $1.'],
  [/^Revisar custo fixo relevante: (.+) \((.+)\)\.$/, 'Revisar coste fijo relevante: $1 ($2).'],
  [/^Os gastos estão concentrados em (.+), o que aumenta o risco de pressão pontual\.$/, (_, cat) => `Los gastos se concentran en ${inner(cat)}, lo que aumenta el riesgo de presión puntual.`],
  [/^Comprometimento de renda em (.+)\.$/, 'Compromiso de ingresos del $1.'],
  [/^Concentração excessiva de gasto em (.+)\.$/, (_, cat) => `Concentración excesiva de gasto en ${inner(cat)}.`],
  [/^Reduzir ou redistribuir gastos na categoria (.+)\.$/, (_, cat) => `Reducir o redistribuir gastos en la categoría ${inner(cat)}.`]
]);
