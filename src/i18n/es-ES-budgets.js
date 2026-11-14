/**
 * Espanol (Espana): tela de Orcamentos (#/orcamentos).
 * Chave = texto em portugues como aparece na tela.
 */
import { translateMonthLabel } from './es-ES-screens.js';

export const BUDGET_MESSAGES = Object.freeze({
  'Orçamentos': 'Presupuestos',
  'Defina quanto quer gastar por mês e acompanhe o quanto já usou.': 'Define cuánto quieres gastar al mes y sigue cuánto has usado.',
  'Mês': 'Mes',
  'Orçamento total do mês': 'Presupuesto total del mes',
  'Você ainda não definiu um limite total. Gasto do mês até agora:': 'Aún no has definido un límite total. Gasto del mes hasta ahora:',
  'Disponível:': 'Disponible:',
  'Passou do limite em': 'Te pasaste del límite en',
  'Pago': 'Pagado',
  'A pagar': 'Por pagar',
  'Limite': 'Límite',
  'Dentro do limite': 'Dentro del límite',
  'Perto do limite': 'Cerca del límite',
  'Limite atingido': 'Límite alcanzado',
  'Limite ultrapassado': 'Límite superado',
  'Editar': 'Editar',
  'Remover': 'Eliminar',
  'Confirmar remoção': 'Confirmar eliminación',
  'Cancelar': 'Cancelar',
  'Definir limite': 'Definir límite',
  'Editar limite': 'Editar límite',
  'Categoria': 'Categoría',
  'Escolha a categoria': 'Elige la categoría',
  'Total do mês (todas as categorias)': 'Total del mes (todas las categorías)',
  'Limite por mês': 'Límite al mes',
  'Salvar': 'Guardar',
  'Salvando...': 'Guardando...',
  'Limites por categoria': 'Límites por categoría',
  'Nenhum limite por categoria neste mês. Escolha uma categoria acima para começar.': 'No hay límites por categoría este mes. Elige una categoría arriba para empezar.',
  'Gastos em categorias sem limite:': 'Gastos en categorías sin límite:',
  'Limite salvo.': 'Límite guardado.',
  'Limite removido.': 'Límite eliminado.',
  'Informe um valor válido (ex.: 500 ou 500,00).': 'Introduce un importe válido (ej.: 500 o 500,00).',
  'Escolha a categoria.': 'Elige la categoría.',
  'Sem permissão para salvar. Entre de novo na sua conta.': 'Sin permiso para guardar. Vuelve a iniciar sesión.',
  'Não foi possível salvar. Tente de novo.': 'No se pudo guardar. Inténtalo de nuevo.',
  'Não foi possível remover. Tente de novo.': 'No se pudo eliminar. Inténtalo de nuevo.',
  'Não foi possível carregar os orçamentos.': 'No se pudieron cargar los presupuestos.',
  'Verifique sua conexão e tente de novo.': 'Comprueba tu conexión e inténtalo de nuevo.',
  'Tentar de novo': 'Reintentar',
  'Nao foi possivel carregar Orcamentos. Tente novamente.': 'No se pudieron cargar los presupuestos. Inténtalo de nuevo.'
});

export const BUDGET_PATTERNS = Object.freeze([
  [/^Vale a partir de (.+) e se repete nos meses seguintes\. Os meses anteriores não mudam\.$/,
    (_, month) => `Se aplica desde ${translateMonthLabel(month)} y se repite en los meses siguientes. Los meses anteriores no cambian.`],
  [/^Pago (.+) · A pagar (.+)$/, 'Pagado $1 · Por pagar $2']
]);
