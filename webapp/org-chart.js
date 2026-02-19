// Organization Chart Interactive Logic
// ============================================================================

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const OrgChartState = {
    editMode: false,
    selectedCard: null,
    employees: [],
    draggedCard: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    filterDepts: [],
    filterSearch: '',
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    scrollStartX: 0,
    scrollStartY: 0,
    dotGridVisible: true
};

// ============================================================================
// INITIALIZATION
// ============================================================================

let _orgChartInitialized = false;

function initOrgChart() {
    console.log('Organization Chart initialized');

    // Load mock employee data
    loadEmployeeData();

    // Initialize event listeners (only once)
    if (!_orgChartInitialized) {
        initOrgChartEventListeners();

        // Grey out inactive employee nodes whenever data changes
        SharedEmployeeStore.onChange(() => {
            document.querySelectorAll('.org-card[data-employee-id]').forEach(card => {
                const emp = SharedEmployeeStore.getById(card.dataset.employeeId);
                const inactive = emp?.status === 'inactive';
                card.style.opacity = inactive ? '0.35' : '';
                card.style.pointerEvents = inactive ? 'none' : '';
                card.style.filter = inactive ? 'grayscale(0.6)' : '';
                card.classList.toggle('oc-inactive', inactive);
            });
        });

        _orgChartInitialized = true;
    }

    // Render the org chart
    renderOrgChart();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initOrgChartEventListeners() {
    // Edit mode toggle
    const editToggle = document.getElementById('org-edit-toggle');
    if (editToggle) {
        editToggle.addEventListener('change', (e) => {
            // Auth guard: only logged-in users with edit permission can enable edit mode
            if (e.target.checked && typeof AuthStore !== 'undefined' && !AuthStore.can('edit')) {
                e.target.checked = false; // Reset toggle
                if (typeof AuthUI !== 'undefined') AuthUI.openLoginModal();
                return;
            }
            OrgChartState.editMode = e.target.checked;
            toggleEditMode(e.target.checked);
        });
    }

    // Export PDF button
    const exportBtn = document.querySelector('[data-action="export-pdf"]');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportOrgChartPDF);
    }

    // Share button
    const shareBtn = document.querySelector('[data-action="share"]');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareOrgChart);
    }

    // Search functionality
    const searchInput = document.querySelector('.org-chart-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchEmployees(e.target.value);
        });
    }

    // Populate dynamic filters from SharedEmployeeStore
    populateFilters();

    // Re-populate filters when employee data changes
    SharedEmployeeStore.onChange(() => {
        populateFilters();
    });

    // Reset Filters
    const resetBtn = document.getElementById('oc-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }

    // Canvas pan via CSS transforms
    const canvas = document.getElementById('org-chart-canvas');
    const chartHierarchy = document.getElementById('oc-chart-hierarchy');
    if (canvas && chartHierarchy) {
        // Set canvas to clip (no native scroll needed)
        canvas.style.overflow = 'hidden';

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // left click only
            const target = e.target;
            // Block panning when clicking interactive elements
            if (target.closest('.org-card') ||
                target.closest('button') ||
                target.closest('input') ||
                target.closest('a') ||
                target.closest('label') ||
                target.closest('.oc-edit-controls') ||
                target.closest('.oc-drop-ghost')) return;

            OrgChartState.isPanning = true;
            OrgChartState.panStartX = e.clientX;
            OrgChartState.panStartY = e.clientY;
            canvas.style.cursor = 'grabbing';
            canvas.style.userSelect = 'none';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!OrgChartState.isPanning) return;
            const dx = e.clientX - OrgChartState.panStartX;
            const dy = e.clientY - OrgChartState.panStartY;
            OrgChartState.panX += dx;
            OrgChartState.panY += dy;
            OrgChartState.panStartX = e.clientX;
            OrgChartState.panStartY = e.clientY;
            chartHierarchy.style.transform = `translate(${OrgChartState.panX}px, ${OrgChartState.panY}px)`;
            updateMinimapViewport();
        });

        window.addEventListener('mouseup', () => {
            if (OrgChartState.isPanning) {
                OrgChartState.isPanning = false;
                canvas.style.cursor = 'grab';
                canvas.style.userSelect = '';
            }
        });

        // Initial minimap sync after a short delay for layout
        setTimeout(() => {
            updateMinimapViewport();
            // NOTE: Do NOT call initializeConnectors() here — the hardcoded HTML in
            // index.html already has correct connector positions. initializeConnectors
            // should only be called after dynamically adding/moving cards.
            centerTree(false); // Initial center without transition
        }, 500);

        // Card click to select / highlight
        canvas.addEventListener('click', (e) => {
            const card = e.target.closest('.org-card');
            if (card) {
                // Don't select if clicking buttons inside the card
                if (e.target.closest('button')) return;

                // Deselect previous
                document.querySelectorAll('.org-card.oc-selected').forEach(c => c.classList.remove('oc-selected'));

                // Select this one
                card.classList.add('oc-selected');
                OrgChartState.selectedCard = card.dataset.employeeId;
            }
        });

        // Make canvas toolbar relative to bottom right to avoid overlap
        const toolbar = document.getElementById('oc-canvas-toolbar');
        if (toolbar) {
            toolbar.style.left = 'auto';
            toolbar.style.right = '240px'; // To the left of the minimap
            toolbar.style.bottom = '24px';
        }
    }

    // Dot Grid Toggle
    const dotToggle = document.getElementById('oc-toggle-dots');
    if (dotToggle) {
        dotToggle.addEventListener('click', () => {
            OrgChartState.dotGridVisible = !OrgChartState.dotGridVisible;
            const cvs = document.getElementById('org-chart-canvas');
            if (cvs) {
                cvs.classList.toggle('canvas-dot-pattern', OrgChartState.dotGridVisible);
            }
            // Update button icon
            const icon = dotToggle.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = OrgChartState.dotGridVisible ? 'grid_on' : 'grid_off';
            }
            dotToggle.classList.toggle('text-indigo-400', OrgChartState.dotGridVisible);
            dotToggle.classList.toggle('text-slate-400', !OrgChartState.dotGridVisible);
        });
    }

    // Fit to View (reset pan to origin)
    const fitBtn = document.getElementById('oc-fit-view');
    if (fitBtn) {
        fitBtn.addEventListener('click', () => centerTree());
    }

    // Center View
    const centerBtn = document.getElementById('oc-center-view');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => centerTree());
    }

    // Minimap click-to-navigate
    const minimap = document.getElementById('oc-minimap');
    if (minimap) {
        minimap.addEventListener('mousedown', (e) => {
            const hier = document.getElementById('oc-chart-hierarchy');
            const cvs = document.getElementById('org-chart-canvas');
            if (!hier || !cvs) return;

            const mmRect = minimap.getBoundingClientRect();
            const padding = 16;
            const innerW = mmRect.width - padding * 2;
            const innerH = mmRect.height - padding * 2;

            // Click position as fraction of minimap inner area (0..1)
            const fracX = Math.max(0, Math.min(1, (e.clientX - mmRect.left - padding) / innerW));
            const fracY = Math.max(0, Math.min(1, (e.clientY - mmRect.top - padding) / innerH));

            // Map to pan offset
            const hierW = hier.scrollWidth;
            const hierH = hier.scrollHeight;
            const worldPad = 400;
            const worldW = hierW + worldPad * 2;
            const worldH = hierH + worldPad * 2;

            OrgChartState.panX = -(fracX * worldW - worldPad);
            OrgChartState.panY = -(fracY * worldH - worldPad);

            hier.style.transition = 'transform 0.3s ease';
            hier.style.transform = `translate(${OrgChartState.panX}px, ${OrgChartState.panY}px)`;
            setTimeout(() => { hier.style.transition = ''; }, 350);
            updateMinimapViewport();

            e.stopPropagation();
        });
    }
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Dynamically populate department, location, and status filter options
 * from SharedEmployeeStore data. Called on init and whenever data changes.
 */
