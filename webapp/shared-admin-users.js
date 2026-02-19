// =============================================================================
// Shared Admin User Data Store
// =============================================================================
// Single source of truth for admin/management users who have access to
// add, edit, and manage organization data. Separate from SharedEmployeeStore.
// =============================================================================

const SharedAdminUserStore = (() => {
    // ── Seed data ─────────────────────────────────────────────────────────
    let users = [
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

    // ── Change listeners ──────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedAdminUserStore listener error:', e); }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────
    return {
        onChange(fn) { listeners.push(fn); },

        getAll() { return [...users]; },

        getById(id) { return users.find(u => u.id === id) || null; },

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

            // Log the event
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

        update(id, data) {
            const SILENT_FIELDS = new Set(['password', 'lastLogin', 'avatar']);
            const idx = users.findIndex(u => u.id === id);
            if (idx === -1) return null;
            const oldData = { ...users[idx] };
            users[idx] = { ...users[idx], ...data };

            // Only log if meaningful (non-silent) fields changed
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

        delete(id) {
            const user = users.find(u => u.id === id);
            if (!user) return null;
            users = users.filter(u => u.id !== id);

            // Log the event
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

        setAll(data) {
            users = data;
            notifyListeners('reset', null);
        }
    };
})();


