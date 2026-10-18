import { roundCurrency } from '../core/money.js';

export function addDashboardAggregationItem(map, recordsMap, key, record, value) {
  let rawLabel = String(key || '').trim() || 'Sem informação';
  
  const normalizedKey = Object.keys(map).find(k => 
      k.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
      rawLabel.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  let label = normalizedKey || rawLabel;

  if (!normalizedKey) {
      const match = rawLabel.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (match === 'FIXO') label = 'FIXO';
      else if (match === 'VARIAVEL') label = 'VARIAVEL';
      else if (match === 'RESERVA') label = 'RESERVA';
  }

  map[label] = roundCurrency((map[label] || 0) + value);
  if (!recordsMap[label]) recordsMap[label] = [];
  recordsMap[label].push(record);
}

export function dashboardAggregationItems(valuesMap, recordsMap) {
  return Object.entries(valuesMap)
    .map(([label, value]) => ({
      label,
      value: roundCurrency(value),
      records: recordsMap[label] || []
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function buildDashboardExpenseAggregations(records = []) {
  const porCategoria = {};
  const porSubcategoria = {};
  const porPessoa = {};
  const registrosPorCategoria = {};
  const registrosPorSubcategoria = {};
  const registrosPorPessoa = {};

  records.forEach((record) => {
    const value = Number(record.amount) || 0;
    addDashboardAggregationItem(porCategoria, registrosPorCategoria, record.macro_category || 'Sem categoria', record, value);
    addDashboardAggregationItem(porSubcategoria, registrosPorSubcategoria, record.subcategory || record.category_name || record.description || 'Sem subcategoria', record, value);
    addDashboardAggregationItem(porPessoa, registrosPorPessoa, record.person || 'Sem pessoa', record, value);
  });

  return {
    base: records,
    total: roundCurrency(records.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)),
    porCategoria,
    porSubcategoria,
    porPessoa,
    registrosPorCategoria,
    registrosPorSubcategoria,
    registrosPorPessoa
  };
}

export function buildDashboardEntradasSummary(baseEntradas = []) {
  const porPessoa = {};
  const porCiclo = {};
  const porTipoEntrada = {};

  baseEntradas.forEach((entry) => {
    const value = roundCurrency(Number(entry.cardLiquido ?? entry.liquido ?? 0) || 0);
    const pessoa = String(entry.person || 'Sem pessoa').trim() || 'Sem pessoa';
    const ciclo = String(entry.cycleView || 'INICIO_MES').trim() || 'INICIO_MES';
    const tipoEntrada = String(entry.receivingType || 'Líquido final').trim() || 'Líquido final';
    porPessoa[pessoa] = roundCurrency((porPessoa[pessoa] || 0) + value);
    porCiclo[ciclo] = roundCurrency((porCiclo[ciclo] || 0) + value);
    porTipoEntrada[tipoEntrada] = roundCurrency((porTipoEntrada[tipoEntrada] || 0) + value);
  });

  return {
    baseEntradas,
    totalEntradas: roundCurrency(Object.values(porPessoa).reduce((acc, value) => acc + (Number(value) || 0), 0)),
    porPessoa,
    porCiclo,
    porTipoEntrada
  };
}

export function buildDashboardPersonBalances(baseEntradas = [], baseSaidas = []) {
  const map = {};
  const ensurePersonBalance = (key) => {
    const label = String(key || 'Sem pessoa').trim() || 'Sem pessoa';
    if (!map[label]) {
      map[label] = {
        label,
        receber: 0,
        pagar: 0,
        emAberto: 0,
        sobra: 0,
        ciclos: {
          INICIO_MES: { receber: 0, pagar: 0, emAberto: 0, sobra: 0 },
          QUINZENA: { receber: 0, pagar: 0, emAberto: 0, sobra: 0 }
        }
      };
    }
    return map[label];
  };

  baseEntradas.forEach((entry) => {
    const personBalance = ensurePersonBalance(entry.person || 'Sem pessoa');
    const value = Number(entry.cardLiquido ?? entry.liquido ?? 0) || 0;
    const cycle = entry.cycleView === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
    personBalance.receber += value;
    personBalance.ciclos[cycle].receber += value;
  });

  baseSaidas.forEach((record) => {
    const personBalance = ensurePersonBalance(record.person || 'Sem pessoa');
    const value = Number(record.amount) || 0;
    const cycle = record.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';

    if (record.status === 'Pago') {
      personBalance.pagar += value;
      personBalance.ciclos[cycle].pagar += value;
    } else if (record.status === 'Em aberto') {
      personBalance.emAberto += value;
      personBalance.ciclos[cycle].emAberto += value;
    }
  });

  return Object.values(map)
    .map((item) => ({
      ...item,
      receber: roundCurrency(item.receber),
      pagar: roundCurrency(item.pagar),
      emAberto: roundCurrency(item.emAberto),
      sobra: roundCurrency(item.receber - item.pagar - item.emAberto),
      ciclos: {
        INICIO_MES: {
          ...item.ciclos.INICIO_MES,
          receber: roundCurrency(item.ciclos.INICIO_MES.receber),
          pagar: roundCurrency(item.ciclos.INICIO_MES.pagar),
          emAberto: roundCurrency(item.ciclos.INICIO_MES.emAberto),
          sobra: roundCurrency(item.ciclos.INICIO_MES.receber - item.ciclos.INICIO_MES.pagar - item.ciclos.INICIO_MES.emAberto)
        },
        QUINZENA: {
          ...item.ciclos.QUINZENA,
          receber: roundCurrency(item.ciclos.QUINZENA.receber),
          pagar: roundCurrency(item.ciclos.QUINZENA.pagar),
          emAberto: roundCurrency(item.ciclos.QUINZENA.emAberto),
          sobra: roundCurrency(item.ciclos.QUINZENA.receber - item.ciclos.QUINZENA.pagar - item.ciclos.QUINZENA.emAberto)
        }
      }
    }))
    .sort((a, b) => a.sobra - b.sobra);
}
