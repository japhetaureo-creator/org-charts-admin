// Admin Dashboard Application Logic

// ============================================================================
// UTILITIES
// ============================================================================

/** Escape a value for safe insertion into innerHTML. */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const AppState = {
    currentPage: 'company',
    user: null,
    organizationData: {
        name: 'Acme Corp',
        headcount: 1240,
        departments: [
            { name: 'Engineering', percentage: 45, color: 'primary' },
            { name: 'Sales & Ops', percentage: 30, color: 'purple-500' },
            { name: 'Marketing', percentage: 25, color: 'orange-400' }
        ],
        totalGroups: 12
    },
    activityFeed: [],
    dataSources: [],
    syncStatus: 'Active'
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Initialize auth session (restores from sessionStorage if any)
    if (typeof AuthStore !== 'undefined') AuthStore.init();

    // Wire up data store listeners so the dashboard stays in sync
    if (typeof SharedEmployeeStore !== 'undefined') {
        SharedEmployeeStore.onChange(() => updateDashboard());
    }
    if (typeof SharedLogStore !== 'undefined') {
        SharedLogStore.onChange(() => updateDashboard());
    }

    // Apply saved company settings (name, logo, favicon)
    if (typeof CompanySettings !== 'undefined') CompanySettings.init();

    // Apply saved appearance (theme, accent color)
    if (typeof AppSettings !== 'undefined') AppSettings.applyAll();

    // Start Monday.com auto-sync if previously configured
    if (typeof MondayIntegration !== 'undefined') {
        MondayIntegration.loadConfig();
        MondayIntegration.startAutoSync();
    }

    // Initialize navigation and events
    initializeNavigation();
    initializeEventListeners();

    // Populate the dashboard
    loadInitialData();
    updateDashboard();
}

// ============================================================================
// AUTH PERMISSIONS
// ============================================================================

/**
 * Called by auth-ui.js on login/logout to re-apply DOM permission state.
 * Delegates to AuthStore.applyPermissions() and additionally handles
 * page-level lock overlays for Settings and User Management.
 */
function applyAuthPermissions() {
    if (typeof AuthStore === 'undefined') return;
    AuthStore.applyPermissions();

    const canAccess = {
        settings: AuthStore.can('settings'),
        userManagement: AuthStore.can('userManagement'),
    };

    // If current page is restricted, bounce back to company dashboard
    const curPage = AppState.currentPage;
    if (curPage === 'settings' && !canAccess.settings) {
        navigateToPage('company');
    }
    if (curPage === 'users' && !canAccess.userManagement) {
        navigateToPage('company');
    }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initializeNavigation() {
    const navLinks = document.querySelectorAll('nav a[data-page]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            navigateToPage(page);
        });
    });
}

