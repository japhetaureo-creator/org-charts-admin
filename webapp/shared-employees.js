// =============================================================================
// Shared Employee Data Store — Firestore-backed
// =============================================================================
// Single source of truth for employee data used by both
// Organization Chart and Employee Directory modules.
// Primary storage: Firestore collection 'employees'
// Fallback: localStorage cache
// =============================================================================

const SharedEmployeeStore = (() => {
    const STORAGE_KEY = 'orgchart_employees';
    const COLLECTION = 'employees';

    // ── Firestore helpers ─────────────────────────────────────────────────
    function _getDb() { return window.firebaseDb || null; }
    function _collection() { const db = _getDb(); return db ? db.collection(COLLECTION) : null; }

    // ── localStorage helpers (cache / fallback) ──────────────────────────
    function _loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function _saveLocal() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
        } catch (e) {
            console.error('SharedEmployeeStore: localStorage save failed', e);
        }
    }

    // ── State ─────────────────────────────────────────────────────────────
    let employees = _loadLocal();
    let _firestoreReady = false;

    // ── Change listeners ─────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedEmployeeStore listener error:', e); }
        });
    }

    // ── Firestore sync ───────────────────────────────────────────────────
    async function _syncFromFirestore() {
        const col = _collection();
        if (!col) return;
        try {
            const snapshot = await col.get();
            if (!snapshot.empty) {
                employees = [];
                snapshot.forEach(doc => {
                    employees.push({ id: doc.id, ...doc.data() });
                });
                console.log('[EmployeeStore] Loaded', employees.length, 'employees from Firestore');
            } else if (employees.length > 0) {
                // Firestore empty but localStorage has data → push local data up
                console.log('[EmployeeStore] Firestore empty, uploading', employees.length, 'local employees');
                for (const emp of employees) {
                    await col.doc(emp.id).set(emp);
                }
            }
            _firestoreReady = true;
            _saveLocal();
            notifyListeners('sync', null);
        } catch (e) {
            console.error('[EmployeeStore] Firestore sync failed:', e);
        }
    }

    async function _firestoreSet(id, data) {
        const col = _collection();
        if (!col) return;
        try { await col.doc(id).set(data, { merge: true }); }
        catch (e) { console.error('[EmployeeStore] Firestore write failed:', e); }
    }

    async function _firestoreDelete(id) {
        const col = _collection();
        if (!col) return;
        try { await col.doc(id).delete(); }
        catch (e) { console.error('[EmployeeStore] Firestore delete failed:', e); }
    }

    // ── Public API ───────────────────────────────────────────────────────
    const store = {
        onChange(fn) { listeners.push(fn); },
        getAll() { return [...employees]; },
        getById(id) { return employees.find(e => e.id === id) || null; },

        add(data, silent = false) {
            const id = 'emp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const employee = {
                id,
                name: data.name || '',
                email: data.email || '',
                title: data.title || '',
                department: data.department || '',
                location: data.location || '',
                status: data.status || 'active',
                startDate: data.startDate || new Date().toISOString().split('T')[0],
                gender: data.gender || '',
                phone: data.phone || '',
                manager: data.manager || '',
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'New')}&background=6366f1&color=fff&bold=true&size=128`,
                parentId: data.parentId || null
            };
            employees.unshift(employee);
            _saveLocal();
            _firestoreSet(id, employee);

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

        update(id, data) {
            const idx = employees.findIndex(e => e.id === id);
            if (idx === -1) return null;
            const oldData = { ...employees[idx] };
            employees[idx] = { ...employees[idx], ...data };
            _saveLocal();
            _firestoreSet(id, employees[idx]);

            if (typeof SharedLogStore !== 'undefined') {
                if (data.name && data.name !== oldData.name) {
                    SharedLogStore.add({
                        type: 'update', action: 'Updated profile information for',
                        target: data.name,
                        details: `Name changed from "${oldData.name}" to "${data.name}"`,
                        icon: 'person', iconBg: 'bg-indigo-500'
                    });
                } else if (data.department && data.department !== oldData.department) {
                    SharedLogStore.add({
                        type: 'update', action: `Assigned ${employees[idx].name} to`,
                        target: data.department,
                        details: `Transferred from ${oldData.department} to ${data.department}`,
                        icon: 'domain', iconBg: 'bg-purple-500'
                    });
                } else if (data.location && data.location !== oldData.location) {
                    SharedLogStore.add({
                        type: 'update', action: `Relocated ${employees[idx].name} to`,
                        target: data.location,
                        details: `Moved from ${oldData.location} to ${data.location}`,
                        icon: 'location_on', iconBg: 'bg-amber-500'
                    });
                } else if (data.status && data.status !== oldData.status) {
                    SharedLogStore.add({
                        type: 'update', action: `Changed status for ${employees[idx].name} to`,
                        target: data.status,
                        details: `Status updated from ${oldData.status} to ${data.status}`,
                        icon: 'event_repeat', iconBg: 'bg-slate-500'
                    });
                } else {
                    const changedFields = Object.keys(data).filter(key => data[key] !== oldData[key]);
                    SharedLogStore.add({
                        type: 'update', action: 'Updated profile details for',
                        target: employees[idx].name,
                        details: changedFields.length > 0 ? `Modified: ${changedFields.join(', ')}` : 'No fields were changed',
                        icon: 'manage_accounts', iconBg: 'bg-slate-400'
                    });
                }
            }

            notifyListeners('update', employees[idx]);
            return employees[idx];
        },

        delete(id) {
            const emp = employees.find(e => e.id === id);
            if (!emp) return null;
            employees = employees.filter(e => e.id !== id);
            _saveLocal();
            _firestoreDelete(id);

            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'delete', action: 'Removed employee from directory',
                    target: emp.name,
                    details: `Final department: ${emp.department} (${emp.location})`,
                    icon: 'person_off', iconBg: 'bg-red-500'
                });
            }

            notifyListeners('delete', emp);
            return emp;
        },

        setAll(data) {
            employees = data;
            _saveLocal();
            notifyListeners('reset', null);
        },

        clear() {
            employees = [];
            _saveLocal();
            notifyListeners('reset', null);
        },

        isReady() { return _firestoreReady; },
        async refresh() { await _syncFromFirestore(); }
    };

    // Auto-sync on load
    setTimeout(() => _syncFromFirestore(), 600);

    return store;
})();
