let authMode = 'login';
        let currentUser = null;
        let currentUserProfile = null;
        let currentAuthClaims = {};
        let managedUsers = [];
        let managedUserLoading = {};

        function accountLifecycle() {
            return window.financeAccountLifecycle || {};
        }

        function syncFinanceAuthContext() {
            if (!window.financeApp) return;
            window.financeApp.authContext = {
                currentUser,
                profile: currentUserProfile,
                claims: currentAuthClaims,
                uid: currentUser?.uid || currentUserProfile?.uid || '',
                role: currentUserProfile?.role || 'user',
                accountStatus: currentUserProfile?.status || 'pending',
                isAdmin: isCurrentUserAdmin()
            };
        }

        function isCurrentUserAdmin() {
            if (currentAuthClaims?.admin === true) return true;
            return currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'owner';
        }
        window.isCurrentUserAdmin = isCurrentUserAdmin;

        function clearFinancialUiState() {
            managedUsers = [];
            allRecords = [];
            if (window.__financeDataServices?.cleanupOnSignOut) {
                window.__financeDataServices.cleanupOnSignOut();
            }
            if (typeof onDataChanged === 'function') {
                onDataChanged([]);
            }
        }

        function setAccountStatusLoading(isLoading) {
            const button = document.getElementById('account-refresh-status');
            if (!button) return;
            button.disabled = isLoading;
            button.classList.toggle('opacity-70', isLoading);
            button.classList.toggle('cursor-not-allowed', isLoading);
        }

        function setAccessNotice(status, email) {
            const notice = document.getElementById('account-access-notice');
            const title = document.getElementById('account-access-title');
            const message = document.getElementById('account-access-message');
            const refreshButton = document.getElementById('account-refresh-status');
            if (!notice || !title || !message) return;

            const lifecycle = accountLifecycle();
            const normalized = lifecycle.normalizeAccountStatus
                ? lifecycle.normalizeAccountStatus(status)
                : status;

            if (!normalized || normalized === 'active') {
                notice.classList.add('hidden');
                return;
            }

            const label = lifecycle.getAccountStatusLabel
                ? lifecycle.getAccountStatusLabel(normalized)
                : 'Conta em validação';
            title.textContent = label;
            message.textContent = lifecycle.getAccountAccessMessage
                ? lifecycle.getAccountAccessMessage(normalized, email)
                : 'Sua conta ainda não está liberada para acessar os dados financeiros.';
            notice.classList.remove('hidden');
            if (refreshButton) refreshButton.classList.toggle('hidden', normalized === 'error');
        }

        function ensureHeaderSessionControls() {
            const actions = document.querySelector('header .flex.items-center.gap-2');
            if (!actions) return;

            if (!document.getElementById('current-user-email')) {
                const badge = document.createElement('div');
                badge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surfaceLight text-textSecondary text-xs';
                badge.innerHTML = '<i data-lucide="user" class="w-4 h-4"></i><span id="current-user-email">Sessão não iniciada</span>';
                actions.prepend(badge);
            }

            if (!document.getElementById('current-user-role')) {
                const roleBadge = document.createElement('div');
                roleBadge.id = 'current-user-role';
                roleBadge.className = 'hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-semibold';
                roleBadge.textContent = 'Visitante';
                actions.prepend(roleBadge);
            }

            if (!document.getElementById('btn-logout')) {
                const logoutButton = document.createElement('button');
                logoutButton.id = 'btn-logout';
                logoutButton.setAttribute('onclick', 'logout()');
                logoutButton.className = 'text-xs bg-danger/10 hover:bg-danger text-danger hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors';
                logoutButton.innerHTML = '<i data-lucide="log-out" class="w-4 h-4"></i><span class="mobile-action-label">Sair</span>';
                actions.appendChild(logoutButton);
            }
        }
        function ensureUserManagementPanel() {
            const settingsWrap = document.querySelector('#view-configuracoes .space-y-6');
            if (!settingsWrap || document.getElementById('admin-users-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'admin-users-panel';
            panel.className = 'bg-surface rounded-xl p-4 border border-surfaceLight hidden';
            panel.innerHTML = [
                '<div class="flex justify-between items-center mb-3">',
                '  <div>',
                '    <h3 class="font-semibold text-sm">Usuários do sistema</h3>',
                '    <p class="text-xs text-textSecondary mt-1">O admin master controla papel e status de acesso.</p>',
                '  </div>',
                '  <button data-legacy-click="refreshManagedUsers" class="bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">',
                '    <i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar',
                '  </button>',
                '</div>',
                '<div id="admin-users-empty" class="text-textSecondary text-xs text-center py-4 hidden">Nenhum usuário cadastrado.</div>',
                '<div id="admin-users-list" class="space-y-2"></div>'
            ].join('');
            settingsWrap.prepend(panel);
        }

        function setAuthError(message) {
            const el = document.getElementById('auth-error');
            if (!el) return;
            el.textContent = message || '';
            el.classList.toggle('hidden', !message);
        }

        function setAuthLoading(isLoading) {
            const button = document.getElementById('auth-submit');
            const text = document.getElementById('auth-submit-text');
            if (!button || !text) return;
            button.disabled = isLoading;
            button.classList.toggle('opacity-70', isLoading);
            button.classList.toggle('cursor-not-allowed', isLoading);
            text.textContent = isLoading ? 'Processando...' : (authMode === 'login' ? 'Entrar' : 'Criar conta');
        }

        function toggleAuthMode() {
            authMode = authMode === 'login' ? 'signup' : 'login';
            document.getElementById('auth-title').textContent = authMode === 'login' ? 'Entrar' : 'Criar conta';
            document.getElementById('auth-subtitle').textContent = authMode === 'login'
                ? 'Use seu email e senha para acessar seus registros financeiros.'
                : 'Crie sua conta para acessar a ?rea pessoal e aguarde liberação do admin quando necessário.';
            document.getElementById('auth-confirm-wrap').classList.toggle('hidden', authMode !== 'signup');
            document.getElementById('auth-confirm-password').required = authMode === 'signup';
            document.getElementById('auth-password').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
            document.getElementById('auth-toggle-label').textContent = authMode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?';
            document.getElementById('auth-toggle-button').textContent = authMode === 'login' ? 'Criar conta' : 'Entrar';
            setAuthError('');
            setAuthLoading(false);
            lucide.createIcons();
        }
        function applyRoleVisibility() {
            const isAdmin = isCurrentUserAdmin();
            const settingsTab = document.querySelector('[data-tab="configuracoes"]');
            const roleBadge = document.getElementById('current-user-role');
            const emailBadge = document.getElementById('current-user-email');
            const adminPanel = document.getElementById('admin-users-panel');
            const macroPanel = document.getElementById('settings-macro-panel');
            const lifecycle = accountLifecycle();
            const roleLabel = currentAuthClaims?.admin === true && currentUserProfile?.role !== 'admin'
                ? 'Admin por claim'
                : (lifecycle.getAccountRoleLabel ? lifecycle.getAccountRoleLabel(currentUserProfile?.role) : 'Usuário padrão');

            if (settingsTab) settingsTab.classList.remove('hidden');
            if (roleBadge) roleBadge.textContent = roleLabel;
            if (emailBadge) emailBadge.textContent = currentUser?.email || 'Sessão não iniciada';
            if (adminPanel) adminPanel.classList.toggle('hidden', !isAdmin);
            if (macroPanel) macroPanel.classList.remove('hidden');

        }

        async function refreshManagedUsers() {
            if (!isCurrentUserAdmin() || !window.userAdminSdk) return;
            managedUsers = await window.userAdminSdk.listUsers();
            renderManagedUsers();
        }

        function renderManagedUsers() {
            const list = document.getElementById('admin-users-list');
            const empty = document.getElementById('admin-users-empty');
            const panel = document.getElementById('admin-users-panel');
            if (!list || !empty || !panel) return;

            if (!isCurrentUserAdmin()) {
                panel.classList.add('hidden');
                return;
            }

            panel.classList.remove('hidden');

            if (!managedUsers.length) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                lucide.createIcons();
                return;
            }

            empty.classList.add('hidden');
            list.innerHTML = managedUsers.map((user) => {
                const isSelf = user.uid === currentUser?.uid;
                const lifecycle = accountLifecycle();
                const status = lifecycle.normalizeAccountStatus ? lifecycle.normalizeAccountStatus(user.status) : user.status;
                const role = lifecycle.normalizeAccountRole ? lifecycle.normalizeAccountRole(user.role) : user.role;
                const statusLabel = lifecycle.getAccountStatusLabel ? lifecycle.getAccountStatusLabel(status) : status;
                const roleLabel = lifecycle.getAccountRoleLabel ? lifecycle.getAccountRoleLabel(role) : role;
                const isLoading = Boolean(managedUserLoading[user.uid]);
                const disabled = isSelf || isLoading ? 'disabled' : '';
                const statusClasses = status === 'inactive'
                    ? 'bg-warn/10 text-warn'
                    : (status === 'pending' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success');
                const statusButtons = [
                    status === 'pending'
                        ? `<button data-set-managed-user-status="${user.uid}" data-managed-user-status="active" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success hover:text-white transition-colors" ${disabled}>Aprovar</button>`
                        : '',
                    status !== 'inactive'
                        ? `<button data-set-managed-user-status="${user.uid}" data-managed-user-status="inactive" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-warn/10 text-warn hover:bg-warn hover:text-white transition-colors" ${disabled}>Desativar</button>`
                        : `<button data-set-managed-user-status="${user.uid}" data-managed-user-status="active" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-success/10 text-success hover:bg-success hover:text-white transition-colors" ${disabled}>Reativar</button>`
                ].filter(Boolean).join('');
                return `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <div class="font-medium text-sm text-textPrimary">${user.email || 'Sem email'}</div>
                                <div class="text-xs text-textSecondary mt-1">UID: ${user.uid}</div>
                                <div class="flex gap-2 mt-2 flex-wrap">
                                    <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${role === 'admin' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}">${roleLabel}</span>
                                    <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${statusClasses}">${statusLabel}</span>
                                    ${isSelf ? '<span class="px-2 py-1 rounded-full text-[11px] font-semibold bg-surface text-textSecondary border border-surfaceLight">Você</span>' : ''}
                                    ${isLoading ? '<span class="px-2 py-1 rounded-full text-[11px] font-semibold bg-surface text-textSecondary border border-surfaceLight">Atualizando</span>' : ''}
                                </div>
                            </div>
                            <div class="flex gap-2 flex-wrap">
                                <button data-set-managed-user-role="${user.uid}" data-managed-user-role="admin" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${role === 'admin' ? 'bg-danger text-white' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'} transition-colors" ${disabled}>Admin</button>
                                <button data-set-managed-user-role="${user.uid}" data-managed-user-role="user" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${role === 'user' ? 'bg-accent text-white' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'} transition-colors" ${disabled}>Padrão</button>
                                ${statusButtons}
                            </div>
                        </div>
                    </div>`;
            }).join('');
            lucide.createIcons();
        }

        async function setManagedUserRole(uid, role) {
            if (!isCurrentUserAdmin() || !window.userAdminSdk || uid === currentUser?.uid) return;
            if (managedUserLoading[uid]) return;
            const target = managedUsers.find((user) => user.uid === uid);
            if (!target || target.role === role) return;
            try {
                managedUserLoading[uid] = true;
                renderManagedUsers();
                await window.userAdminSdk.updateUser(uid, { role });
                await refreshManagedUsers();
                showToast('Perfil atualizado!');
            } catch (error) {
                console.error(error);
                showToast('Erro ao atualizar perfil do usuário', true);
            } finally {
                delete managedUserLoading[uid];
                renderManagedUsers();
            }
        }

        async function setManagedUserStatus(uid, status) {
            if (!isCurrentUserAdmin() || !window.userAdminSdk || uid === currentUser?.uid) return;
            if (managedUserLoading[uid]) return;
            const target = managedUsers.find((user) => user.uid === uid);
            if (!target || target.status === status) return;
            if (status === 'inactive' && !confirm('Desativar este usuário e bloquear o acesso aos dados financeiros?')) return;
            try {
                managedUserLoading[uid] = true;
                renderManagedUsers();
                await window.userAdminSdk.updateUser(uid, { status });
                await refreshManagedUsers();
                const label = status === 'active' ? 'acesso liberado' : 'acesso bloqueado';
                showToast(`Status atualizado: ${label}.`);
            } catch (error) {
                console.error(error);
                showToast('Erro ao atualizar status do usuário', true);
            } finally {
                delete managedUserLoading[uid];
                renderManagedUsers();
            }
        }

        async function toggleManagedUserStatus(uid) {
            const target = managedUsers.find((user) => user.uid === uid);
            if (!target) return;
            const status = target.status === 'inactive' ? 'active' : 'inactive';
            await setManagedUserStatus(uid, status);
        }

        async function refreshAccountStatus() {
            if (!currentUser || !window.userAdminSdk) return;
            try {
                setAccountStatusLoading(true);
                currentUserProfile = await window.userAdminSdk.getProfile(currentUser.uid);
                if (currentUserProfile?.status === 'active') {
                    await applyAuthState(currentUser);
                    return;
                }
                setAccessNotice(currentUserProfile?.status || 'pending', currentUser.email);
            } catch (error) {
                console.error(error);
                setAccessNotice('error', currentUser.email);
                setAuthError('Não foi possível verificar o status da conta.');
            } finally {
                setAccountStatusLoading(false);
                lucide.createIcons();
            }
        }

        async function applyAuthState(authPayload) {
            const app = document.getElementById('app');
            const authScreen = document.getElementById('auth-screen');
            ensureHeaderSessionControls();
            ensureUserManagementPanel();

            if (!authPayload) {
                currentUser = null;
                currentUserProfile = null;
                currentAuthClaims = {};
                syncFinanceAuthContext();
                managedUsers = [];
                managedUserLoading = {};
                clearFinancialUiState();
                window.financeApp?.plannerStorage?.resetPlannerView?.();
                setAccessNotice('', '');
                app.classList.add('hidden');
                authScreen.classList.remove('hidden');
                renderManagedUsers();
                return;
            }

            currentUser = authPayload;
            setAuthLoading(true);
            setAccessNotice('', '');
            app.classList.add('hidden');
            authScreen.classList.add('hidden');

            try {
                currentAuthClaims = await window.authSdk.getClaims?.(true) || {};
                currentUserProfile = await window.userAdminSdk.ensureProfile(authPayload);
                syncFinanceAuthContext();
                const lifecycle = accountLifecycle();
                const accessState = lifecycle.getUserAccessState
                    ? lifecycle.getUserAccessState(currentUserProfile, currentAuthClaims)
                    : { canAccessFinancialData: currentUserProfile?.status === 'active', status: currentUserProfile?.status };

                if (!accessState.canAccessFinancialData) {
                    clearFinancialUiState();
                    window.financeApp?.plannerStorage?.resetPlannerView?.();
                    app.classList.add('hidden');
                    authScreen.classList.remove('hidden');
                    setAccessNotice(accessState.status || 'pending', authPayload.email);
                    setAuthError('');
                    return;
                }

                authScreen.classList.add('hidden');
                app.classList.remove('hidden');
                applyRoleVisibility();
                requestAnimationFrame(() => initSdk());
                if (isCurrentUserAdmin()) {
                    setTimeout(() => {
                        refreshManagedUsers().catch(console.error);
                    }, 0);
                } else {
                    managedUsers = [];
                    renderManagedUsers();
                }
                if (currentTab === 'configuracoes') renderConfiguracoes();
            } catch (error) {
                console.error(error);
                clearFinancialUiState();
                syncFinanceAuthContext();
                window.financeApp?.plannerStorage?.resetPlannerView?.();
                app.classList.add('hidden');
                authScreen.classList.remove('hidden');
                setAccessNotice('error', authPayload.email);
                setAuthError('Não foi possível carregar o perfil do usuário.');
            } finally {
                setAuthLoading(false);
                lucide.createIcons();
            }
        }

        async function handleAuthSubmit(event) {
            event.preventDefault();
            if (!window.authSdk) return;

            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const confirmPassword = document.getElementById('auth-confirm-password').value;

            if (!email || !password) {
                setAuthError('Informe email e senha.');
                return;
            }

            if (authMode === 'signup' && password !== confirmPassword) {
                setAuthError('As senhas não conferem.');
                return;
            }

            try {
                setAuthError('');
                setAuthLoading(true);
                if (authMode === 'login') {
                    await window.authSdk.signIn(email, password);
                } else {
                    await window.authSdk.signUp(email, password);
                }
            } catch (error) {
                setAuthError(window.authSdk.normalizeError(error));
                setAuthLoading(false);
            }
        }

        async function logout() {
            if (!window.authSdk) return;
            try {
                await window.authSdk.signOut();
            } catch (error) {
                console.error(error);
                showToast('Erro ao encerrar sessão', true);
            }
        }

        (function bootstrapRoleAwareUi() {
            ensureHeaderSessionControls();
            ensureUserManagementPanel();
            window.addEventListener('authStateChanged', (event) => {
                applyAuthState(event.detail);
            });
            const persistedUser = window.authSdk?.getCurrentUser?.();
            if (persistedUser) {
                applyAuthState({ uid: persistedUser.uid, email: persistedUser.email || '' });
            }
            document.getElementById('account-refresh-status')?.addEventListener('click', () => {
                refreshAccountStatus().catch(console.error);
            });
            document.getElementById('account-logout-button')?.addEventListener('click', () => {
                logout().catch(console.error);
            });
            setAuthLoading(false);

            lucide.createIcons();
        })();