function populateFilters() {
    const employees = SharedEmployeeStore.getAll();

    // Department colors (accent per department)
    const deptColors = {
        'Engineering': 'indigo',
        'Marketing': 'purple',
        'Operations': 'orange',
        'Leadership': 'indigo',
    };
    const defaultColor = 'indigo';

    // Aggregate departments
    const deptCounts = {};
    employees.forEach(emp => {
        const d = (emp.department || '').trim();
        if (d) deptCounts[d] = (deptCounts[d] || 0) + 1;
    });
    const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

    const deptContainer = document.getElementById('oc-filter-dept');
    if (deptContainer) {
        deptContainer.innerHTML = sortedDepts.map(([dept, count]) => `
            <label class="flex items-center gap-3 cursor-pointer group">
                <input class="oc-dept-cb h-4 w-4 rounded border-slate-600 bg-slate-800 text-${deptColors[dept] || defaultColor}-500 focus:ring-offset-0 focus:ring-0"
                       type="checkbox" value="${dept}" />
                <span class="text-sm text-slate-300 group-hover:text-white">${dept}</span>
                <span class="ml-auto text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">${count}</span>
            </label>
        `).join('');

        // Bind change listeners
        deptContainer.querySelectorAll('.oc-dept-cb').forEach(cb => {
            cb.addEventListener('change', applyFilters);
        });
    }

    // Aggregate locations
    const locCounts = {};
    employees.forEach(emp => {
        const l = (emp.location || '').trim();
        if (l) locCounts[l] = (locCounts[l] || 0) + 1;
    });
    const sortedLocs = Object.entries(locCounts).sort((a, b) => b[1] - a[1]);

    const locContainer = document.getElementById('oc-filter-loc');
    if (locContainer) {
        locContainer.innerHTML = sortedLocs.map(([loc, count]) => `
            <label class="flex items-center gap-3 cursor-pointer group">
                <input class="oc-loc-cb h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-offset-0 focus:ring-0"
                       type="checkbox" value="${loc}" />
                <span class="text-sm text-slate-300 group-hover:text-white">${loc}</span>
                <span class="ml-auto text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">${count}</span>
            </label>
        `).join('');

        // Bind change listeners
        locContainer.querySelectorAll('.oc-loc-cb').forEach(cb => {
            cb.addEventListener('change', applyFilters);
        });
    }

    // Aggregate statuses
    const statusColors = {
        'active': { bg: 'emerald-500/10', border: 'emerald-500/20', text: 'emerald-400' },
        'on-leave': { bg: 'amber-500/10', border: 'amber-500/20', text: 'amber-400' },
        'inactive': { bg: 'red-500/10', border: 'red-500/20', text: 'red-400' },
    };
    const defaultStatus = { bg: 'slate-500/10', border: 'slate-500/20', text: 'slate-400' };

    const statusCounts = {};
    employees.forEach(emp => {
        const s = (emp.status || 'active').trim().toLowerCase();
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const statusContainer = document.getElementById('oc-filter-status');
    if (statusContainer) {
        statusContainer.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
            const c = statusColors[status] || defaultStatus;
            const label = status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return `<button class="oc-status-btn px-2 py-1 rounded-md bg-${c.bg} border border-${c.border} text-${c.text} text-xs font-medium hover:bg-${c.bg.replace('/10', '/20')} transition-colors"
                            data-status="${status}">${label} <span class="opacity-60">${count}</span></button>`;
        }).join('');

        // Bind toggle listeners
        statusContainer.querySelectorAll('.oc-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('oc-status-active');
                if (btn.classList.contains('oc-status-active')) {
                    btn.style.outline = '2px solid currentColor';
                    btn.style.outlineOffset = '1px';
                } else {
                    btn.style.outline = '';
                    btn.style.outlineOffset = '';
                }
                applyFilters();
            });
        });
    }
}

function applyFilters() {
    // Gather checked departments
    const checkedDepts = [];
    document.querySelectorAll('.oc-dept-cb:checked').forEach(cb => {
        checkedDepts.push(cb.value);
    });

    // Gather checked locations
    const checkedLocs = [];
    document.querySelectorAll('.oc-loc-cb:checked').forEach(cb => {
        checkedLocs.push(cb.value);
    });

    // Gather active statuses
    const activeStatuses = [];
    document.querySelectorAll('.oc-status-btn.oc-status-active').forEach(btn => {
        activeStatuses.push(btn.dataset.status);
    });

    const hasFilters = checkedDepts.length > 0 || checkedLocs.length > 0 || activeStatuses.length > 0;

    document.querySelectorAll('.org-card').forEach(card => {
        if (!hasFilters) {
            // No filters → show everything
            card.classList.remove('oc-filtered-out');
            card.style.opacity = '';
            card.style.pointerEvents = '';
            return;
        }

        const empId = card.dataset.employeeId;
        const emp = empId ? SharedEmployeeStore.getById(empId) : null;
        const dept = emp ? (emp.department || '').trim() : '';
        const loc = emp ? (emp.location || '').trim() : '';
        const status = emp ? (emp.status || 'active').trim().toLowerCase() : '';

        let show = true;

        if (checkedDepts.length > 0 && !checkedDepts.includes(dept)) {
            show = false;
        }
        if (checkedLocs.length > 0 && !checkedLocs.includes(loc)) {
            show = false;
        }
        if (activeStatuses.length > 0 && !activeStatuses.includes(status)) {
            show = false;
        }

        if (show) {
            card.classList.remove('oc-filtered-out');
            card.style.opacity = '';
            card.style.pointerEvents = '';
        } else {
            card.classList.add('oc-filtered-out');
            card.style.opacity = '0.15';
            card.style.pointerEvents = 'none';
        }
    });
}

function resetFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('.oc-dept-cb, .oc-loc-cb').forEach(cb => {
        cb.checked = false;
    });

    // Remove active status buttons
    document.querySelectorAll('.oc-status-btn').forEach(btn => {
        btn.classList.remove('oc-status-active');
        btn.style.outline = '';
        btn.style.outlineOffset = '';
    });

    // Clear search
    const searchInput = document.querySelector('.org-chart-search');
    if (searchInput) {
        searchInput.value = '';
        searchEmployees('');
    }

    // Apply
    applyFilters();
}

// ============================================================================
// EDIT MODE
// ============================================================================

function toggleEditMode(enabled) {
    const canvas = document.getElementById('org-chart-canvas');
    if (!canvas) return;

    if (enabled) {
        canvas.classList.add('edit-mode-active');
        console.log('Edit mode enabled');
        enableCardEditing();
    } else {
        canvas.classList.remove('edit-mode-active');
        console.log('Edit mode disabled');
        disableCardEditing();
    }
}

function enableCardEditing() {
    const cards = document.querySelectorAll('.org-card');
    cards.forEach(card => {
        // Add edit controls (remove button)
        addEditControls(card);

        // Make draggable via mouse events (not native HTML5 drag)
        card.style.cursor = 'grab';
        card._ocMouseDown = (e) => ocDragMouseDown(e, card);
        card.addEventListener('mousedown', card._ocMouseDown);
    });

    // Show add buttons
    showAddButtons();
}

function disableCardEditing() {
    const cards = document.querySelectorAll('.org-card');
    cards.forEach(card => {
        // Remove edit controls
        removeEditControls(card);

        // Remove drag listeners
        card.style.cursor = '';
        if (card._ocMouseDown) {
            card.removeEventListener('mousedown', card._ocMouseDown);
            delete card._ocMouseDown;
        }

        // Clean all drag visual classes
        card.classList.remove('oc-drop-target', 'oc-dragging', 'oc-drag-dimmed');
    });

    // Hide add buttons
    hideAddButtons();

    // Cleanup any lingering drag artifacts
    ocDragCleanup();
}

function addEditControls(card) {
    // Check if controls already exist
    if (card.querySelector('.oc-edit-controls')) return;

    // Ensure card can hold absolute-positioned children
    if (!card.classList.contains('relative')) card.classList.add('relative');

    const controls = document.createElement('div');
    controls.className = 'oc-edit-controls';
    controls.innerHTML = `
        <button class="delete-btn p-1 rounded bg-slate-700 hover:bg-red-600 text-white transition-colors" title="Remove from chart">
            <span class="material-symbols-outlined !text-sm">close</span>
        </button>
    `;

    controls.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCard(card);
    });

    card.appendChild(controls);
}

function removeEditControls(card) {
    const controls = card.querySelector('.oc-edit-controls');
    if (controls) {
        controls.remove();
    }
}

// ============================================================================
// CARD OPERATIONS
// ============================================================================

function editCard(card) {
    const employeeId = card.dataset.employeeId;
    console.log('Editing card:', employeeId);

    // Auth guard
    if (typeof AuthStore !== 'undefined' && !AuthStore.can('edit')) {
        if (typeof AuthUI !== 'undefined') AuthUI.openLoginModal();
        return;
    }

    // TODO: Show edit modal
    showEditModal(employeeId);
}

