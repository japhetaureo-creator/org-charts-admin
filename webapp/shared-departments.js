// =============================================================================
// Shared Department Store
// =============================================================================
// Centralized list of departments, persisted to localStorage.
// Used by Employee Directory filter, Add/Edit modal, and Settings.
// Changes notify listeners so all UI stays in sync.
// =============================================================================

const DepartmentStore = (() => {
    const STORAGE_KEY = 'orgchart_departments';

    const SEED = [
        'Operations - LCL',
        'Operations - LCL/AIR',
        'Pricing',
        'Procurement',
        'Warehouse',
        'Domestic',
        'Civil',
        'Marketing',
        'Finance',
        'Commercial',
        'Technology',
        'Leadership',
    ];

    // ── Persistence ───────────────────────────────────────────────────────────
    function _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { /* fall through to seed */ }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
        return [...SEED];
    }

    function _save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(departments)); }
        catch (e) { console.error('DepartmentStore: save failed', e); }
    }

    let departments = _load();

    // ── Listeners ─────────────────────────────────────────────────────────────
    const listeners = [];
    function _notify() { listeners.forEach(fn => { try { fn(); } catch { } }); }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        /** Register a callback triggered on any change */
        onChange(fn) { listeners.push(fn); },

        /** Get all departments sorted alphabetically */
        getAll() { return [...departments].sort((a, b) => a.localeCompare(b)); },

        /** Add a new department (prevents duplicates) */
        add(name) {
            const trimmed = (name || '').trim();
            if (!trimmed) return false;
            if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) return false;
            departments.push(trimmed);
            _save();
            _notify();
            return true;
        },

        /** Remove a department by name */
        remove(name) {
            const before = departments.length;
            departments = departments.filter(d => d !== name);
            if (departments.length !== before) { _save(); _notify(); return true; }
            return false;
        },

        /** Replace the entire list */
        setAll(list) {
            departments = list;
            _save();
            _notify();
        }
    };
})();