function navigateToPage(page) {
    // ── Auth guard: redirect guests away from restricted pages ────────────
    const RESTRICTED = ['settings', 'users', 'integrations'];
    if (RESTRICTED.includes(page) && typeof AuthStore !== 'undefined' && !AuthStore.isLoggedIn()) {
        // Open login modal instead
        if (typeof AuthUI !== 'undefined') {
            AuthUI.openLoginModal();
        }
        return;
    }

    // Remove active state from all links
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('bg-primary/10', 'text-primary');
        link.classList.add('text-slate-600', 'dark:text-slate-400');
        link.querySelector('span:last-child')?.classList.remove('font-semibold');
        link.querySelector('span:last-child')?.classList.add('font-medium');
    });

    // Add active state to clicked link
    const activeLink = document.querySelector(`nav a[data-page="${page}"]`);
    if (activeLink) {
        activeLink.classList.add('bg-primary/10', 'text-primary');
        activeLink.classList.remove('text-slate-600', 'dark:text-slate-400');
        activeLink.querySelector('span:last-child')?.classList.add('font-semibold');
        activeLink.querySelector('span:last-child')?.classList.remove('font-medium');
    }

    AppState.currentPage = page;

    const mainEl = document.querySelector('main');
    const orgChartPage = document.getElementById('page-org-chart');
    const empDirPage = document.getElementById('page-employee-directory');
    const usersPage = document.getElementById('page-users');
    const intPage = document.getElementById('page-integrations');
    const settingsPage = document.getElementById('page-settings');
    const fullPages = ['org-chart', 'employee-directory', 'users', 'integrations', 'settings'];

    // Always hide settings cleanly (CSS controls display via class)
    if (settingsPage) settingsPage.classList.remove('page-settings-visible');

    // Clear previous page-specific body classes
    document.body.classList.remove('oc-org-chart-mode');

    if (fullPages.includes(page)) {
        // Switch main into "nav mode": shrinks to 0 via CSS but header stays fixed/visible
        if (mainEl) {
            mainEl.classList.remove('hidden');
            mainEl.classList.add('oc-nav-mode');
        }
        document.body.classList.add('oc-full-page-mode');
        if (page === 'org-chart') document.body.classList.add('oc-org-chart-mode');

        // Hide all full pages, then show the requested one
        if (orgChartPage) orgChartPage.classList.add('hidden');
        if (empDirPage) empDirPage.classList.add('hidden');
        if (usersPage) usersPage.classList.add('hidden');
        if (intPage) intPage.classList.add('hidden');

        if (page === 'settings') {
            if (settingsPage) settingsPage.classList.add('page-settings-visible');
        } else {
            const target = document.getElementById(`page-${page}`);
            if (target) target.classList.remove('hidden');
        }

        // Initialize page-specific modules
        if (page === 'org-chart' && typeof initOrgChart === 'function') {
            initOrgChart();
        }
        if (page === 'employee-directory' && typeof EmployeeDirectory !== 'undefined') {
            EmployeeDirectory.init();
        }
        if (page === 'users' && typeof UserManagement !== 'undefined') {
            UserManagement.init();
        }
        if (page === 'integrations' && typeof MondayIntegrationUI !== 'undefined') {
            MondayIntegrationUI.init();
        }
        if (page === 'settings' && typeof SettingsPageUI !== 'undefined') {
            SettingsPageUI.init();
        }
        if (page === 'settings' && typeof SettingsUI !== 'undefined') {
            SettingsUI.init();
        }
    } else {
        // Restore main to normal; show company dashboard
        if (mainEl) {
            mainEl.classList.remove('oc-nav-mode');
            mainEl.classList.remove('hidden');
        }
        document.body.classList.remove('oc-full-page-mode');

        if (orgChartPage) orgChartPage.classList.add('hidden');
        if (empDirPage) empDirPage.classList.add('hidden');
        if (usersPage) usersPage.classList.add('hidden');
        if (intPage) intPage.classList.add('hidden');

        // Show correct page section within dashboard
        document.querySelectorAll('#page-content > .page-section').forEach(section => {
            section.classList.add('hidden');
        });
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }
    }
}



// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initializeEventListeners() {
    // View Audit Log button
    const viewAuditLogBtn = document.getElementById('view-audit-log-btn');
    if (viewAuditLogBtn) {
        viewAuditLogBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuditLogModal();
        });
    }

    // Audit Log Modal close
    const auditLogClose = document.getElementById('audit-log-close');
    const auditLogDone = document.getElementById('audit-log-done');
    const auditLogModal = document.getElementById('audit-log-modal');

    if (auditLogClose) {
        auditLogClose.addEventListener('click', () => {
            if (auditLogModal) auditLogModal.classList.add('hidden');
        });
    }

    if (auditLogDone) {
        auditLogDone.addEventListener('click', () => {
            if (auditLogModal) auditLogModal.classList.add('hidden');
        });
    }
}

