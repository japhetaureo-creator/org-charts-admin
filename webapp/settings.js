/**
 * settings.js — Logic for all Settings page sections except Company Profile.
 * Sections: Data Management, Org Chart Display, Employee Fields, Appearance.
 * Persists preferences to localStorage.
 */

const AppSettings = (() => {
    const STORAGE_KEY = 'orgchart_app_settings';

    // ── Defaults ──────────────────────────────────────────────────────────────

    const DEFAULTS = {
        // Org Chart card fields
        ocFields: {
            photo: true,
            title: true,
            department: true,
            location: true,
            email: false,
            phone: false,
            status: true,
        },
        ocLayout: 'tree',

        // Employee Directory visible columns
        edFields: {
            photo: true,
            name: true,
            title: true,
            department: true,
            location: true,
            email: true,
            phone: false,
            status: true,
            manager: false,
        },

        // Appearance
        theme: 'dark',   // 'dark' | 'light' | 'system'
        accent: '#6366f1', // indigo default

        // Notifications
        notifications: {
            onEmployeeAdd: true,
            onEmployeeRemove: true,
            onSyncFail: true,
            onSyncSuccess: false,
            onHierarchyChange: false,
            browserPush: false,
        },
    };

    const OC_FIELD_LABELS = [
        { key: 'photo', label: 'Profile Photo', locked: true },
        { key: 'title', label: 'Job Title', locked: false },
        { key: 'department', label: 'Department', locked: false },
        { key: 'location', label: 'Location', locked: false },
        { key: 'email', label: 'Email Address', locked: false },
        { key: 'phone', label: 'Phone Number', locked: false },
        { key: 'status', label: 'Status Badge', locked: false },
    ];

    const ED_FIELD_LABELS = [
        { key: 'photo', label: 'Avatar', locked: true },
        { key: 'name', label: 'Name', locked: true },
        { key: 'title', label: 'Job Title', locked: false },
        { key: 'department', label: 'Department', locked: false },
        { key: 'location', label: 'Location', locked: false },
        { key: 'email', label: 'Email', locked: false },
        { key: 'phone', label: 'Phone', locked: false },
        { key: 'status', label: 'Status', locked: false },
        { key: 'manager', label: 'Manager', locked: false },
    ];

    const ACCENT_COLORS = [
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Violet', value: '#8b5cf6' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Rose', value: '#f43f5e' },
        { name: 'Amber', value: '#f59e0b' },
        { name: 'Emerald', value: '#10b981' },
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Sky', value: '#0ea5e9' },
    ];

    // ── Persistence ───────────────────────────────────────────────────────────

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return structuredClone(DEFAULTS);
            const saved = JSON.parse(raw);
            return {
                ocFields: { ...DEFAULTS.ocFields, ...(saved.ocFields || {}) },
                ocLayout: saved.ocLayout || DEFAULTS.ocLayout,
                edFields: { ...DEFAULTS.edFields, ...(saved.edFields || {}) },
                theme: saved.theme || DEFAULTS.theme,
                accent: saved.accent || DEFAULTS.accent,
                notifications: { ...DEFAULTS.notifications, ...(saved.notifications || {}) },
            };
        } catch {
            return structuredClone(DEFAULTS);
        }
    }

    function save(patch) {
        const current = load();
        const updated = { ...current, ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    }

    function get() { return load(); }

    // ── Apply Appearance ──────────────────────────────────────────────────────

    function applyTheme(theme) {
        const html = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
        html.classList.toggle('dark', useDark);
        html.classList.toggle('light', !useDark);
    }

    function applyAccent(color) {
        document.documentElement.style.setProperty('--color-primary', color);
        // Also patch Tailwind's primary color via inline style on :root
        // (Tailwind CSS var approach)
        const style = document.getElementById('dynamic-accent-style') || (() => {
            const s = document.createElement('style');
            s.id = 'dynamic-accent-style';
            document.head.appendChild(s);
            return s;
        })();
        style.textContent = `
            :root { --color-primary: ${color}; }
            .text-primary { color: ${color} !important; }
            .bg-primary { background-color: ${color} !important; }
            .bg-primary\\/10 { background-color: ${color}1a !important; }
            .border-primary { border-color: ${color} !important; }
            .int-btn-primary { background: linear-gradient(135deg, ${color}, ${color}cc) !important; }
            .int-btn-primary:hover { background: linear-gradient(135deg, ${color}dd, ${color}aa) !important; }
        `;
    }

    function applyAll() {
        const s = load();
        applyTheme(s.theme);
        applyAccent(s.accent);
        applyOcFields(s.ocFields || {});
    }

    function applyOcFields(ocFields) {
        // Toggle each field across all existing org cards
        document.querySelectorAll('[data-oc-field]').forEach(el => {
            const field = el.dataset.ocField;
            if (field in ocFields) {
                el.classList.toggle('hidden', !ocFields[field]);
            }
        });
    }

    // ── CSV Export ────────────────────────────────────────────────────────────

    function exportCSV() {
        if (typeof SharedEmployeeStore === 'undefined') return;
        const employees = SharedEmployeeStore.getAll();
        if (!employees.length) {
            alert('No employees to export.');
            return;
        }

        const headers = ['name', 'email', 'title', 'department', 'location', 'status', 'phone', 'manager'];
        const rows = employees.map(e => headers.map(h => {
            const val = (e[h] || '').toString().replace(/"/g, '""');
            return `"${val}"`;
        }).join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── CSV Import ────────────────────────────────────────────────────────────

    function importCSV(file, onResult) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length < 2) { onResult({ ok: false, error: 'File is empty or has no data rows.' }); return; }

                const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
                const rows = lines.slice(1).map(l => parseCSVRow(l));

                let added = 0, updated = 0, skipped = 0;
                rows.forEach(cols => {
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
                    if (!obj.email) { skipped++; return; }

                    const existing = SharedEmployeeStore.getAll().find(e => e.email?.toLowerCase() === obj.email.toLowerCase());
                    if (existing) {
                        SharedEmployeeStore.update(existing.id, {
                            name: obj.name || existing.name,
                            title: obj.title || existing.title,
                            department: obj.department || existing.department,
                            location: obj.location || existing.location,
                            status: obj.status || existing.status,
                            phone: obj.phone || existing.phone,
                            manager: obj.manager || existing.manager,
                        });
                        updated++;
                    } else {
                        SharedEmployeeStore.add({
                            name: obj.name || '',
                            email: obj.email,
                            title: obj.title || '',
                            department: obj.department || '',
                            location: obj.location || '',
                            status: obj.status || 'active',
                            phone: obj.phone || '',
                            manager: obj.manager || '',
                        }, true);
                        added++;
                    }
                });

                onResult({ ok: true, added, updated, skipped, total: rows.length });
            } catch (err) {
                onResult({ ok: false, error: err.message });
            }
        };
        reader.readAsText(file);
    }

    function parseCSVRow(line) {
        const result = [];
        let cur = '', inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuote = !inQuote;
            } else if (ch === ',' && !inQuote) {
                result.push(cur); cur = '';
            } else {
                cur += ch;
            }
        }
        result.push(cur);
        return result;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        get,
        save,
        applyAll,
        applyTheme,
        applyAccent,
        applyOcFields,
        exportCSV,
        importCSV,
        OC_FIELD_LABELS,
        ED_FIELD_LABELS,
        ACCENT_COLORS,
    };
})();

