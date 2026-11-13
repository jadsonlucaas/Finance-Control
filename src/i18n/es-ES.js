/**
 * Espanol (Espana). Chave = texto exato em portugues que aparece na tela.
 * Para adicionar uma tela: copie o texto em portugues como esta no codigo e escreva a traducao.
 * Frases com numeros ou nomes no meio vao em `patterns`.
 */
import { SCREEN_MESSAGES, SCREEN_PATTERNS } from './es-ES-screens.js';

const messages = {
  ...SCREEN_MESSAGES,
  // --- Login e cadastro ---
  'Acesso Seguro': 'Acceso seguro',
  'Entrar': 'Iniciar sesión',
  'Criar conta': 'Crear cuenta',
  'Sua conta': 'Tu cuenta',
  'Voltar para o login': 'Volver al inicio de sesión',
  'Use seu email e senha para acessar seus registros financeiros.': 'Usa tu correo y contraseña para acceder a tus registros financieros.',
  'Crie sua conta grátis. O Premium (WhatsApp, alertas e IA) tem 7 dias grátis.': 'Crea tu cuenta gratis. Premium (WhatsApp, alertas e IA) tiene 7 días gratis.',
  'Email': 'Correo electrónico',
  'voce@exemplo.com': 'tu@ejemplo.com',
  'Senha': 'Contraseña',
  'Sua senha': 'Tu contraseña',
  'Confirmar senha': 'Confirmar contraseña',
  'Repita a senha': 'Repite la contraseña',
  'Nome': 'Nombre',
  'Seu nome': 'Tu nombre',
  'País': 'País',
  'Brasil': 'Brasil',
  'Espanha': 'España',
  'Portugal': 'Portugal',
  '(assistente Premium)': '(asistente Premium)',
  'Aceito receber mensagens no WhatsApp (boas-vindas e alertas). Posso cancelar quando quiser.': 'Acepto recibir mensajes por WhatsApp (bienvenida y alertas). Puedo cancelarlo cuando quiera.',
  'Ainda não tem conta?': '¿Aún no tienes cuenta?',
  'Já tem conta?': '¿Ya tienes cuenta?',
  'Processando...': 'Procesando...',
  'Informe email e senha.': 'Introduce tu correo y contraseña.',
  'As senhas não conferem.': 'Las contraseñas no coinciden.',
  'Informe seu nome.': 'Introduce tu nombre.',
  'Escolha o país.': 'Elige el país.',
  'Informe um telefone de WhatsApp válido, com DDD.': 'Introduce un teléfono de WhatsApp válido, con prefijo.',
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.': 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
  // Erros de autenticacao (src/services/authErrors.js)
  'Este email já está em uso.': 'Este correo ya está en uso.',
  'Informe um email válido.': 'Introduce un correo válido.',
  'Email ou senha inválidos.': 'Correo o contraseña incorrectos.',
  'A senha precisa ter pelo menos 6 caracteres.': 'La contraseña debe tener al menos 6 caracteres.',
  'Informe a senha.': 'Introduce la contraseña.',
  'Falha de rede ao autenticar.': 'Error de red al iniciar sesión.',
  'Não foi possível concluir a autenticação.': 'No se pudo completar el inicio de sesión.',
  // Situacao da conta
  'Conta em validação': 'Cuenta en validación',
  'Verificar status': 'Comprobar estado',
  'Verificar novamente': 'Comprobar de nuevo',
  'Não foi possível validar seu acesso': 'No se pudo validar tu acceso',
  'Use “Verificar novamente” para repetir apenas a validação do perfil.': 'Usa «Comprobar de nuevo» para repetir solo la validación del perfil.',
  'Sua conta ainda não está liberada para acessar os dados financeiros.': 'Tu cuenta aún no tiene acceso a los datos financieros.',
  'Aguardando aprovacao': 'Pendiente de aprobación',
  'Ativo': 'Activo',
  'Inativo': 'Inactivo',

  // --- Cabecalho ---
  'Controle Financeiro': 'Control Financiero',
  'Usuario padrao': 'Usuario estándar',
  'Usuário padrão': 'Usuario estándar',
  'Admin master': 'Admin principal',
  'Admin por claim': 'Admin por permiso',
  'Visitante': 'Invitado',
  'Sessão não iniciada': 'Sesión no iniciada',
  'Modo escuro': 'Modo oscuro',
  'Modo claro': 'Modo claro',
  'Novo lançamento': 'Nuevo movimiento',
  'Relatório PDF': 'Informe PDF',
  'Sair': 'Salir',

  // --- Configuracoes: idioma, moeda e regiao ---
  'Idioma, moeda e região': 'Idioma, moneda y región',
  'Cada opção é independente. A moeda muda só a forma de mostrar os valores; nada é convertido.': 'Cada opción es independiente. La moneda solo cambia cómo se muestran los importes; no se convierte nada.',
  'Idioma': 'Idioma',
  'Moeda': 'Moneda',
  'Fuso horário': 'Zona horaria',
  'Real (R$)': 'Real (R$)',
  'Euro (€)': 'Euro (€)',
  'O país também define a moeda da assinatura Premium.': 'El país también define la moneda de la suscripción Premium.',
  'Salvar': 'Guardar',
  'Salvando...': 'Guardando...',
  'Preferências salvas.': 'Preferencias guardadas.',
  'Complete seu cadastro antes de mudar essas opções.': 'Completa tu registro antes de cambiar estas opciones.',
  'Escolha o idioma.': 'Elige el idioma.',
  'Escolha a moeda.': 'Elige la moneda.',
  'Escolha o fuso horário.': 'Elige la zona horaria.',
  'Brasília / São Paulo': 'Brasilia / São Paulo',
  'Madri (península e Baleares)': 'Madrid (península y Baleares)',
  'Ilhas Canárias': 'Islas Canarias',
  'Ceuta e Melilla': 'Ceuta y Melilla',
  'Lisboa (continente)': 'Lisboa (continente)',
  'Açores': 'Azores'
};

const patterns = [...SCREEN_PATTERNS];

export const ES_ES = Object.freeze({ messages: Object.freeze(messages), patterns: Object.freeze(patterns) });
