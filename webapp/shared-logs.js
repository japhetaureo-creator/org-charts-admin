// =============================================================================
// Shared Log Data Store — Firestore-backed
// =============================================================================
// Centralized store for audit logs. Primary: Firestore, Fallback: localStorage.
// Used by the Company Profile "Activity Feed" to show real-time history.
// =============================================================================

const SharedLogStore = (() => {
    const STORAGE_KEY = 'orgchart_logs';
    const COLLECTION = 'logs';
    const MAX_LOGS = 50;

    // ── Firestore helpers ─────────────────────────────────────────────────
    function _getDb() { return window.firebaseDb || null; }
    function _collection() { const db = _getDb(); return db ? db.collection(COLLECTION) : null; }

    // ── localStorage helpers ─────────────────────────────────────────────
    function _loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function _saveLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                logs = logs.slice(0, 10);
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); }
                catch { /* give up */ }
            }
        }
    }

    // ── State ─────────────────────────────────────────────────────────────
    let logs = _loadLocal();

    // ── Change listeners ─────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedLogStore listener error:', e); }
        });
    }

    // ── Firestore sync ───────────────────────────────────────────────────
    async function _syncFromFirestore() {
        const col = _collection();
        if (!col) return;
        try {
            const snapshot = await col.orderBy('timestamp', 'desc').limit(MAX_LOGS).get();
            if (!snapshot.empty) {
                logs = [];
                snapshot.forEach(doc => {
                    logs.push({ id: doc.id, ...doc.data() });
                });
                console.log('[LogStore] Loaded', logs.length, 'logs from Firestore');
            } else if (logs.length > 0) {
                // Push local logs to Firestore on first run
                console.log('[LogStore] Firestore empty, uploading', logs.length, 'local logs');
                for (const log of logs) {
                    await col.doc(log.id).set(log);
                }
            }
            _saveLocal();
            notifyListeners('sync', null);
        } catch (e) {
            console.error('[LogStore] Firestore sync failed:', e);
        }
    }

    // ── Public API ───────────────────────────────────────────────────────
    const store = {
        onChange(fn) { listeners.push(fn); },

        getAll() {
            return [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        },

        add(data) {
            const log = {
                id: 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                type: data.type || 'info',
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
            if (logs.length > MAX_LOGS) logs.pop();
            _saveLocal();

            // Write to Firestore (fire and forget)
            const col = _collection();
            if (col) {
                col.doc(log.id).set(log).catch(e =>
                    console.error('[LogStore] Firestore write failed:', e)
                );
            }

            notifyListeners('add', log);
            return log;
        },

        clear() {
            logs = [];
            _saveLocal();
            // Clear Firestore logs (best-effort batch delete)
            const col = _collection();
            if (col) {
                col.get().then(snapshot => {
                    snapshot.forEach(doc => doc.ref.delete());
                }).catch(() => { });
            }
            notifyListeners('clear', null);
        },

        async refresh() { await _syncFromFirestore(); }
    };

    // Auto-sync on load
    setTimeout(() => _syncFromFirestore(), 800);

    return store;
})();