// ── Settings Page UI Controller ───────────────────────────────────────────────

const SettingsPageUI = (() => {
    let _initialized = false;

    function init() {
        if (_initialized) { populate(); return; }
        _initialized = true;
        wireEvents();
        populate();
    }

    function wireEvents() {
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                // Update active tab button
                document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Show matching panel
                document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
                const panel = document.getElementById(`stab-${tab}`);
                if (panel) panel.classList.add('active');
            });
        });

        // Data Management
        document.getElementById('settings-export-csv')?.addEventListener('click', () => {
            AppSettings.exportCSV();
        });

        document.getElementById('settings-import-csv-input')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const resultEl = document.getElementById('settings-import-result');
            if (resultEl) { resultEl.style.display = 'block'; resultEl.textContent = 'Importing…'; }

            AppSettings.importCSV(file, result => {
                if (resultEl) {
                    if (result.ok) {
                        resultEl.style.color = '#34d399';
                        resultEl.textContent = `✓ Done — ${result.added} added, ${result.updated} updated, ${result.skipped} skipped (no email).`;
                    } else {
                        resultEl.style.color = '#f87171';
                        resultEl.textContent = `✗ Error: ${result.error}`;
                    }
                }
                e.target.value = '';
            });
        });

        // Org Chart settings
        document.getElementById('settings-save-oc')?.addEventListener('click', () => {
            const ocFields = {};
            AppSettings.OC_FIELD_LABELS.forEach(({ key }) => {
                const cb = document.getElementById(`oc-toggle-${key}`);
                if (cb) ocFields[key] = cb.checked;
            });
            const layoutRadio = document.querySelector('input[name="oc-layout"]:checked');
            const ocLayout = layoutRadio ? layoutRadio.value : 'tree';
            AppSettings.save({ ocFields, ocLayout });
            AppSettings.applyOcFields(ocFields);
            flashSaved('settings-save-oc');
        });

        // Employee Directory settings
        document.getElementById('settings-save-ed')?.addEventListener('click', () => {
            const edFields = {};
            AppSettings.ED_FIELD_LABELS.forEach(({ key }) => {
                const cb = document.getElementById(`ed-toggle-${key}`);
                if (cb) edFields[key] = cb.checked;
            });
            AppSettings.save({ edFields });
            flashSaved('settings-save-ed');
        });

        // Appearance
        document.getElementById('settings-save-appearance')?.addEventListener('click', () => {
            const themeRadio = document.querySelector('input[name="app-theme"]:checked');
            const theme = themeRadio ? themeRadio.value : 'dark';
            const selectedSwatch = document.querySelector('.accent-swatch.selected');
            const accent = selectedSwatch ? selectedSwatch.dataset.color : '#6366f1';
            const s = AppSettings.save({ theme, accent });
            AppSettings.applyTheme(s.theme);
            AppSettings.applyAccent(s.accent);
            flashSaved('settings-save-appearance');
        });

        // Notifications
        document.getElementById('settings-save-notifications')?.addEventListener('click', () => {
            const prefs = {
                onEmployeeAdd: !!document.getElementById('notif-pref-emp-add')?.checked,
                onEmployeeRemove: !!document.getElementById('notif-pref-emp-remove')?.checked,
                onSyncFail: !!document.getElementById('notif-pref-sync-fail')?.checked,
                onSyncSuccess: !!document.getElementById('notif-pref-sync-success')?.checked,
                onHierarchyChange: !!document.getElementById('notif-pref-hierarchy')?.checked,
                browserPush: !!document.getElementById('notif-pref-browser-push')?.checked,
            };
            AppSettings.save({ notifications: prefs });
            flashSaved('settings-save-notifications');
        });
    }

    function populate() {
        const s = AppSettings.get();

        // ── Org Chart field toggles ──
        const ocContainer = document.getElementById('oc-field-toggles');
        if (ocContainer) {
            ocContainer.innerHTML = '';
            AppSettings.OC_FIELD_LABELS.forEach(({ key, label, locked }) => {
                ocContainer.appendChild(makeToggleRow(`oc-toggle-${key}`, label, s.ocFields[key] ?? true, locked));
            });
        }

        // Org Chart layout radio
        const layoutRadio = document.querySelector(`input[name="oc-layout"][value="${s.ocLayout}"]`);
        if (layoutRadio) layoutRadio.checked = true;

        // ── Employee Directory field toggles ──
        const edContainer = document.getElementById('ed-field-toggles');
        if (edContainer) {
            edContainer.innerHTML = '';
            AppSettings.ED_FIELD_LABELS.forEach(({ key, label, locked }) => {
                edContainer.appendChild(makeToggleRow(`ed-toggle-${key}`, label, s.edFields[key] ?? true, locked));
            });
        }

        // ── Appearance: theme ──
        const themeRadio = document.querySelector(`input[name="app-theme"][value="${s.theme}"]`);
        if (themeRadio) themeRadio.checked = true;

        // ── Appearance: accent swatches ──
        const swatchContainer = document.getElementById('accent-swatches');
        if (swatchContainer) {
            swatchContainer.innerHTML = '';
            AppSettings.ACCENT_COLORS.forEach(({ name, value }) => {
                const btn = document.createElement('button');
                btn.className = 'accent-swatch' + (value === s.accent ? ' selected' : '');
                btn.dataset.color = value;
                btn.title = name;
                btn.style.cssText = `
                    width:32px;height:32px;border-radius:50%;background:${value};
                    border:3px solid ${value === s.accent ? '#fff' : 'transparent'};
                    cursor:pointer;transition:transform 0.15s,border-color 0.15s;
                    outline:2px solid ${value === s.accent ? value : 'transparent'};
                    outline-offset:2px;
                `;
                btn.addEventListener('click', () => {
                    swatchContainer.querySelectorAll('.accent-swatch').forEach(s => {
                        s.classList.remove('selected');
                        s.style.borderColor = 'transparent';
                        s.style.outlineColor = 'transparent';
                    });
                    btn.classList.add('selected');
                    btn.style.borderColor = '#fff';
                    btn.style.outlineColor = value;
                });
                swatchContainer.appendChild(btn);
            });
        }
        // ── Notifications prefs ──
        const notifPrefs = s.notifications || {};
        const notifMap = [
            ['notif-pref-browser-push', 'browserPush'],
            ['notif-pref-emp-add', 'onEmployeeAdd'],
            ['notif-pref-emp-remove', 'onEmployeeRemove'],
            ['notif-pref-sync-fail', 'onSyncFail'],
            ['notif-pref-sync-success', 'onSyncSuccess'],
            ['notif-pref-hierarchy', 'onHierarchyChange'],
        ];
        notifMap.forEach(([id, key]) => {
            const cb = document.getElementById(id);
            if (cb && key in notifPrefs) cb.checked = notifPrefs[key];
        });

        // Reflect current browser permission state
        const pushCb = document.getElementById('notif-pref-browser-push');
        const permNote = document.getElementById('notif-browser-perm-note');
        if (pushCb && 'Notification' in window) {
            if (Notification.permission === 'denied') {
                pushCb.disabled = true;
                if (permNote) permNote.textContent = 'Blocked in browser settings';
            } else if (Notification.permission === 'granted') {
                if (permNote) permNote.textContent = 'Allowed';
            }
        }
    }

    function makeToggleRow(id, label, checked, locked) {
        const row = document.createElement('label');
        row.className = 'settings-toggle-row' + (locked ? ' locked' : '');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = checked;
        cb.disabled = locked;

        const text = document.createElement('span');
        text.className = 'settings-toggle-label' + (locked ? ' muted' : '');
        text.textContent = label;

        row.appendChild(cb);
        row.appendChild(text);

        if (locked) {
            const badge = document.createElement('span');
            badge.className = 'settings-always-badge';
            badge.textContent = 'Always shown';
            row.appendChild(badge);
        }

        return row;
    }

    function flashSaved(btnId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined !text-base">check</span> Saved!';
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.background = '';
        }, 2000);
    }

    return { init };
})();

// Expose notification preference save for external use (e.g. notifications.js)
AppSettings.getNotifPrefs = function () {
    try {
        const raw = localStorage.getItem('orgchart_app_settings');
        const s = raw ? JSON.parse(raw) : {};
        const D = {
            onEmployeeAdd: true, onEmployeeRemove: true, onSyncFail: true,
            onSyncSuccess: false, onHierarchyChange: false, browserPush: false
        };
        return { ...D, ...(s.notifications || {}) };
    } catch { return {}; }
};
