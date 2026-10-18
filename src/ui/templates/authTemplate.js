export function authTemplate() {
  return `
    <div id="auth-screen" class="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
        <div class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"></div>
        <div class="relative z-10 w-full max-w-md glass rounded-3xl p-6 md:p-8 shadow-2xl border border-white/50">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-11 h-11 rounded-2xl bg-accent/20 flex items-center justify-center">
                    <i data-lucide="wallet" class="w-6 h-6 text-accent"></i>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-textSecondary">Acesso Seguro</p>
                    <h2 id="auth-title" class="text-2xl font-bold text-textPrimary">Entrar</h2>
                </div>
            </div>
            <p id="auth-subtitle" class="text-sm text-textSecondary mb-6">Use seu email e senha para acessar seus registros financeiros.</p>
            <form id="auth-form" class="space-y-4">
                <div>
                    <label for="auth-email" class="text-xs text-textSecondary mb-1 block">Email</label>
                    <input id="auth-email" type="email" autocomplete="email" placeholder="voce@exemplo.com" class="w-full text-sm" required>
                </div>
                <div>
                    <label for="auth-password" class="text-xs text-textSecondary mb-1 block">Senha</label>
                    <input id="auth-password" type="password" autocomplete="current-password" placeholder="Sua senha" class="w-full text-sm" required>
                </div>
                <div id="auth-confirm-wrap" class="hidden">
                    <label for="auth-confirm-password" class="text-xs text-textSecondary mb-1 block">Confirmar senha</label>
                    <input id="auth-confirm-password" type="password" autocomplete="new-password" placeholder="Repita a senha" class="w-full text-sm">
                </div>
                <div id="auth-error" class="hidden text-sm rounded-lg border border-danger/20 bg-danger/10 text-danger px-3 py-2"></div>
                <div id="account-access-notice" class="hidden rounded-xl border border-surfaceLight bg-surfaceLight/60 px-3 py-3">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                            <i data-lucide="shield-check" class="w-4 h-4"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 id="account-access-title" class="text-sm font-semibold text-textPrimary">Conta em validação</h3>
                            <p id="account-access-message" class="text-xs text-textSecondary mt-1"></p>
                            <div class="flex gap-2 mt-3 flex-wrap">
                                <button id="account-refresh-status" type="button" class="bg-accent hover:bg-accentDark text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="refresh-cw" class="w-3 h-3"></i> Verificar status
                                </button>
                                <button id="account-logout-button" type="button" class="bg-surface border border-surfaceLight text-textSecondary hover:text-textPrimary text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                    <i data-lucide="log-out" class="w-3 h-3"></i> Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <button id="auth-submit" type="submit" class="w-full bg-accent hover:bg-accentDark text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
                    <i data-lucide="log-in" class="w-4 h-4"></i>
                    <span id="auth-submit-text">Entrar</span>
                </button>
            </form>
            <div class="mt-5 text-sm text-center text-textSecondary">
                <span id="auth-toggle-label">Ainda não tem conta?</span>
                <button type="button" class="text-accent font-semibold hover:underline ml-1" id="auth-toggle-button">Criar conta</button>
            </div>
        </div>
    </div>`;
}
