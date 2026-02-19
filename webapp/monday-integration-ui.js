/**
 * monday-integration-ui.js
 *
 * UI controller for the Monday.com Integrations page.
 * Wires the card-based connect flow, modal, field mapping, sync settings.
 *
 * Depends on: MondayIntegration (monday-integration.js)
 */

const MondayIntegrationUI = (() => {

    let _initialized = false;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function el(id) { return document.getElementById(id); }

    function showAlert(id, msgId, type, text) {
        const box = el(id);
        const msg = el(msgId);
        if (!box || !msg) return;
        box.className = `int-alert ${type}`;
        msg.textContent = text;
        box.style.display = 'flex';
    }

    function hideAlert(id) {
        const box = el(id);
        if (box) box.style.display = 'none';
    }

    function setButtonLoading(btn, loading, label) {
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn.dataset.origText = btn.innerHTML;
            btn.innerHTML = `<span class="material-symbols-outlined" style="animation:spin 1s linear infinite;font-size:16px">progress_activity</span> ${label || 'Working…'}`;
        } else {
            btn.innerHTML = btn.dataset.origText || btn.innerHTML;
        }
    }

    // ─── Modal ────────────────────────────────────────────────────────────────

    function openModal() {
        const modal = el('int-connect-modal');
        if (!modal) return;
        // Pre-fill with saved config
        const cfg = MondayIntegration.getConfig();
        const urlInput = el('int-worker-url-real');
        const boardInput = el('int-board-id-real');
        if (urlInput) urlInput.value = cfg.workerUrl || '';
        if (boardInput) boardInput.value = cfg.boardId || '';
        hideAlert('int-connect-alert');
        modal.style.display = 'flex';
        if (urlInput) urlInput.focus();
    }

    function closeModal() {
        const modal = el('int-connect-modal');
        if (modal) modal.style.display = 'none';
    }

    // ─── Card Status ──────────────────────────────────────────────────────────

    function updateCardStatus() {
        const badge = el('int-card-status-badge');
        const cardBtn = el('int-card-connect-btn');
        const headerBadge = el('int-connection-badge');
        const headerLabel = el('int-badge-label');
        const connected = MondayIntegration.isConnected();

        if (badge) {
            badge.className = `int-app-card-badge ${connected ? 'connected' : 'disconnected'}`;
            badge.textContent = connected ? 'Connected' : 'Not connected';
        }
        if (cardBtn) {
            cardBtn.className = `int-app-card-btn ${connected ? 'configure' : ''}`;
            cardBtn.innerHTML = connected
                ? `<span class="material-symbols-outlined" style="font-size:16px">settings</span> Configure`
                : `<span class="material-symbols-outlined" style="font-size:16px">cable</span> Connect`;
        }
        if (headerBadge) {
            headerBadge.className = `int-status-badge ${connected ? 'connected' : 'disconnected'}`;
        }
        if (headerLabel) {
            const cfg = MondayIntegration.getConfig();
            headerLabel.textContent = connected
                ? `Connected · Board ${cfg.boardId}`
                : 'Not connected';
        }

        // Show stat card employee count
        const statEl = el('int-stat-employees');
        if (statEl) {
            const cfg = MondayIntegration.getConfig();
            statEl.textContent = connected ? (cfg.lastSyncCount || '—') : '—';
        }
    }

    // ─── Connect Button ───────────────────────────────────────────────────────

    async function handleConnect() {
        const urlInput = el('int-worker-url-real');
        const boardInput = el('int-board-id-real');
        const btn = el('int-connect-btn');

        const workerUrl = urlInput?.value?.trim();
        const boardId = boardInput?.value?.trim();

        if (!workerUrl) {
            showAlert('int-connect-alert', 'int-connect-alert-msg', 'error', 'Please enter your Cloudflare Worker URL.');
            return;
        }
        if (!boardId) {
            showAlert('int-connect-alert', 'int-connect-alert-msg', 'error', 'Please enter your Monday.com Board ID.');
            return;
        }

        hideAlert('int-connect-alert');
        setButtonLoading(btn, true, 'Connecting…');

        const result = await MondayIntegration.connect(workerUrl, boardId);

        setButtonLoading(btn, false);

        if (!result.ok) {
            showAlert('int-connect-alert', 'int-connect-alert-msg', 'error', `Connection failed: ${result.error}`);
            return;
        }

        // Sync hidden inputs for any legacy code that reads them
        const hiddenUrl = el('int-worker-url');
        const hiddenBoard = el('int-board-id');
        if (hiddenUrl) hiddenUrl.value = workerUrl;
        if (hiddenBoard) hiddenBoard.value = boardId;

        updateCardStatus();
        closeModal();
        renderMappingGrid();
        showMappingPanel();
    }

    // ─── Disconnect ───────────────────────────────────────────────────────────

    function handleDisconnect() {
        MondayIntegration.disconnect();
        updateCardStatus();
        hideMappingPanel();
        hideSyncPanel();
    }

    // ─── Field Mapping Panel ──────────────────────────────────────────────────

    const EMPLOYEE_FIELDS = [
        { key: 'name', label: 'Full Name' },
        { key: 'email', label: 'Email', required: true },
        { key: 'title', label: 'Job Title' },
        { key: 'department', label: 'Department' },
        { key: 'location', label: 'Location' },
        { key: 'phone', label: 'Phone' },
        { key: 'status', label: 'Status' },
        { key: 'manager', label: 'Manager' },
    ];

    function renderMappingGrid() {
        const grid = el('int-mapping-grid');
        if (!grid) return;

        const columns = MondayIntegration.getColumns();
        const cfg = MondayIntegration.getConfig();
        const savedMap = cfg.columnMap || {};

        grid.innerHTML = '';

        const colOptions = columns.map(c =>
            `<option value="${c.id}">${c.title}</option>`
        ).join('');

        EMPLOYEE_FIELDS.forEach(field => {
            const row = document.createElement('div');
            row.className = 'int-mapping-row';

            const label = document.createElement('div');
            label.className = 'int-mapping-label';
            label.innerHTML = field.required
                ? `${field.label} <span style="color:#f87171">*</span>`
                : field.label;

            const select = document.createElement('select');
            select.id = `int-map-${field.key}`;
            select.className = 'int-mapping-select';
            select.innerHTML = `<option value="">— Skip —</option>${colOptions}`;

            // Restore saved mapping
            if (savedMap[field.key]) {
                select.value = savedMap[field.key];
            }

            row.appendChild(label);
            row.appendChild(select);
            grid.appendChild(row);
        });

        // Group filter
        renderGroupFilter();
    }

    function renderGroupFilter() {
        const section = el('int-group-filter-section');
        const container = el('int-group-checkboxes');
        if (!section || !container) return;

        const groups = MondayIntegration.getGroups();
        if (!groups || groups.length === 0) {
            section.style.display = 'none';
            return;
        }

        const cfg = MondayIntegration.getConfig();
        const saved = cfg.groupIds || [];

        container.innerHTML = '';
        groups.forEach(g => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.875rem;color:#e2e8f0';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = g.id;
            cb.checked = saved.length === 0 || saved.includes(g.id);
            cb.style.accentColor = '#6366f1';
            label.appendChild(cb);
            label.appendChild(document.createTextNode(g.title));
            container.appendChild(label);
        });

        section.style.display = 'block';
    }

    function showMappingPanel() {
        const panel = el('int-panel-mapping');
        if (panel) panel.style.display = 'block';
    }

    function hideMappingPanel() {
        const panel = el('int-panel-mapping');
        if (panel) panel.style.display = 'none';
        const grid = el('int-mapping-grid');
        if (grid) grid.innerHTML = '';
    }

    function hideSyncPanel() {
        const panel = el('int-panel-sync');
        if (panel) panel.style.display = 'none';
    }

    function handleSaveMapping() {
        const columnMap = {};
        EMPLOYEE_FIELDS.forEach(field => {
            const sel = el(`int-map-${field.key}`);
            if (sel && sel.value) columnMap[field.key] = sel.value;
        });

        // Collect selected groups
        const groupCheckboxes = document.querySelectorAll('#int-group-checkboxes input[type="checkbox"]');
        const groupIds = [];
        groupCheckboxes.forEach(cb => { if (cb.checked) groupIds.push(cb.value); });

        MondayIntegration.saveConfig({ columnMap, groupIds });
        showSyncPanel();
        refreshSyncStatus();
    }

    // ─── Sync Panel ───────────────────────────────────────────────────────────

    function showSyncPanel() {
        const panel = el('int-panel-sync');
        if (panel) panel.style.display = 'block';
    }

    function refreshSyncStatus() {
        const cfg = MondayIntegration.getConfig();
        const lastSynced = el('int-last-synced');
        if (lastSynced) {
            lastSynced.textContent = cfg.lastSyncAt
                ? new Date(cfg.lastSyncAt).toLocaleString()
                : 'Never';
        }
        const autoToggle = el('int-autosync-toggle');
        if (autoToggle) autoToggle.checked = !!cfg.autoSync;
        const radios = document.querySelectorAll('input[name="int-interval"]');
        radios.forEach(r => { r.checked = String(r.value) === String(cfg.syncInterval); });
    }

    async function handleSyncNow() {
        const btn = el('int-sync-now-btn');
        const syncAlert = el('int-sync-alert');
        const syncMsg = el('int-sync-alert-msg');

        setButtonLoading(btn, true, 'Importing…');
        if (syncAlert) syncAlert.style.display = 'none';

        const result = await MondayIntegration.sync();
        setButtonLoading(btn, false);
        refreshSyncStatus();
        updateCardStatus();

        if (syncAlert && syncMsg) {
            if (result.ok) {
                syncAlert.className = 'int-alert success';
                syncMsg.textContent = `Sync complete! Added ${result.added}, updated ${result.updated}, skipped ${result.skipped}.`;
            } else {
                syncAlert.className = 'int-alert error';
                syncMsg.textContent = result.error || 'Sync failed.';
            }
            syncAlert.style.display = 'flex';
        }
    }

    // ─── Public: refreshStatus ────────────────────────────────────────────────

    function refreshStatus() {
        updateCardStatus();
        refreshSyncStatus();
    }

    // ─── Wire Events ─────────────────────────────────────────────────────────

    function wireEvents() {
        // Card → open modal
        el('int-card-connect-btn')?.addEventListener('click', openModal);

        // Modal close
        el('int-modal-close')?.addEventListener('click', closeModal);
        el('int-modal-cancel')?.addEventListener('click', closeModal);
        el('int-connect-modal')?.addEventListener('click', e => {
            if (e.target === el('int-connect-modal')) closeModal();
        });

        // Connect button inside modal
        el('int-connect-btn')?.addEventListener('click', handleConnect);

        // Disconnect button inside modal
        el('int-disconnect-btn')?.addEventListener('click', () => {
            handleDisconnect();
            closeModal();
        });

        // Mapping save
        el('int-save-mapping-btn')?.addEventListener('click', handleSaveMapping);

        // Sync now
        el('int-sync-now-btn')?.addEventListener('click', handleSyncNow);

        // Auto-sync toggle
        el('int-autosync-toggle')?.addEventListener('change', e => {
            MondayIntegration.saveConfig({ autoSync: e.target.checked });
            if (e.target.checked) MondayIntegration.startAutoSync();
            else MondayIntegration.stopAutoSync();
        });

        // Interval radio buttons
        document.querySelectorAll('input[name="int-interval"]').forEach(r => {
            r.addEventListener('change', () => {
                MondayIntegration.saveConfig({ syncInterval: Number(r.value) });
                if (MondayIntegration.getConfig().autoSync) MondayIntegration.startAutoSync();
            });
        });

        // Keyboard ESC to close modal
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    function init() {
        MondayIntegration.loadConfig();

        if (!_initialized) {
            _initialized = true;
            wireEvents();
        }

        // Update card status badge
        updateCardStatus();

        // If already connected: show mapping + sync panels
        if (MondayIntegration.isConnected()) {
            renderMappingGrid();
            showMappingPanel();

            const cfg = MondayIntegration.getConfig();
            if (Object.keys(cfg.columnMap || {}).length > 0) {
                showSyncPanel();
            }
            refreshSyncStatus();

            // Show disconnect button in modal
            const disconnectBtn = el('int-disconnect-btn');
            if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
        }

        MondayIntegration.startAutoSync();
    }

    return { init, refreshStatus };

})();