function deleteCard(card) {
    const employeeId = card.dataset.employeeId;
    const employeeName = card.querySelector('.employee-name')?.textContent || 'this employee';

    // Auth guard
    if (typeof AuthStore !== 'undefined' && !AuthStore.can('delete')) {
        if (typeof AuthUI !== 'undefined') AuthUI.openLoginModal();
        return;
    }

    _ocShowDeleteConfirmation(employeeName, () => {
        console.log('Removing card from chart:', employeeId);

        // Log hierarchy change
        if (typeof SharedLogStore !== 'undefined') {
            const parentWrapper = card.closest('.flex.flex-col.items-center')?.parentElement?.closest('.flex.flex-col.items-center');
            const parentCard = parentWrapper?.querySelector(':scope > .org-card');
            const parentName = parentCard?.querySelector('.employee-name')?.textContent || 'Top Level';

            SharedLogStore.add({
                type: 'hierarchy',
                action: 'Removed employee from org chart',
                target: employeeName,
                details: `Previously reporting to: ${parentName}`,
                icon: 'account_tree',
                iconBg: 'bg-red-500'
            });
        }

        // Do NOT delete from shared store — only remove the visual card from the chart

        // Animate removal
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(() => {
            // Remove the card's parent wrapper (the flex-col container)
            const wrapper = card.closest('.flex.flex-col.items-center');
            if (wrapper) {
                wrapper.remove();
            } else {
                card.remove();
            }
            checkEmptyState();
        }, 300);
    });
}

function addNewCard(parentId = null) {
    console.log('Adding new card under parent:', parentId);

    // Auth guard: require login to add employees
    if (typeof AuthStore !== 'undefined' && !AuthStore.can('add')) {
        if (typeof AuthUI !== 'undefined') AuthUI.openLoginModal();
        return;
    }

    // TODO: Show add employee modal
    showAddModal(parentId);
}

let _ocSearchParentId = null;

function showAddModal(parentId) {
    _ocSearchParentId = parentId;

    // Create modal if it doesn't exist in body
    let modal = document.getElementById('oc-employee-search-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'oc-employee-search-modal';
        modal.className = 'hidden fixed inset-0 z-[100] items-center justify-center bg-black/60 backdrop-blur-sm';
        modal.innerHTML = `
        <div class="relative w-full max-w-lg mx-4" style="animation: oc-modal-in 0.25s ease-out;">
            <div class="rounded-2xl shadow-2xl border border-white/10 overflow-hidden" style="background: rgba(15,23,42,0.97); backdrop-filter: blur(20px);">
                <div class="px-6 pt-6 pb-4">
                    <div class="flex items-center justify-between mb-1">
                        <h3 id="oc-search-modal-title" class="text-lg font-bold text-white">Add Employee to Chart</h3>
                        <button id="oc-search-modal-close" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                            <span class="material-symbols-outlined !text-xl">close</span>
                        </button>
                    </div>
                    <p id="oc-search-modal-subtitle" class="text-sm text-slate-400">Search for an employee from the directory</p>
                </div>
                <div class="px-6 pb-3">
                    <div class="relative group">
                        <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors !text-xl">search</span>
                        <input id="oc-search-employee-input"
                            class="w-full h-11 rounded-xl pl-11 pr-4 bg-slate-800/80 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
                            placeholder="Type a name, email, or department..." type="text" autocomplete="off" />
                    </div>
                </div>
                <div id="oc-search-results" class="px-3 pb-3 max-h-80 overflow-y-auto" style="scrollbar-width:thin; scrollbar-color: rgba(100,116,139,0.3) transparent;"></div>
                <div class="px-6 py-4 border-t border-white/5 flex items-center justify-between" style="background: rgba(15,23,42,0.6);">
                    <span id="oc-search-result-count" class="text-xs text-slate-500">0 employees found</span>
                    <button id="oc-search-modal-cancel"
                        class="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors border border-slate-600">
                        Cancel
                    </button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);

        // Add keyframe animation style if not present
        if (!document.getElementById('oc-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'oc-modal-styles';
            style.textContent = `
                @keyframes oc-modal-in {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .oc-emp-result { transition: all 0.15s ease; }
                .oc-emp-result:hover { background: rgba(99,102,241,0.08); }
            `;
            document.head.appendChild(style);
        }
    }

    // Update title & subtitle
    const titleEl = document.getElementById('oc-search-modal-title');
    const subtitleEl = document.getElementById('oc-search-modal-subtitle');
    if (parentId) {
        const parentCard = document.querySelector(`[data-employee-id="${parentId}"]`);
        const parentName = parentCard?.querySelector('.employee-name')?.textContent || 'selected employee';
        if (titleEl) titleEl.textContent = 'Add Subordinate';
        if (subtitleEl) subtitleEl.textContent = `Select an employee to report to ${parentName}`;
    } else {
        if (titleEl) titleEl.textContent = 'Add Employee to Chart';
        if (subtitleEl) subtitleEl.textContent = 'Search for an employee from the directory';
    }

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Clear & focus search
    const input = document.getElementById('oc-search-employee-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }

    // Initial render
    _ocRenderSearchResults('');

    // Bind events (clean up old first)
    _ocBindSearchEvents();
}

function _ocCloseSearchModal() {
    const modal = document.getElementById('oc-employee-search-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    _ocSearchParentId = null;
}

function _ocBindSearchEvents() {
    const input = document.getElementById('oc-search-employee-input');
    const closeBtn = document.getElementById('oc-search-modal-close');
    const cancelBtn = document.getElementById('oc-search-modal-cancel');
    const modal = document.getElementById('oc-employee-search-modal');

    // Remove old listeners by cloning
    if (input && !input._ocBound) {
        input.addEventListener('input', (e) => _ocRenderSearchResults(e.target.value));
        input._ocBound = true;
    }
    if (closeBtn && !closeBtn._ocBound) {
        closeBtn.addEventListener('click', _ocCloseSearchModal);
        closeBtn._ocBound = true;
    }
    if (cancelBtn && !cancelBtn._ocBound) {
        cancelBtn.addEventListener('click', _ocCloseSearchModal);
        cancelBtn._ocBound = true;
    }
    // Click backdrop to close
    if (modal && !modal._ocBound) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) _ocCloseSearchModal();
        });
        modal._ocBound = true;
    }
}

function _ocShowDeleteConfirmation(employeeName, onConfirm) {
    // Create confirmation modal if it doesn't exist
    let modal = document.getElementById('oc-delete-confirm-modal');
    if (modal) modal.remove(); // Always recreate to bind new callback cleanly

    modal = document.createElement('div');
    modal.id = 'oc-delete-confirm-modal';
    modal.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4';
    modal.innerHTML = `
    <div class="relative w-full max-w-sm" style="animation: oc-modal-in 0.25s ease-out;">
        <div class="rounded-2xl shadow-2xl border border-white/10 overflow-hidden" style="background: rgba(15,23,42,0.98); backdrop-filter: blur(20px);">
            <div class="p-6 text-center">
                <div class="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                    <span class="material-symbols-outlined text-red-400 !text-3xl">person_remove</span>
                </div>
                <h3 class="text-lg font-bold text-white mb-2">Remove from Chart?</h3>
                <p class="text-sm text-slate-400 leading-relaxed mb-6">
                    Are you sure you want to remove <span class="text-white font-semibold">${employeeName}</span> from the organization chart?
                    <br><span class="text-xs mt-2 inline-block text-slate-500 italic">They will remain in the Employee Directory.</span>
                </p>
                <div class="flex gap-3">
                    <button id="oc-delete-cancel" class="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300 transition-all border border-slate-700">
                        Cancel
                    </button>
                    <button id="oc-delete-confirm" class="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all">
                        Remove
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.appendChild(modal);

    const closeHandler = () => {
        modal.style.transition = 'opacity 0.2s, transform 0.2s';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        setTimeout(() => modal.remove(), 200);
    };

    document.getElementById('oc-delete-cancel').onclick = closeHandler;
    document.getElementById('oc-delete-confirm').onclick = () => {
        onConfirm();
        closeHandler();
    };

    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) closeHandler();
    };
}

