// =============================================================================
// Shared Log Data Store
// =============================================================================
// Centralized store for audit logs and organizational changes.
// Used by the Company Profile "Activity Feed" to show real-time history.
// Data is persisted to localStorage so logs survive page refreshes.
// =============================================================================

const SharedLogStore = (() => {
    const STORAGE_KEY = 'orgchart_logs';

    // ── Persistence helpers ───────────────────────────────────────────────
    function _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        } catch (e) {
            // Quota exceeded — trim to 10 entries and retry
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                logs = logs.slice(0, 10);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
                } catch (e2) {
                    console.error('SharedLogStore: still cannot save after trimming', e2);
                }
            } else {
                console.error('SharedLogStore: failed to save to localStorage', e);
            }
        }
    }

    // ── Audit Logs ───────────────────────────────────────────────────────
    // Load from localStorage on startup; starts empty on first run.
    let logs = _load();

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

            // Cap at 30 logs to prevent localStorage bloat
            if (logs.length > 30) logs.pop();

            _save();
            notifyListeners('add', log);
            return log;
        },

        /** Clear all logs */
        clear() {
            logs = [];
            _save();
            notifyListeners('clear', null);
        }
    };
})();
