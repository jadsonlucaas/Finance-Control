/**
 * Espanol (Espana): painel "Notificações" em Configurações.
 * Chave = texto em portugues como aparece na tela.
 */
export const NOTIFICATION_MESSAGES = Object.freeze({
  'Notificações': 'Notificaciones',
  'Escolha quais alertas quer receber e em que horário.': 'Elige qué alertas quieres recibir y a qué hora.',
  'Tipos de alerta': 'Tipos de alerta',
  'Contas a vencer': 'Facturas por vencer',
  'Aviso antes do vencimento de despesas em aberto.': 'Aviso antes del vencimiento de gastos pendientes.',
  'Contas vencidas': 'Facturas vencidas',
  'Um aviso por conta vencida e não paga.': 'Un aviso por cada factura vencida y no pagada.',
  'Limite de orçamento': 'Límite de presupuesto',
  'Aviso ao chegar a 80% e a 100% do limite no mês.': 'Aviso al llegar al 80 % y al 100 % del límite del mes.',
  'Resumo mensal': 'Resumen mensual',
  'Receitas, despesas e compromissos do mês anterior, no dia 1.': 'Ingresos, gastos y compromisos del mes anterior, el día 1.',
  'Antecedência das contas a vencer': 'Antelación de las facturas por vencer',
  '1 dia antes': '1 día antes',
  'Horário de envio': 'Hora de envío',
  'O horário segue o fuso escolhido em "Idioma, moeda e região".': 'La hora sigue la zona horaria elegida en "Idioma, moneda y región".',
  'WhatsApp': 'WhatsApp',
  'Autorizo o envio de alertas financeiros (contas a vencer, contas vencidas, orçamento e resumo mensal) para o meu WhatsApp vinculado. Posso revogar quando quiser aqui ou mandando "parar alertas" no WhatsApp.':
    'Autorizo el envío de alertas financieras (facturas por vencer, facturas vencidas, presupuesto y resumen mensual) a mi WhatsApp vinculado. Puedo revocarlo cuando quiera aquí o enviando "parar alertas" por WhatsApp.',
  'Alertas no WhatsApp ainda não autorizados.': 'Alertas por WhatsApp aún no autorizadas.',
  'Alertas no WhatsApp autorizados.': 'Alertas por WhatsApp autorizadas.',
  'Autorização revogada.': 'Autorización revocada.',
  'Autorizar alertas no WhatsApp': 'Autorizar alertas por WhatsApp',
  'Revogar autorização': 'Revocar autorización',
  'Os alertas no WhatsApp fazem parte do Premium e usam o número vinculado em Configurações.': 'Las alertas por WhatsApp forman parte de Premium y usan el número vinculado en Configuración.',
  'Preferências salvas.': 'Preferencias guardadas.',
  'Autorização revogada. Nenhum alerta será enviado pelo WhatsApp.': 'Autorización revocada. No se enviará ninguna alerta por WhatsApp.',
  'Confira as opções escolhidas.': 'Revisa las opciones elegidas.'
});

export const NOTIFICATION_PATTERNS = Object.freeze([
  [/^(\d+) dias antes$/, '$1 días antes'],
  [/^Alertas no WhatsApp autorizados em (.+)\.$/, 'Alertas por WhatsApp autorizadas el $1.'],
  [/^Autorização revogada em (.+)\.$/, 'Autorización revocada el $1.']
]);
