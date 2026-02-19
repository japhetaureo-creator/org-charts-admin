/**
 * monday-integration.js
 *
 * Client-side module for Monday.com integration.
 * Handles connection, field mapping, sync, upsert, and auto-sync scheduling.
 *
 * Dependencies: SharedEmployeeStore, SharedLogStore (loaded before this script)
 */

const MondayIntegration = (() => {

    // ─── Config ──────────────────────────────────────────────────────────────

    const CONFIG_KEY = 'monday_integration_config';

    const DEFAULT_CONFIG = {
        workerUrl: '',
        boardId: '',
        columnMap: {},
        groupIds: [],        // selected group IDs to sync (empty = all groups)
        syncInterval: 21600000, // 6 hours in ms
        autoSync: false,
        lastSyncAt: null,
        lastSyncCount: 0,
    };

    let _config = { ...DEFAULT_CONFIG };
    let _autoSyncTimer = null;
    let _columns = []; // cached column list from Monday board
    let _groups = []; // cached group list from Monday board

    // ─── Config Persistence ──────────────────────────────────────────────────

    function saveConfig(updates = {}) {
        _config = { ..._config, ...updates };
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(_config));
        } catch (e) {
            console.warn('MondayIntegration: could not save config', e);
        }
    }

    function loadConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_KEY);
            if (raw) _config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        } catch (e) {
            console.warn('MondayIntegration: could not load config', e);
        }
        return _config;
    }

    function getConfig() {
        return { ..._config };
    }

    function isConnected() {
        return !!(_config.workerUrl && _config.boardId && Object.keys(_config.columnMap).length > 0);
    }

    // ─── API Calls ───────────────────────────────────────────────────────────

    /**
     * Validate the Worker URL by fetching the boards list.
     * Returns { ok: true, boards } or { ok: false, error }
     */
    async function connect(workerUrl, boardId) {
        const base = workerUrl.replace(/\/$/, '');
        try {
            const res = await fetch(`${base}/boards`);
            if (!res.ok) throw new Error(`Worker returned ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Fetch columns and groups for this board in parallel
            const [cols, groups] = await Promise.all([
                fetchColumns(base, boardId),
                fetchGroups(base, boardId),
            ]);
            _columns = cols;
            _groups = groups;

            saveConfig({ workerUrl: base, boardId });
            return { ok: true, boards: data.boards, columns: cols, groups };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    /**
     * Fetch column names for a board (for the mapping UI)
     */
    async function fetchColumns(workerUrl, boardId) {
        const base = (workerUrl || _config.workerUrl).replace(/\/$/, '');
        const id = boardId || _config.boardId;
        const res = await fetch(`${base}/columns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boardId: id }),
        });
        if (!res.ok) throw new Error(`Could not fetch columns: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        _columns = data.columns ?? [];
        return _columns;
    }

    /**
     * Fetch group (table) list for a board
     */
    async function fetchGroups(workerUrl, boardId) {
        const base = (workerUrl || _config.workerUrl).replace(/\/$/, '');
        const id = boardId || _config.boardId;
        try {
            const res = await fetch(`${base}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId: id }),
            });
            if (!res.ok) return [];
            const data = await res.json();
            _groups = data.groups ?? [];
            return _groups;
        } catch (e) {
            console.warn('MondayIntegration: could not fetch groups', e);
            return [];
        }
    }

    /**
     * Sync employees from Monday.com.
     * Returns { ok, added, updated, skipped, total, error? }
     */
    async function sync() {
        if (!_config.workerUrl || !_config.boardId) {
            return { ok: false, error: 'Not configured. Please connect first.' };
        }
        if (!Object.keys(_config.columnMap).length) {
            return { ok: false, error: 'No field mapping configured.' };
        }

        try {
            const res = await fetch(`${_config.workerUrl}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boardId: _config.boardId,
                    columnMap: _config.columnMap,
                    groupIds: _config.groupIds?.length ? _config.groupIds : undefined,
                }),
            });
            if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Upsert into SharedEmployeeStore
            const result = upsertEmployees(data.employees ?? []);

            const now = new Date().toISOString();
            saveConfig({ lastSyncAt: now, lastSyncCount: result.added + result.updated });

            // Log to activity feed
            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'system',
                    action: 'Monday.com sync completed',
                    target: `${result.added} added, ${result.updated} updated`,
                    icon: 'sync',
                    details: `Total from board: ${data.total}. Skipped (no email): ${data.skipped ?? 0}.`,
                });
            }

            return { ok: true, ...result, total: data.total, skipped: data.skipped ?? 0 };
        } catch (err) {
            console.error('MondayIntegration sync error:', err);
            return { ok: false, error: err.message };
        }
    }

    // ─── Upsert Logic ────────────────────────────────────────────────────────

    /**
     * Upsert employees into SharedEmployeeStore by email.
     * Returns { added, updated }
     */
    function upsertEmployees(incoming) {
        if (typeof SharedEmployeeStore === 'undefined') {
            console.warn('MondayIntegration: SharedEmployeeStore not available');
            return { added: 0, updated: 0 };
        }

        let added = 0;
        let updated = 0;

        for (const emp of incoming) {
            if (!emp.email) continue;

            const existing = SharedEmployeeStore.getAll().find(
                e => e.email && e.email.toLowerCase() === emp.email.toLowerCase()
            );

            if (existing) {
                // Update existing employee fields
                SharedEmployeeStore.update(existing.id, {
                    name: emp.name || existing.name,
                    department: emp.department || existing.department,
                    role: emp.title || existing.role,
                    location: emp.location || existing.location,
                    status: emp.status || existing.status,
                    mondayId: emp.mondayId,
                }); // update() always logs — that's fine
                updated++;
            } else {
                // Add new employee
                SharedEmployeeStore.add({
                    name: emp.name,
                    email: emp.email,
                    department: emp.department || 'Unassigned',
                    role: emp.title || '',
                    location: emp.location || '',
                    status: emp.status || 'active',
                    mondayId: emp.mondayId,
                    avatar: generateAvatarUrl(emp.name),
                }, true); // silent=true: suppress per-employee log entries
                added++;
            }
        }

        return { added, updated };
    }

    function generateAvatarUrl(name) {
        // Use UI Avatars as a fallback for new employees
        const encoded = encodeURIComponent(name || 'Employee');
        return `https://ui-avatars.com/api/?name=${encoded}&background=6366f1&color=fff&size=128`;
    }

    // ─── Auto-Sync ───────────────────────────────────────────────────────────

    function startAutoSync() {
        stopAutoSync();
        if (!_config.autoSync || !isConnected()) return;

        const interval = _config.syncInterval || DEFAULT_CONFIG.syncInterval;
        console.log(`MondayIntegration: auto-sync every ${interval / 60000} minutes`);

        _autoSyncTimer = setInterval(async () => {
            console.log('MondayIntegration: running scheduled sync...');
            const result = await sync();
            console.log('MondayIntegration: sync result', result);
            // Update the UI if the integrations page is visible
            if (typeof MondayIntegrationUI !== 'undefined') {
                MondayIntegrationUI.refreshStatus();
            }
        }, interval);
    }

    function stopAutoSync() {
        if (_autoSyncTimer) {
            clearInterval(_autoSyncTimer);
            _autoSyncTimer = null;
        }
    }

    // ─── Disconnect ──────────────────────────────────────────────────────────

    function disconnect() {
        stopAutoSync();
        _config = { ...DEFAULT_CONFIG };
        _columns = [];
        try { localStorage.removeItem(CONFIG_KEY); } catch (e) { /* ignore */ }
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    return {
        loadConfig,
        saveConfig,
        getConfig,
        isConnected,
        connect,
        fetchColumns: (url, id) => fetchColumns(url, id),
        fetchGroups: (url, id) => fetchGroups(url, id),
        getColumns: () => _columns,
        getGroups: () => _groups,
        sync,
        startAutoSync,
        stopAutoSync,
        disconnect,
    };

})();
