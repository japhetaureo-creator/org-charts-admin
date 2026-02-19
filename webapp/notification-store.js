// =============================================================================
// Notification Store
// =============================================================================
// Listens to SharedLogStore events and converts them into dismissable
// notifications. Persists the last 50 to localStorage. Respects the user's
// saved notification preferences from AppSettings.
// =============================================================================

const NotificationStore = (() => {
    const STORAGE_KEY = 'orgchart_notifications';
    const MAX_STORED = 50;

    // ── In-memory list ────────────────────────────────────────────────────────
    let notifications = _loadFromStorage();

    // ── Change listeners ──────────────────────────────────────────────────────
    const listeners = [];

    function _notify(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('NotificationStore listener error:', e); }
        });
    }

    // ── Persistence ───────────────────────────────────────────────────────────
    function _loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function _saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
        } catch { /* storage full — ignore */ }
    }

    // ── Map a log entry → notification ────────────────────────────────────────
    function _logToNotification(log) {
        const prefs = _getPrefs();

        // Determine notification type + whether prefs allow it
        let title, body, icon, critical = false, allowed = false;

        switch (log.type) {
            case 'hire':
                if (!prefs.onEmployeeAdd) return null;
                title = 'Employee Added';
                body = log.target
                    ? `${log.target} joined the organization.`
                    : 'A new employee joined the organization.';
                icon = 'person_add';
                allowed = true;
                break;

            case 'delete':
                if (!prefs.onEmployeeRemove) return null;
                title = 'Employee Removed';
                body = `${log.target} was removed from the directory.`;
                icon = 'person_remove';
                critical = true;
                allowed = true;
                break;

            case 'status_change':
                if (!prefs.onEmployeeRemove) return null;
                title = 'Employee Status Changed';
                body = log.action;
                icon = 'swap_horiz';
                allowed = true;
                break;

            case 'sync':
                if (log.action && log.action.toLowerCase().includes('fail')) {
                    // Sync failures always show if pref on
                    if (!prefs.onSyncFail) return null;
                    title = 'Sync Failed';
                    body = log.action;
                    icon = 'sync_problem';
                    critical = true;
                    allowed = true;
                } else {
                    if (!prefs.onSyncSuccess) return null;
                    title = 'Sync Completed';
                    body = log.action;
                    icon = 'sync';
                    allowed = true;
                }
                break;

            case 'hierarchy':
                if (!prefs.onHierarchyChange) return null;
                title = 'Hierarchy Updated';
                body = log.action;
                icon = 'account_tree';
                allowed = true;
                break;

            default:
                return null; // audit/info events don't generate notifications
        }

        if (!allowed) return null;

        return {
            id: 'notif_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            logId: log.id,
            title,
            body,
            icon,
            critical,
            read: false,
            timestamp: log.timestamp || new Date().toISOString(),
        };
    }

    // ── Get notification preferences from AppSettings ─────────────────────────
    function _getPrefs() {
        try {
            const raw = localStorage.getItem('orgchart_app_settings');
            const s = raw ? JSON.parse(raw) : {};
            return {
                onEmployeeAdd: s.notifications?.onEmployeeAdd ?? true,
                onEmployeeRemove: s.notifications?.onEmployeeRemove ?? true,
                onSyncFail: s.notifications?.onSyncFail ?? true,
                onSyncSuccess: s.notifications?.onSyncSuccess ?? false,
                onHierarchyChange: s.notifications?.onHierarchyChange ?? false,
                browserPush: s.notifications?.browserPush ?? false,
            };
        } catch {
            return {
                onEmployeeAdd: true, onEmployeeRemove: true, onSyncFail: true,
                onSyncSuccess: false, onHierarchyChange: false, browserPush: false
            };
        }
    }

    // ── Browser push notification ─────────────────────────────────────────────
    function _maybePush(notif) {
        const prefs = _getPrefs();
        if (!prefs.browserPush) return;
        if (Notification.permission !== 'granted') return;
        try {
            new Notification(notif.title, {
                body: notif.body,
                icon: 'main-logo.png',
                tag: notif.id,
            });
        } catch { /* some browsers block in non-secure context */ }
    }

    // ── Hook into SharedLogStore ───────────────────────────────────────────────
    // Deferred so SharedLogStore is guaranteed to be defined when this runs
    function _wireLogStore() {
        if (typeof SharedLogStore === 'undefined') return;
        SharedLogStore.onChange((action, log) => {
            if (action !== 'add') return;
            const notif = _logToNotification(log);
            if (!notif) return;
            notifications.unshift(notif);
            if (notifications.length > MAX_STORED) notifications.pop();
            _saveToStorage();
            _notify('add', notif);
            _maybePush(notif);
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        /** Call once after DOM ready to hook into SharedLogStore */
        init() {
            _wireLogStore();
        },

        /** Register a change callback: fn(action, data) */
        onChange(fn) {
            listeners.push(fn);
        },

        /** All notifications, newest first */
        getAll() {
            return [...notifications];
        },

        /** Unread notifications only */
        getUnread() {
            return notifications.filter(n => !n.read);
        },

        /** Mark a single notification as read */
        markRead(id) {
            const n = notifications.find(n => n.id === id);
            if (n && !n.read) {
                n.read = true;
                _saveToStorage();
                _notify('update', n);
            }
        },

        /** Mark all as read */
        markAllRead() {
            let changed = false;
            notifications.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
            if (changed) { _saveToStorage(); _notify('markAllRead', null); }
        },

        /** Remove a single notification */
        dismiss(id) {
            const before = notifications.length;
            notifications = notifications.filter(n => n.id !== id);
            if (notifications.length !== before) {
                _saveToStorage();
                _notify('dismiss', { id });
            }
        },

        /** Clear all notifications */
        clearAll() {
            notifications = [];
            _saveToStorage();
            _notify('clearAll', null);
        },

        /** Get current preferences */
        getPrefs: _getPrefs,
    };
})();