/** Show the full audit log modal */
function showAuditLogModal() {
    console.log('Opening Audit Log Modal...');
    const modal = document.getElementById('audit-log-modal');
    const content = document.getElementById('audit-log-content');
    if (!modal || !content || typeof SharedLogStore === 'undefined') {
        console.error('Audit Log Modal elements or store not found:', { modal, content, store: typeof SharedLogStore });
        return;
    }

    const logs = SharedLogStore.getAll();

    if (logs.length === 0) {
        content.innerHTML = '<div class="p-8 text-center text-slate-400">No organizational changes recorded yet.</div>';
    } else {
        content.innerHTML = logs.map(log => {
            const timeLabel = escapeHtml(formatTimestamp(log.timestamp));
            const userDisplay = escapeHtml(log.user?.name || 'System');
            const avatarUrl = escapeHtml(log.user?.avatar || '');
            const avatarHtml = avatarUrl
                ? `<div class="h-10 w-10 rounded-full bg-cover bg-center shrink-0 border border-slate-200 dark:border-slate-700" style="background-image: url('${avatarUrl}')"></div>`
                : `<div class="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0">${userDisplay.charAt(0)}</div>`;
            const action = escapeHtml(log.action);
            const target = escapeHtml(log.target);
            const details = escapeHtml(log.details);
            const icon = escapeHtml(log.icon || 'info');

            return `
                <div class="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-border-dark/50 last:border-0">
                    ${avatarHtml}
                    <div class="flex-1">
                        <p class="text-sm text-slate-800 dark:text-slate-200 font-medium">
                            ${userDisplay} <span class="font-normal text-slate-500 dark:text-slate-400">${action}</span>${target ? ` <span class="font-bold">${target}</span>` : ''}
                        </p>
                        ${details ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">${details}</p>` : ''}
                        <p class="text-xs text-slate-400 mt-1">${timeLabel}</p>
                    </div>
                    <div class="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                        <span class="material-symbols-outlined text-[18px]">${icon}</span>
                    </div>
                </div>`;
        }).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadInitialData() {
    // Active integrations — currently only Monday.com
    AppState.dataSources = [
        {
            id: 1,
            name: 'Monday.com',
            description: 'Primary data source',
            initials: 'MD',
            color: '#F64F00',
            status: 'live'
        }
    ];
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateDashboard() {
    updateDepartmentStats();
    updateDemographics();
    updateLocationPresence();
    updateActivityFeed();
    updateSyncStatus();
}

function updateDepartmentStats() {
    const allEmployees = typeof SharedEmployeeStore !== 'undefined' ? SharedEmployeeStore.getAll() : [];

    // Update headcount
    const headcountEl = document.getElementById('total-headcount');
    if (headcountEl) {
        headcountEl.textContent = allEmployees.length.toLocaleString();
    }

    // Update department breakdown
    const depts = {};
    allEmployees.forEach(emp => {
        const d = emp.department || 'Other';
        depts[d] = (depts[d] || 0) + 1;
    });

    const deptContainer = document.getElementById('department-breakdown');
    if (deptContainer) {
        const sortedDepts = Object.entries(depts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        deptContainer.innerHTML = sortedDepts.map(([name, count]) => {
            const pct = allEmployees.length > 0 ? Math.round((count / allEmployees.length) * 100) : 0;
            const colorClass = name.toLowerCase().includes('eng') ? 'bg-primary' :
                name.toLowerCase().includes('sale') || name.toLowerCase().includes('op') ? 'bg-purple-500' : 'bg-orange-400';
            return `
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${colorClass}"></span>
                <span class="text-xs text-slate-500 dark:text-slate-400">${name} (${pct}%)</span>
            </div>`;
        }).join('');

        // Update SVG paths
        let cumulativePct = 0;
        sortedDepts.forEach(([name, count], index) => {
            const path = document.getElementById(`dept-path-${index + 1}`);
            if (path) {
                const pct = (count / allEmployees.length) * 100;
                path.style.strokeDasharray = `${pct} 100`;
                path.style.strokeDashoffset = `-${cumulativePct}`;
                cumulativePct += pct;
            }
        });
    }

    // Update total groups (distinct depts)
    const groupsEl = document.getElementById('total-groups');
    if (groupsEl) {
        groupsEl.textContent = Object.keys(depts).length;
    }
}

function updateDemographics() {
    const allEmployees = typeof SharedEmployeeStore !== 'undefined' ? SharedEmployeeStore.getAll() : [];
    if (allEmployees.length === 0) return;

    const stats = { Male: 0, Female: 0, Other: 0 };
    allEmployees.forEach(emp => {
        if (emp.gender === 'Male') stats.Male++;
        else if (emp.gender === 'Female') stats.Female++;
        else stats.Other++;
    });

    const total = allEmployees.length;
    const malePct = Math.round((stats.Male / total) * 100);
    const femalePct = Math.round((stats.Female / total) * 100);
    const otherPct = Math.round((stats.Other / total) * 100);

    // Update Labels
    const maleLabel = document.getElementById('gender-male-label');
    const femaleLabel = document.getElementById('gender-female-label');
    const otherLabel = document.getElementById('gender-other-label');

    if (maleLabel) maleLabel.textContent = `Male (${malePct}%)`;
    if (femaleLabel) femaleLabel.textContent = `Female (${femalePct}%)`;
    if (otherLabel) otherLabel.textContent = `Other (${otherPct}%)`;

    // Update Chart SVGs (simplified donut logic)
    const malePath = document.getElementById('gender-male-path');
    const femalePath = document.getElementById('gender-female-path');

    if (malePath && femalePath) {
        // Stacked donut paths
        // Total circumference is 100 (due to 15.9155 radius)
        malePath.style.strokeDasharray = `${malePct} 100`;
        femalePath.style.strokeDasharray = `${femalePct} 100`;
        femalePath.style.strokeDashoffset = `-${malePct}`;
    }
}

function updateLocationPresence() {
    const allEmployees = typeof SharedEmployeeStore !== 'undefined' ? SharedEmployeeStore.getAll() : [];
    if (allEmployees.length === 0) return;

    // Calculate location distribution
    const locations = {};
    allEmployees.forEach(emp => {
        const loc = emp.location || 'Remote';
        locations[loc] = (locations[loc] || 0) + 1;
    });

    const totalLocs = Object.keys(locations).length;
    const totalCount = allEmployees.length;

    // Update total count label
    const totalLocsEl = document.getElementById('total-locations');
    if (totalLocsEl) {
        totalLocsEl.textContent = totalLocs;
    }

    // Update breakdown labels
    const locContainer = document.getElementById('location-breakdown');
    if (locContainer) {
        const sortedLocs = Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];

        locContainer.innerHTML = sortedLocs.map(([name, count], index) => {
            const pct = Math.round((count / totalCount) * 100);
            return `
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${colors[index] || 'bg-slate-400'}"></span>
                <span class="text-xs text-slate-500 dark:text-slate-400">${name} (${pct}%)</span>
            </div>`;
        }).join('');

        // Update SVG paths
        let cumulativePct = 0;
        sortedLocs.forEach(([name, count], index) => {
            const path = document.getElementById(`location-path-${index + 1}`);
            if (path) {
                const pct = (count / totalCount) * 100;
                path.style.strokeDasharray = `${pct} 100`;
                path.style.strokeDashoffset = `-${cumulativePct}`;
                cumulativePct += pct;
            }
        });
    }
}

/** Update the activity feed component */
function updateActivityFeed() {
    const feedContainer = document.getElementById('activity-feed');
    if (!feedContainer || typeof SharedLogStore === 'undefined') return;

    const logs = SharedLogStore.getAll().slice(0, 10); // Show only last 10 on dashboard

    if (logs.length === 0) {
        feedContainer.innerHTML = '<div class="p-8 text-center text-slate-400">No organizational changes recorded yet.</div>';
        return;
    }

    feedContainer.innerHTML = logs.map(log => {
        const timeLabel = escapeHtml(formatTimestamp(log.timestamp));
        const userDisplay = escapeHtml(log.user?.name || 'System');
        const avatarUrl = escapeHtml(log.user?.avatar || '');
        const avatarHtml = avatarUrl
            ? `<div class="h-10 w-10 rounded-full bg-cover bg-center shrink-0" style="background-image: url('${avatarUrl}')"></div>`
            : `<div class="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0">${userDisplay.charAt(0)}</div>`;
        const action = escapeHtml(log.action);
        const target = escapeHtml(log.target);
        const details = escapeHtml(log.details);
        const icon = escapeHtml(log.icon || 'info');

        return `
            <div class="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-border-dark/50 last:border-0">
                ${avatarHtml}
                <div class="flex-1">
                    <p class="text-sm text-slate-800 dark:text-slate-200 font-medium">${userDisplay} <span class="font-normal text-slate-500 dark:text-slate-400">${action}</span>${target ? ` <span class="font-bold">${target}</span>` : ''}</p>
                    ${details ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">${details}</p>` : ''}
                    <p class="text-xs text-slate-400 mt-1">${timeLabel}</p>
                </div>
                <div class="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                    <span class="material-symbols-outlined text-[18px]">${icon}</span>
                </div>
            </div>`;
    }).join('');
}

function updateSyncStatus() {
    const statusEl = document.getElementById('sync-status');
    const progressEl = document.getElementById('sync-progress');

    if (statusEl) {
        statusEl.textContent = AppState.syncStatus;
    }

    if (progressEl) {
        progressEl.style.width = AppState.syncStatus === 'Active' ? '100%' : '0%';
    }
}



// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (isNaN(diff) || diff < 0) return 'Just now';
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    // Use explicit local date formatting to avoid midnight timezone edge cases
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// â”€â”€ Settings UI Controller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SettingsUI = (() => {
    let _initialized = false;
    let _pendingLogo = null;    // File or null (null = clear)
    let _pendingFavicon = null; // File or null

    function init() {
        if (_initialized) { populate(); return; }
        _initialized = true;

        // Save button
        document.getElementById('settings-save-btn')?.addEventListener('click', handleSave);

        // Logo file input
        const logoInput = document.getElementById('settings-logo-input');
        logoInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showAlert('error', 'Logo must be under 2 MB.');
                return;
            }
            _pendingLogo = file;
            previewImage(file, 'settings-logo-preview', true);
            document.getElementById('settings-logo-clear').style.display = 'inline';
        });

        // Logo clear
        document.getElementById('settings-logo-clear')?.addEventListener('click', () => {
            _pendingLogo = null; // null signals "remove"
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                preview.style.backgroundImage = '';
                const name = document.getElementById('settings-company-name')?.value || 'A';
                preview.textContent = name.charAt(0).toUpperCase();
            }
            document.getElementById('settings-logo-clear').style.display = 'none';
            document.getElementById('settings-logo-input').value = '';
        });

        // Favicon file input
        const faviconInput = document.getElementById('settings-favicon-input');
        faviconInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            _pendingFavicon = file;
            previewImage(file, 'settings-favicon-preview', false);
            document.getElementById('settings-favicon-clear').style.display = 'inline';
        });

        // Favicon clear
        document.getElementById('settings-favicon-clear')?.addEventListener('click', () => {
            _pendingFavicon = null;
            const preview = document.getElementById('settings-favicon-preview');
            if (preview) preview.innerHTML = '<span class="material-symbols-outlined" style="color:#64748b;font-size:20px">tab</span>';
            document.getElementById('settings-favicon-clear').style.display = 'none';
            document.getElementById('settings-favicon-input').value = '';
        });

        populate();
    }

    function populate() {
        if (typeof CompanySettings === 'undefined') return;
        const s = CompanySettings.get();

        // Company name
        const nameInput = document.getElementById('settings-company-name');
        if (nameInput) nameInput.value = s.name || '';

        // Logo preview
        const logoPreview = document.getElementById('settings-logo-preview');
        if (logoPreview) {
            if (s.logoDataUrl) {
                logoPreview.style.cssText += ';background-image:url(' + s.logoDataUrl + ');background-size:cover;background-position:center;';
                logoPreview.textContent = '';
                document.getElementById('settings-logo-clear').style.display = 'inline';
            } else {
                logoPreview.textContent = (s.name || 'A').charAt(0).toUpperCase();
            }
        }

        // Favicon preview
        const faviconPreview = document.getElementById('settings-favicon-preview');
        if (faviconPreview && s.faviconDataUrl) {
            faviconPreview.innerHTML = `<img src="${s.faviconDataUrl}" style="width:32px;height:32px;object-fit:contain;" />`;
            document.getElementById('settings-favicon-clear').style.display = 'inline';
        }

        _pendingLogo = undefined;   // undefined = no change
        _pendingFavicon = undefined;
    }

    async function handleSave() {
        if (typeof CompanySettings === 'undefined') return;

        const btn = document.getElementById('settings-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Savingâ€¦'; }

        try {
            const name = document.getElementById('settings-company-name')?.value.trim();
            if (name) CompanySettings.setName(name);

            // Logo: undefined = no change, null = clear, File = upload
            if (_pendingLogo !== undefined) {
                await CompanySettings.setLogo(_pendingLogo);
            }
            if (_pendingFavicon !== undefined) {
                await CompanySettings.setFavicon(_pendingFavicon);
            }

            _pendingLogo = undefined;
            _pendingFavicon = undefined;

            showAlert('success', 'Settings saved! Changes are applied immediately.');
        } catch (e) {
            showAlert('error', `Save failed: ${e.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined !text-base">save</span> Save Changes';
            }
        }
    }

    function previewImage(file, previewId, isBig) {
        const reader = new FileReader();
        reader.onload = e => {
            const el = document.getElementById(previewId);
            if (!el) return;
            if (isBig) {
                el.style.backgroundImage = `url('${e.target.result}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.textContent = '';
            } else {
                el.innerHTML = `<img src="${e.target.result}" style="width:32px;height:32px;object-fit:contain;" />`;
            }
        };
        reader.readAsDataURL(file);
    }

    function showAlert(type, msg) {
        const el = document.getElementById('settings-alert');
        const msgEl = document.getElementById('settings-alert-msg');
        if (!el || !msgEl) return;
        el.className = `int-alert ${type}`;
        msgEl.textContent = msg;
        el.style.display = 'flex';
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    return { init };
})();
