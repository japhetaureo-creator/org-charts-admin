// =============================================================================
// Auth Store — Session Management & Permission Layer
// =============================================================================
// Manages user authentication against SharedAdminUserStore.
// Session is stored in sessionStorage (cleared on browser/tab close).
// Permissions are applied by setting data-auth attribute on <body>.
// =============================================================================

const AuthStore = (() => {
    const SESSION_KEY = 'orgchart_session';

    // ── Role permission definitions ───────────────────────────────────────────
    const PERMISSIONS = {
        'Super Admin': { edit: true, add: true, delete: true, settings: true, userManagement: true, employeeDirectory: true, integrations: true },
        'Admin': { edit: true, add: true, delete: true, settings: true, userManagement: false, employeeDirectory: true, integrations: true },
        'Viewer': { edit: false, add: false, delete: false, settings: false, userManagement: false, employeeDirectory: false, integrations: false },
        'guest': { edit: false, add: false, delete: false, settings: false, userManagement: false, employeeDirectory: false, integrations: false },
    };

    // ── Change listeners ──────────────────────────────────────────────────────
    const listeners = [];
    function _notify(action, data) {
        listeners.forEach(fn => { try { fn(action, data); } catch (e) { console.error('AuthStore listener error:', e); } });
    }

    // ── Session helpers ───────────────────────────────────────────────────────
    function _loadSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function _saveSession(session) {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch { }
    }

    function _clearSession() {
        try { sessionStorage.removeItem(SESSION_KEY); } catch { }
    }

    // ── Current session ───────────────────────────────────────────────────────
    let _session = _loadSession(); // { userId, email, name, role, avatar }

    // ── Apply permissions to the DOM ──────────────────────────────────────────
    function applyPermissions() {
        const role = _session?.role || 'guest';
        const perms = PERMISSIONS[role] || PERMISSIONS['guest'];
        const body = document.body;

        // Set data-auth attribute used by CSS rules
        body.setAttribute('data-auth', role === 'guest' ? 'guest' : 'authenticated');
        body.setAttribute('data-role', (role || 'guest').toLowerCase().replace(/\s+/g, '-'));

        // Update avatar button state
        _updateAvatarButton();

        // Update nav lock icons
        _updateNavLocks(perms);

        // Update edit-mode toggle visibility in org chart
        const editToggle = document.getElementById('oc-edit-mode-toggle');
        if (editToggle) {
            editToggle.classList.toggle('hidden', !perms.edit);
        }
    }

    function _updateAvatarButton() {
        const btn = document.getElementById('user-avatar-btn');
        const img = document.getElementById('user-avatar-img');
        const label = document.getElementById('user-avatar-label');
        if (!btn) return;

        if (_session) {
            btn.title = `${_session.name} (${_session.role}) — click to sign out`;
            if (img) {
                img.src = _session.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(_session.name)}&background=6366f1&color=fff&bold=true&size=128`;
                img.alt = _session.name;
            }
            if (label) label.textContent = '';
            btn.classList.add('auth-logged-in');
            btn.classList.remove('auth-guest');
        } else {
            btn.title = 'Sign in';
            if (img) { img.src = ''; img.alt = ''; }
            if (label) label.textContent = '';
            btn.classList.add('auth-guest');
            btn.classList.remove('auth-logged-in');
        }
    }

    function _updateNavLocks(perms) {
        const settingsLink = document.querySelector('nav a[data-page="settings"]');
        const usersLink = document.querySelector('nav a[data-page="users"]');
        const directoryLink = document.querySelector('nav a[data-page="employee-directory"]');
        const integrationsLink = document.querySelector('nav a[data-page="integrations"]');

        [
            { el: settingsLink, allowed: perms.settings, msg: 'Sign in as Admin or higher to access this section' },
            { el: usersLink, allowed: perms.userManagement, msg: 'Sign in as Admin or higher to access this section' },
            { el: directoryLink, allowed: perms.employeeDirectory, msg: 'Sign in as Admin or Viewer to access the Employee Directory' },
            { el: integrationsLink, allowed: perms.integrations, msg: 'Sign in as Admin or higher to access Integrations' },
        ].forEach(({ el, allowed, msg }) => {
            if (!el) return;
            if (allowed) {
                el.classList.remove('nav-locked');
                el.removeAttribute('title');
            } else {
                el.classList.add('nav-locked');
                el.title = msg;
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        /** Register a callback: fn('login'|'logout', session) */
        onChange(fn) { listeners.push(fn); },

        /** Returns current session or null */
        getSession() { return _session ? { ..._session } : null; },

        /** Returns true if user is logged in */
        isLoggedIn() { return !!_session; },

        /** Returns true if the current user can do [action] */
        can(action) {
            const role = _session?.role || 'guest';
            const perms = PERMISSIONS[role] || PERMISSIONS['guest'];
            return !!perms[action];
        },

        /**
         * Attempt to log in. Returns { ok: true, session } or { ok: false, error: string }
         * Now async — awaits Firestore sync if user is not found locally.
         */
        async login(email, password) {
            if (typeof SharedAdminUserStore === 'undefined') {
                return { ok: false, error: 'User store unavailable. Try refreshing.' };
            }

            const trimEmail = (email || '').trim().toLowerCase();

            // First try local cache
            let users = SharedAdminUserStore.getAll();
            let user = users.find(u => (u.email || '').toLowerCase() === trimEmail);

            // If not found locally, try refreshing from Firestore
            if (!user && typeof SharedAdminUserStore.refresh === 'function') {
                try {
                    await SharedAdminUserStore.refresh();
                    users = SharedAdminUserStore.getAll();
                    user = users.find(u => (u.email || '').toLowerCase() === trimEmail);
                } catch { /* ignore — will show "no account" below */ }
            }

            if (!user) {
                return { ok: false, error: 'No account found with that email address.' };
            }

            if (user.status === 'inactive' || user.status === 'suspended') {
                return { ok: false, error: `This account is ${user.status}. Contact your administrator.` };
            }

            const storedPassword = user.password || 'changeme123';
            if (password !== storedPassword) {
                return { ok: false, error: 'Incorrect password. Please try again.' };
            }

            // Build session
            _session = {
                userId: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
            };
            _saveSession(_session);

            // Update lastLogin in the store (best-effort)
            try {
                SharedAdminUserStore.update(user.id, { lastLogin: new Date().toISOString() });
            } catch { }

            applyPermissions();
            _notify('login', _session);

            return { ok: true, session: { ..._session } };
        },

        /** Log out the current user */
        logout() {
            _session = null;
            _clearSession();
            applyPermissions();
            _notify('logout', null);
        },

        /** Call once after DOM ready */
        init() {
            applyPermissions();
        },

        applyPermissions,

        /**
         * Change password for the current user.
         * Returns { ok: true } or { ok: false, error: string }
         */
        changePassword(currentPassword, newPassword) {
            if (!_session) return { ok: false, error: 'Not logged in.' };
            if (!currentPassword || !newPassword) return { ok: false, error: 'All fields are required.' };
            if (newPassword.length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };

            const users = SharedAdminUserStore.getAll();
            const user = users.find(u => u.id === _session.userId);
            if (!user) return { ok: false, error: 'User account not found.' };

            const stored = user.password || 'changeme123';
            if (currentPassword !== stored) return { ok: false, error: 'Current password is incorrect.' };

            SharedAdminUserStore.update(_session.userId, { password: newPassword });
            return { ok: true };
        },
    };
})();


