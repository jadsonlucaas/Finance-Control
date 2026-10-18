export function initRouter() {
    const originalSwitchTab = window.switchTab;
    
    if (typeof originalSwitchTab !== 'function') {
        console.warn('Router: window.switchTab is not defined yet.');
        return;
    }

    // Intercept switchTab to just update the URL hash
    window.switchTab = function(tab, options = {}) {
        if (options.fromRouter) {
            // Execution from hashchange (just render)
            // Use fromHistory: true to bypass the legacy custom tabHistory array
            originalSwitchTab.call(window, tab, { ...options, fromHistory: true });
        } else {
            // User clicked a button: update hash
            window.location.hash = `/${tab}`;
        }
    };
    
    // Override legacy goBackTab to use browser history
    window.goBackTab = function() {
        window.history.back();
    };

    window.addEventListener('hashchange', () => {
        let tab = window.location.hash.replace('#/', '');
        if (!tab) tab = 'dashboard';
        window.switchTab(tab, { fromRouter: true });
    });

    // Trigger initial route if hash exists
    if (window.location.hash) {
        let tab = window.location.hash.replace('#/', '');
        if (tab) {
            window.switchTab(tab, { fromRouter: true });
        }
    } else {
        // No hash? set it to dashboard silently
        window.history.replaceState(null, '', '#/dashboard');
    }
}

// Automatically initialize when imported
initRouter();
