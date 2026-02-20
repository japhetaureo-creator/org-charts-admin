/**
 * CompanySettings — manages company name, logo, and favicon.
 * Primary storage: Firestore document 'settings/company'
 * Fallback: localStorage cache.
 * Applies changes live to the sidebar and browser.
 */
const CompanySettings = (() => {
    const STORAGE_KEY = 'orgchart_company_settings';
    const DOC_PATH = 'settings/company';

    const DEFAULTS = {
        name: 'Acme Corp',
        logoDataUrl: '',
        faviconDataUrl: '',
    };

    // ── Firestore helpers ─────────────────────────────────────────────────
    function _getDb() { return window.firebaseDb || null; }
    function _docRef() { const db = _getDb(); return db ? db.doc(DOC_PATH) : null; }

    // ── localStorage helpers ─────────────────────────────────────────────
    function loadLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
        } catch { return { ...DEFAULTS }; }
    }

    function saveLocal(settings) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
        catch (e) { console.error('CompanySettings: localStorage save failed', e); }
    }

    // ── Firestore persistence ────────────────────────────────────────────
    async function _firestoreSave(patch) {
        const ref = _docRef();
        if (!ref) return;
        try { await ref.set(patch, { merge: true }); }
        catch (e) { console.error('[CompanySettings] Firestore write failed:', e); }
    }

    async function _syncFromFirestore() {
        const ref = _docRef();
        if (!ref) return;
        try {
            const doc = await ref.get();
            if (doc.exists) {
                const remote = { ...DEFAULTS, ...doc.data() };
                saveLocal(remote);
                applyAll(remote);
                console.log('[CompanySettings] Loaded from Firestore:', remote.name);
            } else {
                // First run — push local settings to Firestore
                const local = loadLocal();
                console.log('[CompanySettings] Firestore empty, uploading local settings');
                await ref.set(local);
            }
        } catch (e) {
            console.error('[CompanySettings] Firestore sync failed:', e);
        }
    }

    // ── Save helper (localStorage + Firestore) ──────────────────────────
    function save(patch) {
        const current = loadLocal();
        const updated = { ...current, ...patch };
        saveLocal(updated);
        _firestoreSave(updated); // async fire-and-forget
        return updated;
    }

    // ── Apply to DOM ──────────────────────────────────────────────────────

    function applyAll(settings) {
        applyName(settings.name);
        applyLogo(settings.logoDataUrl, settings.name);
        applyFavicon(settings.faviconDataUrl);
    }

    function applyName(name) {
        const display = name || DEFAULTS.name;
        const h1 = document.querySelector('aside h1');
        if (h1) h1.textContent = display;
        document.title = `${display} — Admin Console`;
    }

    function applyLogo(dataUrl, name) {
        const logoEl = document.querySelector('.company-logo-bg');
        if (!logoEl) return;
        if (dataUrl) {
            logoEl.style.backgroundImage = `url('${dataUrl}')`;
            logoEl.style.backgroundSize = 'cover';
            logoEl.style.backgroundPosition = 'center';
            logoEl.textContent = '';
        } else {
            logoEl.style.backgroundImage = '';
            logoEl.style.backgroundSize = '';
            logoEl.style.backgroundPosition = '';
            const displayName = name || loadLocal().name || DEFAULTS.name;
            logoEl.textContent = displayName.charAt(0).toUpperCase();
            logoEl.style.display = 'flex';
            logoEl.style.alignItems = 'center';
            logoEl.style.justifyContent = 'center';
            logoEl.style.fontWeight = '700';
            logoEl.style.fontSize = '1.1rem';
            logoEl.style.color = '#fff';
            logoEl.style.background = '#6366f1';
        }
    }

    function applyFavicon(dataUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = dataUrl || 'favicon.ico';
    }

    // ── Public API ────────────────────────────────────────────────────────

    function init() {
        applyAll(loadLocal());
        // After DOM applies local cache, sync from Firestore for latest
        setTimeout(() => _syncFromFirestore(), 900);
    }

    function setName(name) {
        const s = save({ name });
        applyName(s.name);
    }

    function setLogo(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                const s = save({ logoDataUrl: '' });
                applyLogo('', s.name);
                resolve(s);
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                const s = save({ logoDataUrl: e.target.result });
                applyLogo(s.logoDataUrl, s.name);
                resolve(s);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function setFavicon(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                const s = save({ faviconDataUrl: '' });
                applyFavicon('');
                resolve(s);
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                const s = save({ faviconDataUrl: e.target.result });
                applyFavicon(s.faviconDataUrl);
                resolve(s);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function get() { return loadLocal(); }

    return { init, get, setName, setLogo, setFavicon, applyAll };
})();
