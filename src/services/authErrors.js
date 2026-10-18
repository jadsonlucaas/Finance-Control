export function normalizeAuthError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'Este email já está em uso.',
    'auth/invalid-email': 'Informe um email válido.',
    'auth/invalid-credential': 'Email ou senha inválidos.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/missing-password': 'Informe a senha.',
    'auth/network-request-failed': 'Falha de rede ao autenticar.',
    'auth/operation-not-allowed': 'O provedor Email/Senha não está habilitado no Firebase Auth.',
    'auth/configuration-not-found': 'A autenticação do Firebase não está configurada para este projeto.',
    'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Auth.'
  };
  return map[code] || 'Não foi possível concluir a autenticação.';
}
