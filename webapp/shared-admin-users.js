// =============================================================================
// Shared Admin User Data Store — Firestore-backed
// =============================================================================
// Single source of truth for admin/management users.
// Primary storage: Firestore collection 'admin_users'
// Fallback: localStorage (used when Firestore is unavailable)
// On first run, seeds a default Super Admin to Firestore.
// =============================================================================

const SharedAdminUserStore = (() => {
    const STORAGE_KEY = 'orgchart_admin_users';
    const COLLECTION = 'admin_users';

    const SEED_USERS = [
        {
            id: 'adm_001',
            name: 'Super Admin',
            email: 'admin@company.com',
            role: 'Super Admin',
            status: 'active',
            password: 'changeme123',
            lastLogin: null,
            createdAt: '2025-06-01T09:00:00Z',
            avatar: 'https://ui-avatars.com/api/?name=Super+Admin&background=6366f1&color=fff&bold=true&size=128'
        }
    ];

    // ── Firestore helpers ─────────────────────────────────────────────────
    function _getDb() {
        return window.firebaseDb || null;
    }

    function _collection() {
        const db = _getDb();
        return db ? db.collection(COLLECTION) : null;
    }

    // ── localStorage helpers (cache / fallback) ──────────────────────────
    function _loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { /* fall through */ }
        return null;
    }

    function _saveLocal(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('SharedAdminUserStore: localStorage save failed', e);
        }
    }

    // ── State ─────────────────────────────────────────────────────────────
    let users = _loadLocal() || [...SEED_USERS];
    let _firestoreReady = false;

    // ── Change listeners ──────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedAdminUserStore listener error:', e); }
        });
    }

    // ── Firestore sync: load all users from cloud ────────────────────────
    async function _syncFromFirestore() {
        const col = _collection();
        if (!col) return;
        try {
            const snapshot = await col.get();
            if (snapshot.empty) {
                // First-time setup: push seed users to Firestore
                console.log('[AdminStore] Firestore empty — seeding default users');
                for (const user of SEED_USERS) {
                    await col.doc(user.id).set(user);
                }
                users = [...SEED_USERS];
            } else {
                users = [];
                snapshot.forEach(doc => {
                    users.push({ id: doc.id, ...doc.data() });
                });
                console.log('[AdminStore] Loaded', users.length, 'users from Firestore');
            }
            _firestoreReady = true;
            _saveLocal(users); // cache locally
            notifyListeners('sync', null);
        } catch (e) {
            console.error('[AdminStore] Firestore sync failed, using localStorage fallback:', e);
        }
    }

    // ── Firestore write helpers ──────────────────────────────────────────
    async function _firestoreSet(id, data) {
        const col = _collection();
        if (!col) return;
        try {
            await col.doc(id).set(data, { merge: true });
        } catch (e) {
            console.error('[AdminStore] Firestore write failed for', id, e);
        }
    }

    async function _firestoreDelete(id) {
        const col = _collection();
        if (!col) return;
        try {
            await col.doc(id).delete();
        } catch (e) {
            console.error('[AdminStore] Firestore delete failed for', id, e);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────
    const store = {
        /** Register a callback: fn(action, data) */
        onChange(fn) { listeners.push(fn); },

        /** Get all users (returns a copy) */
        getAll() { return [...users]; },

        /** Get a single user by ID */
        getById(id) { return users.find(u => u.id === id) || null; },

        /** Get a single user by email */
        getByEmail(email) {
            const lower = (email || '').trim().toLowerCase();
            return users.find(u => (u.email || '').toLowerCase() === lower) || null;
        },

        /** Add a new admin user */
        add(data) {
            const id = 'adm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const user = {
                id,
                name: data.name || '',
                email: data.email || '',
                role: data.role || 'Admin',
                status: data.status || 'active',
                password: data.password || 'changeme123',
                lastLogin: null,
                createdAt: new Date().toISOString(),
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'New')}&background=6366f1&color=fff&bold=true&size=128`
            };
            users.unshift(user);
            _saveLocal(users);
            _firestoreSet(id, user); // async — fire and forget

            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'audit',
                    action: 'Added new admin user',
                    target: user.name,
                    details: `Assigned role: ${user.role}`,
                    icon: 'person_add',
                    iconBg: 'bg-indigo-500'
                });
            }

            notifyListeners('add', user);
            return user;
        },

        /** Update an existing user */
        update(id, data) {
            const SILENT_FIELDS = new Set(['password', 'lastLogin', 'avatar']);
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) return null;
            const oldData = { ...users[idx] };
            users[idx] = { ...users[idx], ...data };
            _saveLocal(users);
            _firestoreSet(id, users[idx]); // async — fire and forget

            const changedFields = Object.keys(data).filter(key => data[key] !== oldData[key] && !SILENT_FIELDS.has(key));

            if (changedFields.length > 0 && typeof SharedLogStore !== 'undefined') {
                if (data.role && data.role !== oldData.role) {
                    SharedLogStore.add({
                        type: 'audit',
                        action: `Updated role for ${users[idx].name} to`,
                        target: data.role,
                        details: `Role changed from ${oldData.role} to ${data.role}`,
                        icon: 'shield_person',
                        iconBg: 'bg-purple-500'
                    });
                } else {
                    SharedLogStore.add({
                        type: 'audit',
                        action: 'Updated admin profile for',
                        target: users[idx].name,
                        details: `Modified: ${changedFields.join(', ')}`,
                        icon: 'manage_accounts',
                        iconBg: 'bg-slate-500'
                    });
                }
            }

            notifyListeners('update', users[idx]);
            return users[idx];
        },

        /** Delete a user */
        delete(id) {
            const user = users.find(u => u.id === id);
            if (!user) return null;
            users = users.filter(u => u.id !== id);
            _saveLocal(users);
            _firestoreDelete(id); // async — fire and forget

            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'delete',
                    action: 'Removed admin access for',
                    target: user.name,
                    details: `Final role was: ${user.role} (${user.email})`,
                    icon: 'person_remove',
                    iconBg: 'bg-red-500'
                });
            }

            notifyListeners('delete', user);
            return user;
        },

        /** Replace all users (used internally) */
        setAll(data) {
            users = data;
            _saveLocal(users);
            notifyListeners('reset', null);
        },

        /** Returns true when Firestore data has been loaded */
        isReady() { return _firestoreReady; },

        /** Force a refresh from Firestore */
        async refresh() { await _syncFromFirestore(); }
    };

    // ── Auto-sync on load ────────────────────────────────────────────────
    // Give Firebase a moment to initialize, then pull from Firestore
    setTimeout(() => {
        _syncFromFirestore();
    }, 500);

    return store;
})();
