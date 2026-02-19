// =============================================================================
// Shared Log Data Store
// =============================================================================
// Centralized store for audit logs and organizational changes.
// Used by the Company Profile "Activity Feed" to show real-time history.
// =============================================================================

const SharedLogStore = (() => {
    // ── Audit Logs ───────────────────────────────────────────────────────
    // Runtime log store — starts empty; all entries are real and user-generated
    let logs = [];

    // ── Change listeners ─────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedLogStore listener error:', e); }
        });
    }

    // ── Public API ───────────────────────────────────────────────────────
    return {
        /** Register a callback: fn(action, data) */
        onChange(fn) {
            listeners.push(fn);
        },

        /** Get all logs (returns a copy, latest first) */
        getAll() {
            return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        },

        /** Add a new log entry */
        add(data) {
            const log = {
                id: 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                type: data.type || 'info', // audit, hire, update, delete, hierarchy, sync
                user: {
                    name: data.userName || (typeof AuthStore !== 'undefined' && AuthStore.getSession()?.name) || 'System',
                    avatar: data.userAvatar || (typeof AuthStore !== 'undefined' && AuthStore.getSession()?.avatar) || null
                },
                action: data.action || '',
                target: data.target || '',
                timestamp: new Date().toISOString(),
                icon: data.icon || 'info',
                iconBg: data.iconBg || 'bg-slate-500',
                details: data.details || null
            };

            logs.unshift(log);

            // Cap at 100 logs for now to prevent memory issues
            if (logs.length > 100) logs.pop();

            notifyListeners('add', log);
            return log;
        },

        /** Clear all logs */
        clear() {
            logs = [];
            notifyListeners('clear', null);
        }
    };
})();

console.log('shared-logs.js loaded —', SharedLogStore.getAll().length, 'logs');