function _ocRenderSearchResults(query) {
    const container = document.getElementById('oc-search-results');
    const countEl = document.getElementById('oc-search-result-count');
    if (!container) return;

    const allEmployees = SharedEmployeeStore.getAll();

    // Find IDs already on the chart (for badge display, not exclusion)
    const chartCards = document.querySelectorAll('#oc-chart-hierarchy .org-card[data-employee-id]');
    const onChartIds = new Set();
    chartCards.forEach(card => onChartIds.add(card.dataset.employeeId));

    // Filter by query only (don't exclude on-chart employees)
    const q = (query || '').toLowerCase().trim();
    const filtered = allEmployees.filter(emp => {
        if (emp.status === 'inactive') return false;   // never show inactive in add-to-chart
        if (onChartIds.has(emp.id)) return false; // already on chart — hide from results
        if (!q) return true;
        return (emp.name || '').toLowerCase().includes(q) ||
            (emp.email || '').toLowerCase().includes(q) ||
            (emp.department || '').toLowerCase().includes(q) ||
            (emp.phone || '').toLowerCase().includes(q);
    });

    if (countEl) {
        countEl.textContent = `${filtered.length} employee${filtered.length !== 1 ? 's' : ''} found`;
    }

    if (filtered.length === 0 && allEmployees.length === 0) {
        container.innerHTML = `
        <div class="flex flex-col items-center py-10 text-center">
            <span class="material-symbols-outlined text-slate-600 mb-3" style="font-size:40px">person_off</span>
            <p class="text-sm text-slate-400 mb-1">No employees in directory</p>
            <p class="text-xs text-slate-500 mb-4">Add employees via the Employee Directory first</p>
        </div>`;
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
        <div class="flex flex-col items-center py-10 text-center">
            <span class="material-symbols-outlined text-slate-600 mb-3" style="font-size:40px">search_off</span>
            <p class="text-sm text-slate-400 mb-1">No matching employees</p>
            <p class="text-xs text-slate-500">Try a different search term, or all employees may already be on the chart</p>
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(emp => {
        const avatar = emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=6366f1&color=fff&bold=true&size=64`;
        const dept = emp.department || 'No Department';
        const statusDot = emp.status === 'active'
            ? 'bg-emerald-500'
            : emp.status === 'on-leave' ? 'bg-amber-500' : 'bg-gray-500';
        const isOnChart = onChartIds.has(emp.id);
        const onChartBadge = isOnChart ? `<span class="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20 ml-1">On chart</span>` : '';

        return `
        <button class="oc-emp-result w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-transparent cursor-pointer text-left"
            data-emp-id="${emp.id}">
            <div class="relative flex-shrink-0">
                <div class="h-10 w-10 rounded-full bg-center bg-no-repeat bg-cover ring-1 ring-white/10"
                    style="background-image: url('${avatar}')"></div>
                <div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${statusDot} border-2 border-slate-800"></div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-white truncate">${emp.name}</p>
                <p class="text-xs text-slate-400 truncate">${emp.email || 'No email'}</p>
            </div>
            <div class="flex-shrink-0 flex items-center gap-1">
                <span class="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">${dept}</span>${onChartBadge}
            </div>
        </button>`;
    }).join('');

    // Bind click handlers
    container.querySelectorAll('.oc-emp-result').forEach(btn => {
        btn.addEventListener('click', () => {
            const empId = btn.dataset.empId;
            const emp = allEmployees.find(e => e.id === empId);
            if (emp) _ocSelectEmployee(emp);
        });
    });
}

function _ocSelectEmployee(emp) {
    const parentId = _ocSearchParentId;
    _ocCloseSearchModal();

    // Generate card in the DOM
    const hierarchy = document.getElementById('oc-chart-hierarchy');
    if (!hierarchy) return;

    // Remove empty state if present
    const emptyState = hierarchy.querySelector('.oc-empty-state');
    if (emptyState) emptyState.remove();

    const cardElement = createOrgCard(emp);
    const cardHTML = cardElement.outerHTML;


    if (parentId) {
        // Find parent card and its children
        const parentCard = document.querySelector(`.org-card[data-employee-id="${parentId}"]`);
        if (parentCard) {
            const parentWrapper = parentCard.closest('.flex.flex-col.items-center');
            let childrenContainer = parentWrapper.querySelector('.relative.flex.justify-center');

            if (!childrenContainer) {
                // Add vertical connector line from parent down
                const connector = document.createElement('div');
                connector.className = 'org-line-v h-16';
                parentWrapper.appendChild(connector);

                // Add children row
                childrenContainer = document.createElement('div');
                childrenContainer.className = 'relative flex justify-center gap-12 pt-0';
                parentWrapper.appendChild(childrenContainer);
            }

            // Create wrapper for the new child with its own vertical line above it
            const childWrapper = document.createElement('div');
            childWrapper.className = 'relative flex flex-col items-center pt-8';
            childWrapper.innerHTML = `<div class="absolute top-0 h-8 org-line-v"></div>${cardHTML}`;
            childrenContainer.appendChild(childWrapper);

            // Update horizontal connector to span across siblings
            updateHorizontalConnector(childrenContainer);

            // Log hierarchy change
            if (typeof SharedLogStore !== 'undefined') {
                const parentEmp = SharedEmployeeStore.getById(parentId);
                SharedLogStore.add({
                    type: 'hierarchy',
                    action: `Added ${emp.name} to hierarchy under`,
                    target: parentEmp ? parentEmp.name : 'Unknown',
                    details: `New reporting line established in ${emp.department || 'General'}`,
                    icon: 'account_tree',
                    iconBg: 'bg-indigo-500'
                });
            }
        }
    } else {
        // Top-level / CEO replacement (simple replacement for demo)
        hierarchy.innerHTML = cardHTML;

        // Log the event
        if (typeof SharedLogStore !== 'undefined') {
            SharedLogStore.add({
                type: 'hierarchy',
                action: 'Set new organization head',
                target: emp.name,
                icon: 'hub',
                iconBg: 'bg-purple-600'
            });
        }
    }

    checkEmptyState();
    if (OrgChartState.editMode) {
        showAddButtons();
    }
}

function showEditModal(employeeId) {
    const employee = SharedEmployeeStore.getById(employeeId);
    if (!employee) return;

    // Placeholder - will be implemented with a proper modal
    const name = prompt('Edit employee name:', employee.name);
    const title = prompt('Edit job title:', employee.title);

    // Build update data
    const updates = {};
    if (name && name !== employee.name) updates.name = name;
    if (title && title !== employee.title) updates.title = title;

    if (Object.keys(updates).length > 0) {
        // Update through shared store (Employee Directory will auto-sync)
        SharedEmployeeStore.update(employeeId, updates);

        // Update the DOM card directly
        const card = document.querySelector(`.org-card[data-employee-id="${employeeId}"]`);
        if (card) {
            const nameEl = card.querySelector('.employee-name');
            const titleEl = card.querySelector('.employee-title');
            if (nameEl && updates.name) nameEl.textContent = updates.name;
            if (titleEl && updates.title) titleEl.textContent = updates.title;
        }
        showToast(`${updates.name || employee.name} updated`, 'success');
    }
}

// ============================================================================
// MINIMAP VIEWPORT SYNC
// ============================================================================

/**
 * Update the minimap viewport indicator to reflect the current visible
 * portion of the canvas based on transform-based panning.
 */
function updateMinimapViewport() {
    const canvas = document.getElementById('org-chart-canvas');
    const hierarchy = document.getElementById('oc-chart-hierarchy');
    const viewport = document.getElementById('oc-minimap-viewport');
    const minimapEl = document.getElementById('oc-minimap');
    if (!canvas || !hierarchy || !viewport || !minimapEl) return;

    const mmPadding = 16; // p-4 = 16px each side
    const mmRect = minimapEl.getBoundingClientRect();
    const mmInnerW = mmRect.width - mmPadding * 2;
    const mmInnerH = mmRect.height - mmPadding * 2;

    // Natural content size of the chart hierarchy
    const contentW = hierarchy.scrollWidth;
    const contentH = hierarchy.scrollHeight;
    const canvasW = canvas.clientWidth;
    const canvasH = canvas.clientHeight;

    // Define a virtual world that encompasses the content + generous buffer
    const worldPad = 400;
    const worldW = contentW + worldPad * 2;
    const worldH = contentH + worldPad * 2;

    if (worldW <= 0 || worldH <= 0) return;

    // Viewport size as fraction of the virtual world
    const vpFracW = Math.min(1, canvasW / worldW);
    const vpFracH = Math.min(1, canvasH / worldH);

    // Viewport position: pan offset maps the chart position
    // When panX=0, viewport is at worldPad (centered at rest position)
    // Moving panX positive = chart moves right = viewport moves left in world
    const vpCenterX = worldPad - OrgChartState.panX;
    const vpCenterY = worldPad - OrgChartState.panY;
    const vpFracX = vpCenterX / worldW;
    const vpFracY = vpCenterY / worldH;

    // Viewport rectangle on the minimap
    const vpW = Math.max(12, vpFracW * mmInnerW);
    const vpH = Math.max(8, vpFracH * mmInnerH);
    const vpX = mmPadding + Math.max(0, Math.min(mmInnerW - vpW, vpFracX * mmInnerW));
    const vpY = mmPadding + Math.max(0, Math.min(mmInnerH - vpH, vpFracY * mmInnerH));

    viewport.style.width = vpW + 'px';
    viewport.style.height = vpH + 'px';
    viewport.style.left = vpX + 'px';
    viewport.style.top = vpY + 'px';
}

// ============================================================================
// DRAG AND DROP (Custom Mouse-Based)
// ============================================================================

let _ocDrag = {
    active: false,
    sourceCard: null,
    clone: null,
    svgOverlay: null,
    ghostEl: null,
    currentTarget: null,
    originRect: null,
    offsetX: 0,
    offsetY: 0,
};

function ocDragMouseDown(e, card) {
    // Ignore if clicking on a button/control inside the card
    if (e.target.closest('button') || e.target.closest('.oc-edit-controls')) return;
    // Only left mouse button
    if (e.button !== 0) return;

    e.preventDefault();

    // Clear any existing text selection and prevent new selection during drag
    window.getSelection()?.removeAllRanges();
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    const rect = card.getBoundingClientRect();
    _ocDrag.sourceCard = card;
    _ocDrag.originRect = rect;
    _ocDrag.offsetX = e.clientX - rect.left;
    _ocDrag.offsetY = e.clientY - rect.top;

    // Create the floating clone
    const clone = card.cloneNode(true);
    clone.className = 'oc-drag-clone';
    clone.style.width = rect.width + 'px';
    clone.style.left = (e.clientX - _ocDrag.offsetX) + 'px';
    clone.style.top = (e.clientY - _ocDrag.offsetY) + 'px';

    // Remove any edit controls from clone
    const cloneControls = clone.querySelector('.oc-edit-controls');
    if (cloneControls) cloneControls.remove();

    // Add drag grip indicator
    const grip = document.createElement('div');
    grip.className = 'absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-40';
    grip.innerHTML = '<div class="w-1 h-1 bg-white rounded-full"></div><div class="w-1 h-1 bg-white rounded-full"></div><div class="w-1 h-1 bg-white rounded-full"></div>';
    clone.appendChild(grip);

    // Add "Moving from DEPT" badge
    const dept = card.dataset.department || '';
    if (dept) {
        const badge = document.createElement('div');
        badge.className = 'absolute bottom-2 left-1/2 -translate-x-1/2';
        badge.innerHTML = `<span class="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded whitespace-nowrap">Moving from ${dept.toUpperCase()}</span>`;
        clone.appendChild(badge);
    }

    document.body.appendChild(clone);

    // Create SVG overlay for the connector line
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fixed inset-0 w-full h-full pointer-events-none');
    svg.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9998; pointer-events: none;';

    // Shadow line
    const shadowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shadowPath.setAttribute('fill', 'none');
    shadowPath.setAttribute('stroke', 'rgba(0,0,0,0.4)');
    shadowPath.setAttribute('stroke-width', '4');
    shadowPath.id = 'oc-drag-shadow';

    // Main dashed line
    const mainPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    mainPath.setAttribute('fill', 'none');
    mainPath.setAttribute('stroke', '#137fec');
    mainPath.setAttribute('stroke-width', '2');
    mainPath.setAttribute('stroke-dasharray', '6,4');
    mainPath.setAttribute('class', 'oc-dash-animate');
    mainPath.id = 'oc-drag-line';

    // Origin dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', '#137fec');
    dot.id = 'oc-drag-dot';

    svg.appendChild(shadowPath);
    svg.appendChild(mainPath);
    svg.appendChild(dot);
    document.body.appendChild(svg);
    _ocDrag.svgOverlay = svg;

    // Mark source card as dragging
    card.classList.add('oc-dragging');

    // Dim all other cards
    document.querySelectorAll('.org-card').forEach(c => {
        if (c !== card) c.classList.add('oc-drag-dimmed');
    });

    _ocDrag.active = true;

    // Bind mousemove/mouseup on document
    document.addEventListener('mousemove', ocDragMouseMove);
    document.addEventListener('mouseup', ocDragMouseUp);
}

function ocDragMouseMove(e) {
    if (!_ocDrag.active) return;

    // Move clone
    const clone = document.querySelector('.oc-drag-clone');
    if (clone) {
        clone.style.left = (e.clientX - _ocDrag.offsetX) + 'px';
        clone.style.top = (e.clientY - _ocDrag.offsetY) + 'px';
    }

    // Update SVG connector: from the center-bottom of the original card to the center-top of the clone
    const or = _ocDrag.originRect;
    const sx = or.left + or.width / 2;
    const sy = or.top + or.height;
    const ex = e.clientX;
    const ey = e.clientY - 10;

    // Quadratic bezier
    const midY = sy + (ey - sy) * 0.5;
    const d = `M ${sx} ${sy} Q ${sx} ${midY}, ${ex} ${ey}`;

    const shadowPath = document.getElementById('oc-drag-shadow');
    const mainPath = document.getElementById('oc-drag-line');
    const dot = document.getElementById('oc-drag-dot');
    if (shadowPath) shadowPath.setAttribute('d', d);
    if (mainPath) mainPath.setAttribute('d', d);
    if (dot) {
        dot.setAttribute('cx', sx);
        dot.setAttribute('cy', sy);
    }

    // Hit-test: find which org-card the cursor is over
    const allCards = document.querySelectorAll('.org-card');
    let hoveredTarget = null;

    allCards.forEach(c => {
        if (c === _ocDrag.sourceCard) return;
        const r = c.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            hoveredTarget = c;
        }
    });

    // Update drop target visuals
    if (hoveredTarget !== _ocDrag.currentTarget) {
        // Remove previous
        if (_ocDrag.currentTarget) {
            _ocDrag.currentTarget.classList.remove('oc-drop-target');
            _ocDrag.currentTarget.classList.add('oc-drag-dimmed');
        }
        removeGhostDropZone();

        // Apply to new target
        if (hoveredTarget) {
            hoveredTarget.classList.remove('oc-drag-dimmed');
            hoveredTarget.classList.add('oc-drop-target');
            showGhostDropZone(hoveredTarget);
        }
        _ocDrag.currentTarget = hoveredTarget;
    }
}

function ocDragMouseUp(e) {
    if (!_ocDrag.active) return;

    document.removeEventListener('mousemove', ocDragMouseMove);
    document.removeEventListener('mouseup', ocDragMouseUp);

    if (_ocDrag.currentTarget && _ocDrag.sourceCard) {
        performCardAssign(_ocDrag.sourceCard, _ocDrag.currentTarget);
    }

    ocDragCleanup();
}

function ocDragCleanup() {
    // Remove clone
    const clone = document.querySelector('.oc-drag-clone');
    if (clone) clone.remove();

    // Remove SVG
    if (_ocDrag.svgOverlay) {
        _ocDrag.svgOverlay.remove();
        _ocDrag.svgOverlay = null;
    }

    // Remove ghost
    removeGhostDropZone();

    // Restore all cards
    document.querySelectorAll('.org-card').forEach(c => {
        c.classList.remove('oc-dragging', 'oc-drag-dimmed', 'oc-drop-target');
    });

    // Restore text selection ability
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    window.getSelection()?.removeAllRanges();

    _ocDrag.active = false;
    _ocDrag.sourceCard = null;
    _ocDrag.currentTarget = null;
    _ocDrag.originRect = null;
}

function showGhostDropZone(targetCard) {
    removeGhostDropZone();

    const name = targetCard.querySelector('.employee-name')?.textContent?.trim() || 'this manager';

    const ghost = document.createElement('div');
    ghost.className = 'oc-drop-ghost';
    ghost.innerHTML = `
        <p>Drop to assign to ${name}</p>
        <div class="oc-ghost-plus">
            <span class="material-symbols-outlined">add</span>
        </div>
    `;

    // Insert the ghost after the target card inside its wrapper
    const wrapper = targetCard.closest('.flex.flex-col.items-center');
    if (wrapper) {
        wrapper.appendChild(ghost);
    } else {
        targetCard.parentNode.insertBefore(ghost, targetCard.nextSibling);
    }
    _ocDrag.ghostEl = ghost;
}

function removeGhostDropZone() {
    if (_ocDrag.ghostEl) {
        _ocDrag.ghostEl.remove();
        _ocDrag.ghostEl = null;
    }
    // Also cleanup any stale ghosts
    document.querySelectorAll('.oc-drop-ghost').forEach(g => g.remove());
}

function performCardAssign(sourceCard, targetCard) {
    const draggedId = sourceCard.dataset.employeeId;
    const targetId = targetCard.dataset.employeeId;

    if (draggedId === targetId) return;

    const sourceName = sourceCard.querySelector('.employee-name')?.textContent?.trim() || draggedId;
    const targetName = targetCard.querySelector('.employee-name')?.textContent?.trim() || targetId;

    console.log(`Assigning ${sourceName} (${draggedId}) under ${targetName} (${targetId})`);

    // 1. Find the source card's wrapper (the .flex.flex-col.items-center ancestor)
    const sourceWrapper = sourceCard.closest('.flex.flex-col.items-center');
    if (!sourceWrapper) {
        console.warn('Cannot find source wrapper');
        return;
    }

    // 2. Prevent dropping onto a descendant (would create a cycle)
    if (sourceWrapper.contains(targetCard)) {
        showToast('Cannot assign a manager under their own report', 'error');
        return;
    }

    // 3. Record the source's old parent children container
    const oldChildrenContainer = sourceWrapper.parentElement;

    // 4. Find the target card's wrapper
    const targetWrapper = targetCard.closest('.flex.flex-col.items-center');
    if (!targetWrapper) {
        console.warn('Cannot find target wrapper');
        return;
    }

    // 5. Find the children container for the target card.
    //    It can be in TWO places depending on DOM structure:
    //    a) Inside the targetWrapper (standard for VP+ level)
    //    b) As the next sibling of targetWrapper (CEO level, where the VP
    //       container is a sibling in the parent flex-col, not nested inside)
    let targetChildrenContainer = findChildrenContainer(targetWrapper);

    // 6. Detach the source wrapper from its old position
    sourceWrapper.remove();

    // 7. If no children container exists, create one INSIDE the targetWrapper
    if (!targetChildrenContainer) {
        // Add vertical connector line from target card down to children
        const vLine = document.createElement('div');
        vLine.className = 'org-line-v';
        vLine.style.height = '48px';
        targetWrapper.appendChild(vLine);

        // Create the children flex container
        targetChildrenContainer = document.createElement('div');
        targetChildrenContainer.className = 'relative flex justify-center gap-8';
        targetWrapper.appendChild(targetChildrenContainer);
    }

    // 8. Make sure the source wrapper has a vertical connector line at the top
    const firstChild = sourceWrapper.firstElementChild;
    if (!firstChild || !firstChild.classList.contains('org-line-v')) {
        const vLineUp = document.createElement('div');
        vLineUp.className = 'org-line-v';
        vLineUp.style.height = '32px';
        sourceWrapper.insertBefore(vLineUp, sourceWrapper.firstChild);
    }

    // 9. Append the source wrapper into the target's children container
    targetChildrenContainer.appendChild(sourceWrapper);

    // 10. Update the horizontal connector line in the target children container
    updateHorizontalConnector(targetChildrenContainer);

    // 11. Clean up the old parent container if it is now empty or orphaned
    cleanupOldContainer(oldChildrenContainer);

    // 12. Re-attach mouse event listeners on the moved card (since DOM was re-inserted)
    sourceCard.style.cursor = 'grab';
    if (sourceCard._ocMouseDown) {
        sourceCard.removeEventListener('mousedown', sourceCard._ocMouseDown);
    }
    sourceCard._ocMouseDown = (e) => ocDragMouseDown(e, sourceCard);
    sourceCard.addEventListener('mousedown', sourceCard._ocMouseDown);

    // Also re-attach listeners for any sub-cards that moved with the source
    sourceWrapper.querySelectorAll('.org-card').forEach(subCard => {
        if (subCard === sourceCard) return; // already handled
        subCard.style.cursor = 'grab';
        if (subCard._ocMouseDown) {
            subCard.removeEventListener('mousedown', subCard._ocMouseDown);
        }
        subCard._ocMouseDown = (e) => ocDragMouseDown(e, subCard);
        subCard.addEventListener('mousedown', subCard._ocMouseDown);
    });

    // 13. Flash the reassigned card
    sourceCard.classList.add('oc-swap-flash');
    setTimeout(() => sourceCard.classList.remove('oc-swap-flash'), 600);

    showToast(`${sourceName} assigned under ${targetName}`, 'success');

    // 14. Log hierarchy update
    if (typeof SharedLogStore !== 'undefined') {
        const oldParentCard = oldChildrenContainer?.closest('.flex.flex-col.items-center')?.querySelector(':scope > .org-card');
        const oldParentName = oldParentCard?.querySelector('.employee-name')?.textContent || 'Top Level';

        SharedLogStore.add({
            type: 'hierarchy',
            action: `Reassigned ${sourceName} to report to`,
            target: targetName,
            details: `Previously reporting to: ${oldParentName}`,
            icon: 'published_with_changes',
            iconBg: 'bg-blue-500'
        });
    }
}

/**
 * Find the children container for a given card wrapper.
 * Searches in two locations:
 *   a) Inside the wrapper itself (standard case for VP/Director level)
 *   b) As the next sibling of the wrapper (CEO level, where the overall
 *      tree container has CEO wrapper + VP container as siblings)
 */
function findChildrenContainer(wrapper) {
    // a) Look inside the wrapper
    for (const child of wrapper.children) {
        if (child.classList.contains('flex') &&
            child.classList.contains('justify-center') &&
            !child.classList.contains('org-card')) {
            return child;
        }
    }

    // b) Check next sibling (CEO-level structure)
    const nextSib = wrapper.nextElementSibling;
    if (nextSib &&
        nextSib.classList.contains('flex') &&
        nextSib.classList.contains('justify-center')) {
        return nextSib;
    }

    return null;
}

/**
 * Update or create the horizontal connector line that spans across all children
 * in a children container (.relative.flex.justify-center).
 */
function updateHorizontalConnector(container) {
    // Find child wrappers (the .flex.flex-col.items-center elements)
    const childWrappers = Array.from(container.children).filter(
        el => el.classList.contains('flex') && el.classList.contains('items-center') && el.classList.contains('flex-col')
    );

    // Remove existing horizontal connector
    const existingH = container.querySelector(':scope > .org-line-h');
    if (existingH) existingH.remove();

    // If there is only one child, no horizontal connector is needed
    if (childWrappers.length <= 1) return;

    // Create horizontal connector spanning from first child center to last child center
    const hLine = document.createElement('div');
    hLine.className = 'org-line-h';
    hLine.style.position = 'absolute';
    hLine.style.top = '0';

    // Calculate positions using the children widths
    const firstW = childWrappers[0].offsetWidth;
    const lastW = childWrappers[childWrappers.length - 1].offsetWidth;
    hLine.style.left = (firstW / 2) + 'px';
    hLine.style.right = (lastW / 2) + 'px';

    container.insertBefore(hLine, container.firstChild);
}

/**
 * Clean up an old children container after a card has been moved out of it.
 * Removes empty containers and orphaned connector lines.
 */
function cleanupOldContainer(container) {
    if (!container) return;

    // Count remaining card wrappers (children that contain org-cards)
    const remainingWrappers = Array.from(container.children).filter(
        el => el.classList.contains('flex') && el.classList.contains('items-center') && el.querySelector('.org-card')
    );

    if (remainingWrappers.length === 0) {
        // Container is empty — remove it and its preceding vertical connector line
        const parent = container.parentElement;
        const prevSibling = container.previousElementSibling;

        container.remove();

        // Remove the vertical connector line that connected the parent card to this container
        if (prevSibling && prevSibling.classList.contains('org-line-v')) {
            prevSibling.remove();
        }
    } else {
        // Update horizontal connector for remaining children
        updateHorizontalConnector(container);
    }
}

// ============================================================================
// ADD BUTTONS
// ============================================================================

function showAddButtons() {
    const cards = document.querySelectorAll('.org-card');
    cards.forEach(card => {
        if (!card.querySelector('.add-subordinate-btn')) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-subordinate-btn absolute -bottom-8 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg transition-all z-10';
            addBtn.innerHTML = '<span class="material-symbols-outlined !text-sm">add</span>';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addNewCard(card.dataset.employeeId);
            });
            card.appendChild(addBtn);
        }
    });
}

function hideAddButtons() {
    document.querySelectorAll('.add-subordinate-btn').forEach(btn => btn.remove());
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadEmployeeData() {
    // Data now lives in SharedEmployeeStore — nothing to do here
    console.log('Employee data loaded from SharedEmployeeStore:', SharedEmployeeStore.getAll().length, 'employees');
}

// ============================================================================
// RENDERING
// ============================================================================

function renderOrgChart() {
    const emps = SharedEmployeeStore.getAll();
    console.log('Rendering org chart with', emps.length, 'employees');
    checkEmptyState();
}

function checkEmptyState() {
    const hierarchy = document.getElementById('oc-chart-hierarchy');
    if (!hierarchy) return;

    const cards = hierarchy.querySelectorAll('.org-card');
    const existingEmpty = hierarchy.querySelector('.oc-empty-state');

    if (cards.length === 0 && !existingEmpty) {
        hierarchy.innerHTML = `
        <div class="oc-empty-state flex flex-col items-center justify-center py-20 px-8 text-center">
            <div class="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-6">
                <span class="material-symbols-outlined text-indigo-400" style="font-size:48px">account_tree</span>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">No employees on the chart</h3>
            <p class="text-sm text-slate-400 mb-8 max-w-sm">Get started by adding your first employee. You can build your org hierarchy from here.</p>
            <button id="oc-add-first-employee"
                class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:brightness-110 transition-all">
                <span class="material-symbols-outlined !text-lg">person_add</span>
                Add First Employee
            </button>
        </div>`;

        document.getElementById('oc-add-first-employee')?.addEventListener('click', () => {
            addNewCard(null);
        });
    } else if (cards.length > 0 && existingEmpty) {
        existingEmpty.remove();
    }
}

// ============================================================================
// SEARCH
// ============================================================================

function searchEmployees(query) {
    if (!query) {
        // Reset highlighting — but keep inactive nodes greyed
        document.querySelectorAll('.org-card').forEach(card => {
            const empId = card.dataset.employeeId;
            const emp = empId ? SharedEmployeeStore.getById(empId) : null;
            if (emp?.status === 'inactive') return; // never change opacity of inactive nodes
            card.classList.remove('oc-highlight');
            card.style.opacity = '';
        });
        OrgChartState.filterSearch = '';
        return;
    }

    OrgChartState.filterSearch = query;
    const lowerQuery = query.toLowerCase();
    let firstMatch = null;

    document.querySelectorAll('.org-card').forEach(card => {
        const empId = card.dataset.employeeId;
        const emp = empId ? SharedEmployeeStore.getById(empId) : null;
        // Inactive nodes stay at 0.35 — never participate in search highlighting
        if (emp?.status === 'inactive') return;

        const name = card.querySelector('.employee-name')?.textContent.toLowerCase() || '';
        const title = card.querySelector('.employee-title')?.textContent.toLowerCase() || '';

        if (name.includes(lowerQuery) || title.includes(lowerQuery)) {
            card.classList.add('oc-highlight');
            card.style.opacity = '';
            if (!firstMatch) firstMatch = card;
        } else {
            card.classList.remove('oc-highlight');
            card.style.opacity = '0.25';
        }
    });

    // Scroll to the first match
    if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'success') {
    // Reuse the EmployeeDirectory toast if available, otherwise create a simple one
    let container = document.getElementById('oc-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'oc-toast-container';
        container.style.cssText = 'position:fixed; top:24px; right:24px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981';
    toast.style.cssText = `background:${bg}; color:white; padding:12px 20px; border-radius:10px; font-size:14px; font-weight:500; box-shadow:0 8px 24px rgba(0, 0, 0, 0.3); pointer-events:auto; opacity:0; transform:translateY(-10px); transition:all 0.3s;`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// EXPORT & SHARE
// ============================================================================

function exportOrgChartPDF() {
    console.log('Exporting org chart to PDF...');
    // TODO: Implement PDF export using a library like jsPDF or html2canvas
    alert('PDF export feature coming soon!');
}

function shareOrgChart() {
    console.log('Sharing org chart...');
    // TODO: Implement share functionality
    alert('Share feature coming soon!');
}

// ============================================================================
// FIREBASE INTEGRATION (Placeholder)
// ============================================================================

async function loadEmployeesFromFirebase() {
    // TODO: Load from Firebase
    console.log('Loading employees from Firebase...');
}

async function saveEmployeeToFirebase(employee) {
    // TODO: Save to Firebase
    console.log('Saving employee to Firebase:', employee);
}

async function deleteEmployeeFromFirebase(employeeId) {
    // TODO: Delete from Firebase
    console.log('Deleting employee from Firebase:', employeeId);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Creates a unified, premium card element for an employee.
 * Ensures consistent design across all levels (CEO, VP, Director, etc.)
 */
function createOrgCard(emp, level = 'individual') {
    const card = document.createElement('div');

    // Determine level-specific styles
    let shadowClass = 'shadow-lg';
    let borderColor = 'border-white/5';
    let iconColor = 'text-indigo-400';
    let levelBadge = (emp.department || 'General').toUpperCase();
    let statsLabel = 'Directs';

    if (level === 'ceo' || emp.role === 'CEO' || emp.title?.includes('Chief')) {
        shadowClass = 'shadow-2xl';
        borderColor = 'border-t-indigo-500';
        iconColor = 'text-indigo-400';
        levelBadge = 'LEADERSHIP';
        statsLabel = 'Total';
    } else if (emp.title?.includes('VP')) {
        const deptUpper = (emp.department || '').toUpperCase();
        if (deptUpper.includes('ENG')) {
            shadowClass = 'shadow-neon-cyan';
            borderColor = 'border-neon-cyan/50';
            iconColor = 'text-neon-cyan';
        } else if (deptUpper.includes('MARKET')) {
            shadowClass = 'shadow-neon-purple';
            borderColor = 'border-neon-purple/50';
            iconColor = 'text-neon-purple';
        } else {
            shadowClass = 'shadow-neon-orange';
            borderColor = 'border-neon-orange/50';
            iconColor = 'text-neon-orange';
        }
    } else if (emp.title?.includes('Director')) {
        const deptUpper = (emp.department || '').toUpperCase();
        if (deptUpper.includes('ENG')) {
            shadowClass = 'shadow-neon-blue';
            borderColor = 'border-l-neon-blue';
        } else {
            shadowClass = 'shadow-neon-emerald';
            borderColor = 'border-l-neon-emerald';
        }
    }

    card.className = `glass-panel org-card group relative rounded-2xl p-5 ${shadowClass} border border-white/5 ${borderColor} ring-1 ring-white/5 w-80 backdrop-blur-xl transition-all duration-300`;
    card.dataset.employeeId = emp.id;
    card.dataset.department = emp.department || '';

    const profileImg = emp.name ? emp.name.toLowerCase().replace(/\s+/g, '-') + '-bg' : 'default-avatar-bg';

    // Status badge — shown only when the Status Badge setting is enabled
    const isInactive = emp.status === 'inactive';
    const statusBadgeColor = isInactive
        ? 'bg-gray-500/20 text-gray-400 ring-gray-500/30'
        : 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30';
    const statusLabel = isInactive ? 'Inactive' : 'Active';
    const statusDotColor = isInactive ? 'bg-gray-400' : 'bg-emerald-500';
    const showStatusBadge = typeof AppSettings !== 'undefined' && AppSettings.get().ocFields?.status;

    card.innerHTML = `
        <div class="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        <div class="relative z-10 flex items-center gap-4">
            <div class="relative">
                <div class="h-16 w-16 rounded-2xl bg-center bg-no-repeat bg-cover shadow-lg ring-2 ring-white/10 ${profileImg}"></div>
                <div class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-slate-800"></div>
            </div>
            <div class="flex-1 overflow-hidden">
                <div class="mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border border-white/10 ${iconColor} bg-white/5">
                    <div class="w-1 h-1 rounded-full bg-current"></div> ${levelBadge}
                </div>
                <p class="truncate text-lg font-bold text-white employee-name">${emp.name}</p>
                <p class="truncate text-sm text-slate-400 employee-title">${emp.title}</p>
            </div>
        </div>
        <div class="relative z-10 mt-5 flex items-center justify-between border-t border-white/5 pt-4">
            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 border border-white/5">
                    <span class="material-symbols-outlined !text-sm ${iconColor}">supervisor_account</span>
                    <span class="text-xs font-medium text-slate-300">${emp.reportsCount || 0} ${statsLabel}</span>
                </div>
                <span data-oc-field="status" class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusBadgeColor} ${showStatusBadge ? '' : 'hidden'}">
                    <span class="w-1.5 h-1.5 rounded-full ${statusDotColor}"></span>${statusLabel}
                </span>
            </div>
            <button class="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors">
                <span class="material-symbols-outlined !text-xl">expand_circle_down</span>
            </button>
        </div>
        <div class="oc-edit-controls">
            <!-- Populated in edit mode -->
        </div>
    `;

    // Re-attach mouse event listeners
    card.addEventListener('mousedown', (e) => ocDragMouseDown(e, card));

    return card;
}

/**
 * Centers the org chart tree within the canvas.
 * @param {boolean} smooth - Whether to animate the transition.
 */
function centerTree(smooth = true) {
    const hier = document.getElementById('oc-chart-hierarchy');
    const cvs = document.getElementById('org-chart-canvas');
    if (!hier || !cvs) return;

    const cvsW = cvs.clientWidth;
    const cvsH = cvs.clientHeight;
    const hierW = hier.scrollWidth;
    const hierH = hier.scrollHeight;

    // The canvas already has pl-[340px] CSS padding for the sidebar filter panel.
    // The hierarchy's natural position is already 340px from the left.
    // We only need to center within the available content area (cvsW - 340).
    const sidebarPadding = 340;
    const availableW = cvsW - sidebarPadding;

    // panX = 0 means hierarchy is at its natural position (already offset by CSS padding).
    // A positive panX shifts it further right, negative shifts left.
    OrgChartState.panX = Math.max(0, (availableW - hierW) / 2);
    OrgChartState.panY = 40; // Fixed top offset

    if (smooth) {
        hier.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    hier.style.transform = `translate(${OrgChartState.panX}px, ${OrgChartState.panY}px)`;

    if (smooth) {
        setTimeout(() => { hier.style.transition = ''; }, 450);
    }

    updateMinimapViewport();
}

/**
 * Initializes connectors for hardcoded HTML elements by calculating widths.
 */
function initializeConnectors() {
    document.querySelectorAll('.flex.justify-center.gap-16, .flex.justify-center.gap-24, .flex.justify-center.gap-12, .flex.justify-center.gap-8').forEach(container => {
        updateHorizontalConnector(container);
    });
}

// ============================================================================
// SHARE FUNCTIONALITY
// ============================================================================

function shareOrgChart() {
    const modal = document.getElementById('oc-share-modal');
    const urlInput = document.getElementById('oc-share-url');
    if (!modal || !urlInput) return;

    // Set the share URL
    urlInput.value = window.location.href;

    // Show modal
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('oc-modal-visible'));

    // Wire up close handlers (once)
    if (!modal._shareInitialized) {
        modal._shareInitialized = true;

        const closeModal = () => {
            modal.classList.remove('oc-modal-visible');
            setTimeout(() => modal.classList.add('hidden'), 200);
        };

        document.getElementById('oc-share-close').addEventListener('click', closeModal);
        document.getElementById('oc-share-overlay').addEventListener('click', closeModal);

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
        });

        // Copy link button
        document.getElementById('oc-share-copy').addEventListener('click', async () => {
            const icon = document.getElementById('oc-copy-icon');
            const label = document.getElementById('oc-copy-label');
            const btn = document.getElementById('oc-share-copy');
            try {
                await navigator.clipboard.writeText(urlInput.value);
                // Success state
                icon.textContent = 'check_circle';
                label.textContent = 'Copied!';
                btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
                btn.classList.replace('hover:bg-indigo-500', 'hover:bg-emerald-500');
                setTimeout(() => {
                    icon.textContent = 'content_copy';
                    label.textContent = 'Copy Link';
                    btn.classList.replace('bg-emerald-600', 'bg-indigo-600');
                    btn.classList.replace('hover:bg-emerald-500', 'hover:bg-indigo-500');
                }, 2500);
            } catch {
                // Fallback: select the text
                urlInput.select();
                document.execCommand('copy');
            }
        });

        // Native share button
        document.getElementById('oc-share-native').addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Acme Corp — OrgChart Pro',
                        text: 'View the Acme Corp organization chart',
                        url: window.location.href
                    });
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('Share failed:', e);
                }
            } else {
                // Fallback: copy to clipboard
                document.getElementById('oc-share-copy').click();
            }
        });

        // Email button
        document.getElementById('oc-share-email').addEventListener('click', () => {
            const subject = encodeURIComponent('Acme Corp — OrgChart Pro');
            const body = encodeURIComponent(`Check out the Acme Corp organization chart:\n\n${window.location.href}`);
            window.open(`mailto:?subject=${subject}&body=${body}`);
        });
    }
}

// ============================================================================
// EXPORT PDF FUNCTIONALITY
// ============================================================================

async function exportOrgChartPDF() {
    const btn = document.querySelector('[data-action="export-pdf"]');
    const hier = document.getElementById('oc-chart-hierarchy');
    const canvas = document.getElementById('org-chart-canvas');

    if (!hier) return;

    // Check libraries are loaded
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('PDF export libraries are still loading. Please try again in a moment.');
        return;
    }

    // Loading state
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <span class="oc-pdf-spinner"></span>
            <span>Generating…</span>
        `;
    }

    // Save current transform and temporarily reset it so we capture the full chart
    const savedTransform = hier.style.transform;
    const savedTransition = hier.style.transition;
    hier.style.transition = 'none';
    hier.style.transform = 'translate(0px, 0px)';

    // Also temporarily disable overflow:hidden on canvas so html2canvas can see everything
    const savedOverflow = canvas ? canvas.style.overflow : '';
    if (canvas) canvas.style.overflow = 'visible';

    try {
        // Small delay to let the DOM repaint
        await new Promise(r => setTimeout(r, 80));

        const captureCanvas = await html2canvas(hier, {
            scale: 2,
            backgroundColor: '#0f1115',
            useCORS: true,
            allowTaint: true,
            logging: false,
            removeContainer: true
        });

        // Restore transform and overflow
        hier.style.transform = savedTransform;
        hier.style.transition = savedTransition;
        if (canvas) canvas.style.overflow = savedOverflow;

        const { jsPDF } = window.jspdf;
        const imgData = captureCanvas.toDataURL('image/png');

        // Determine orientation based on chart dimensions
        const chartW = captureCanvas.width / 2; // account for scale:2
        const chartH = captureCanvas.height / 2;
        const isLandscape = chartW > chartH;

        const doc = new jsPDF({
            orientation: isLandscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        // Header area
        const headerH = 18;
        const footerH = 10;
        const contentH = pageH - headerH - footerH - 8;
        const contentW = pageW - 16;

        // Scale image to fit content area
        const ratio = Math.min(contentW / chartW, contentH / chartH);
        const imgW = chartW * ratio;
        const imgH = chartH * ratio;
        const imgX = (pageW - imgW) / 2;
        const imgY = headerH + 4;

        // Header background
        doc.setFillColor(15, 17, 21);
        doc.rect(0, 0, pageW, pageH, 'F');

        // Title
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('OrgChart Pro — Acme Corp', 8, 12);

        // Timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated ${timestamp}`, pageW - 8, 12, { align: 'right' });

        // Separator line
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(8, headerH, pageW - 8, headerH);

        // Chart image
        doc.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH);

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('Confidential — Internal Use Only', pageW / 2, pageH - 4, { align: 'center' });

        // Save
        const filename = `orgchart-acme-corp-${now.toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);

    } catch (err) {
        console.error('PDF export failed:', err);
        // Restore on error
        hier.style.transform = savedTransform;
        hier.style.transition = savedTransition;
        if (canvas) canvas.style.overflow = savedOverflow;
        alert('PDF export failed. Please try again.');
    } finally {
        // Restore button
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
}

// Export functions for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initOrgChart,
        OrgChartState
    };
}

console.log('org-chart.js loaded successfully');
