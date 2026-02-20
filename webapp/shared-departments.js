// =============================================================================
// Shared Department Store — Firestore-backed
// =============================================================================
// Centralized list of departments. Primary: Firestore, Fallback: localStorage.
// Used by Employee Directory filter, Add/Edit modal, and Settings.
// =============================================================================

const DepartmentStore = (() => {
    const STORAGE_KEY = 'orgchart_departments';
    const DOC_PATH = 'settings/departments'; // Single document with a 'list' array

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

    // ── Firestore helpers ─────────────────────────────────────────────────
    function _getDb() { return window.firebaseDb || null; }

    function _docRef() {
        const db = _getDb();
        return db ? db.doc(DOC_PATH) : null;
    }

    // ── localStorage helpers ─────────────────────────────────────────────
    function _loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { /* fall through */ }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
        return [...SEED];
    }

    function _saveLocal() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(departments)); }
        catch (e) { console.error('DepartmentStore: save failed', e); }
    }

    // ── State ─────────────────────────────────────────────────────────────
    let departments = _loadLocal();

    // ── Listeners ─────────────────────────────────────────────────────────
    const listeners = [];
    function _notify() { listeners.forEach(fn => { try { fn(); } catch { } }); }

    // ── Firestore sync ───────────────────────────────────────────────────
    async function _syncFromFirestore() {
        const ref = _docRef();
        if (!ref) return;
        try {
            const doc = await ref.get();
            if (doc.exists && doc.data().list) {
                departments = doc.data().list;
                console.log('[DepartmentStore] Loaded', departments.length, 'departments from Firestore');
            } else {
                // First run: push local departments to Firestore
                console.log('[DepartmentStore] Firestore empty, uploading', departments.length, 'departments');
                await ref.set({ list: departments });
            }
            _saveLocal();
            _notify();
        } catch (e) {
            console.error('[DepartmentStore] Firestore sync failed:', e);
        }
    }

    async function _firestoreSave() {
        const ref = _docRef();
        if (!ref) return;
        try { await ref.set({ list: departments }); }
        catch (e) { console.error('[DepartmentStore] Firestore write failed:', e); }
    }

    // ── Public API ────────────────────────────────────────────────────────
    const store = {
        onChange(fn) { listeners.push(fn); },
        getAll() { return [...departments].sort((a, b) => a.localeCompare(b)); },

        add(name) {
            const trimmed = (name || '').trim();
            if (!trimmed) return false;
            if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) return false;
            departments.push(trimmed);
            _saveLocal();
            _firestoreSave();
            _notify();
            return true;
        },

        remove(name) {
            const before = departments.length;
            departments = departments.filter(d => d !== name);
            if (departments.length !== before) {
                _saveLocal();
                _firestoreSave();
                _notify();
                return true;
            }
            return false;
        },

        setAll(list) {
            departments = list;
            _saveLocal();
            _firestoreSave();
            _notify();
        },

        async refresh() { await _syncFromFirestore(); }
    };

    // Auto-sync on load
    setTimeout(() => _syncFromFirestore(), 700);

    return store;
})();
