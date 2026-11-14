/**
 * Espanol (Espana): aceite de Termos/Privacidade (cadastro e aviso ao entrar) e
 * painel "Privacidade e dados" em Configurações.
 * Chave = texto em portugues como aparece na tela.
 */
export const PRIVACY_MESSAGES = Object.freeze({
  // Cadastro
  'Li e aceito os': 'He leído y acepto los',
  'Termos de Uso': 'Términos de uso',
  'e a': 'y la',
  'Política de Privacidade': 'Política de privacidad',
  'Aceite os Termos de Uso e a Política de Privacidade para criar a conta.': 'Acepta los Términos de uso y la Política de privacidad para crear la cuenta.',
  // Aviso ao entrar
  'Termos de Uso e Política de Privacidade': 'Términos de uso y Política de privacidad',
  'Atualizamos os Termos de Uso e a Política de Privacidade. Leia e aceite a nova versão para continuar.': 'Hemos actualizado los Términos de uso y la Política de privacidad. Léelos y acepta la nueva versión para continuar.',
  'Para continuar, leia e aceite os Termos de Uso e a Política de Privacidade.': 'Para continuar, lee y acepta los Términos de uso y la Política de privacidad.',
  'Li e aceito': 'He leído y acepto',
  'Salvando...': 'Guardando...',
  'Não foi possível salvar agora. Tente de novo.': 'No se pudo guardar ahora. Inténtalo de nuevo.',
  // Painel
  'Privacidade e dados': 'Privacidad y datos',
  'O que você aceitou, suas autorizações e seus dados.': 'Lo que aceptaste, tus autorizaciones y tus datos.',
  'Documentos': 'Documentos',
  'Há uma nova versão para aceitar.': 'Hay una nueva versión para aceptar.',
  'Ainda não aceitos nesta conta.': 'Aún no aceptados en esta cuenta.',
  'Histórico de aceites': 'Historial de aceptaciones',
  'no cadastro': 'en el registro',
  'no app': 'en la app',
  'Autorizações': 'Autorizaciones',
  'Alertas no WhatsApp': 'Alertas por WhatsApp',
  'Autorizados': 'Autorizadas',
  'Revogados': 'Revocadas',
  'Não autorizados': 'No autorizadas',
  'Mensagens de boas-vindas no WhatsApp': 'Mensajes de bienvenida por WhatsApp',
  'Aceitas no cadastro': 'Aceptados en el registro',
  'Não aceitas': 'No aceptados',
  'Gerenciar alertas': 'Gestionar alertas',
  'Seus dados': 'Tus datos',
  'Baixar uma cópia de todos os seus dados.': 'Descargar una copia de todos tus datos.',
  'Arquivo JSON com tudo e uma planilha CSV dos lançamentos.': 'Archivo JSON con todo y una hoja CSV de los movimientos.',
  'Preparando...': 'Preparando...',
  'Exportar meus dados': 'Exportar mis datos',
  'Para apagar a conta e todos os dados, use "Excluir minha conta" no fim desta página. Os prazos de guarda de cada dado estão na': 'Para borrar la cuenta y todos los datos, usa "Eliminar mi cuenta" al final de esta página. Los plazos de conservación de cada dato están en la',
  'Aceite registrado.': 'Aceptación registrada.',
  'Arquivos baixados.': 'Archivos descargados.',
  'Não foi possível exportar agora. Tente de novo.': 'No se pudo exportar ahora. Inténtalo de nuevo.'
});

export const PRIVACY_PATTERNS = Object.freeze([
  [/^Aceitos em (.+)\.$/, 'Aceptados el $1.']
]);
