/**
 * CompanySettings — manages company name, logo, and favicon.
 * Persists to localStorage. Applies changes live to the sidebar and browser.
 */
const CompanySettings = (() => {
    const STORAGE_KEY = 'orgchart_company_settings';

    const DEFAULTS = {
        name: 'Acme Corp',
        logoDataUrl: '',
        faviconDataUrl: '',
    };

    // ── Persistence ───────────────────────────────────────────────────────────

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function save(patch) {
        const current = load();
        const updated = { ...current, ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    }

    // ── Apply to DOM ──────────────────────────────────────────────────────────

    function applyAll(settings) {
        applyName(settings.name);
        applyLogo(settings.logoDataUrl, settings.name);
        applyFavicon(settings.faviconDataUrl);
    }

    function applyName(name) {
        const display = name || DEFAULTS.name;

        // Sidebar company name
        const h1 = document.querySelector('aside h1');
        if (h1) h1.textContent = display;

        // Browser tab title
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
            // Fallback: show first letter of company name
            logoEl.style.backgroundImage = '';
            logoEl.style.backgroundSize = '';
            logoEl.style.backgroundPosition = '';
            const displayName = name || load().name || DEFAULTS.name;
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

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Call once on app load to apply saved settings.
     */
    function init() {
        applyAll(load());
    }

    /**
     * Update company name, save, and apply.
     */
    function setName(name) {
        const s = save({ name });
        applyName(s.name);
    }

    /**
     * Update logo from a File object, save as base64, and apply.
     * Returns a Promise that resolves when done.
     */
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

    /**
     * Update favicon from a File object, save as base64, and apply.
     */
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

    function get() { return load(); }

    return { init, get, setName, setLogo, setFavicon, applyAll };
})();
