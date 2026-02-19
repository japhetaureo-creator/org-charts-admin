// =============================================================================
// Shared Employee Data Store
// =============================================================================
// Single source of truth for employee data used by both
// Organization Chart and Employee Directory modules.
// Changes trigger onChange listeners so both UIs stay in sync.
// Data is persisted to localStorage so it survives page refreshes.
// =============================================================================

const SharedEmployeeStore = (() => {
    const STORAGE_KEY = 'orgchart_employees';

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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
        } catch (e) {
            console.error('SharedEmployeeStore: failed to save to localStorage', e);
        }
    }

    // Start from localStorage (empty on first run, since no seed data is preloaded)
    let employees = _load();

    // ── Change listeners ─────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedEmployeeStore listener error:', e); }
        });
    }

    // ── Public API ───────────────────────────────────────────────────────
    return {
        /** Register a callback: fn(action, data) */
        onChange(fn) {
            listeners.push(fn);
        },

        /** Get all employees (returns a copy) */
        getAll() {
            return [...employees];
        },

        /** Get one employee by ID */
        getById(id) {
            return employees.find(e => e.id === id) || null;
        },

        /** Add a new employee */
        add(data, silent = false) {
            const id = 'emp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const employee = {
                id,
                name: data.name || '',
                email: data.email || '',
                department: data.department || '',
                location: data.location || '',
                status: data.status || 'active',
                startDate: data.startDate || new Date().toISOString().split('T')[0],
                gender: data.gender || '',
                phone: data.phone || '',
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'New')}&background=6366f1&color=fff&bold=true&size=128`,
                parentId: data.parentId || null
            };
            employees.unshift(employee);
            _save();

            // Log the event
            if (!silent && typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'hire',
                    action: 'New employee joined the team',
                    target: employee.name,
                    details: `Assigned to ${employee.department} in ${employee.location}`,
                    icon: 'person_add',
                    iconBg: 'bg-emerald-500'
                });
            }

            notifyListeners('add', employee);
            return employee;
        },

        /** Update an existing employee (partial data merge) */
        update(id, data) {
            const idx = employees.findIndex(e => e.id === id);
            if (idx === -1) return null;
            const oldData = { ...employees[idx] };
            employees[idx] = { ...employees[idx], ...data };
            _save();

            // Log the event with more detail
            if (typeof SharedLogStore !== 'undefined') {
                if (data.name && data.name !== oldData.name) {
                    SharedLogStore.add({
                        type: 'update',
                        action: 'Updated profile information for',
                        target: data.name,
                        details: `Name changed from "${oldData.name}" to "${data.name}"`,
                        icon: 'person',
                        iconBg: 'bg-indigo-500'
                    });
                } else if (data.department && data.department !== oldData.department) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Assigned ${employees[idx].name} to`,
                        target: data.department,
                        details: `Transferred from ${oldData.department} to ${data.department}`,
                        icon: 'domain',
                        iconBg: 'bg-purple-500'
                    });
                } else if (data.location && data.location !== oldData.location) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Relocated ${employees[idx].name} to`,
                        target: data.location,
                        details: `Moved from ${oldData.location} to ${data.location}`,
                        icon: 'location_on',
                        iconBg: 'bg-amber-500'
                    });
                } else if (data.status && data.status !== oldData.status) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Changed status for ${employees[idx].name} to`,
                        target: data.status,
                        details: `Status updated from ${oldData.status} to ${data.status}`,
                        icon: 'event_repeat',
                        iconBg: 'bg-slate-500'
                    });
                } else {
                    const changedFields = Object.keys(data).filter(key => data[key] !== oldData[key]);
                    SharedLogStore.add({
                        type: 'update',
                        action: 'Updated profile details for',
                        target: employees[idx].name,
                        details: changedFields.length > 0 ? `Modified: ${changedFields.join(', ')}` : 'No fields were changed',
                        icon: 'manage_accounts',
                        iconBg: 'bg-slate-400'
                    });
                }
            }

            notifyListeners('update', employees[idx]);
            return employees[idx];
        },

        /** Delete an employee by ID */
        delete(id) {
            const emp = employees.find(e => e.id === id);
            if (!emp) return null;
            employees = employees.filter(e => e.id !== id);
            _save();

            // Log the event
            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'delete',
                    action: 'Removed employee from directory',
                    target: emp.name,
                    details: `Final department: ${emp.department} (${emp.location})`,
                    icon: 'person_off',
                    iconBg: 'bg-red-500'
                });
            }

            notifyListeners('delete', emp);
            return emp;
        },

        /** Replace the entire data set (e.g., from an import or sync) */
        setAll(data) {
            employees = data;
            _save();
            notifyListeners('reset', null);
        },

        /** Clear all employees permanently */
        clear() {
            employees = [];
            _save();
            notifyListeners('reset', null);
        }
    };
})();
