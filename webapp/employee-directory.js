// =============================================================================
// Employee Directory — CRUD Module
// =============================================================================

const EmployeeDirectory = (() => {
    // ── Data — backed by SharedEmployeeStore ─────────────────────────────
    function getEmployees() {
        return SharedEmployeeStore.getAll();
    }

    let currentFilter = { department: '', location: '', search: '' };
    let editingEmployee = null;
    let pendingAvatarDataUrl = null;

    // ── Department Colors ───────────────────────────────────────────────────
    const deptColors = {
        'Operations - LCL': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300', ring: 'ring-amber-600/20' },
        'Operations - LCL/AIR': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', ring: 'ring-orange-600/20' },
        'Pricing': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', ring: 'ring-blue-600/20' },
        'Procurement': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', ring: 'ring-purple-600/20' },
        'Warehouse': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', ring: 'ring-yellow-600/20' },
        'Domestic': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300', ring: 'ring-teal-600/20' },
        'Civil': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300', ring: 'ring-indigo-600/20' },
        'Marketing': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300', ring: 'ring-pink-600/20' },
        'Finance': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300', ring: 'ring-emerald-600/20' },
    };

    const statusColors = {
        'active': 'bg-green-500',
        'inactive': 'bg-gray-400',
    };

    let showInactive = false;

    // ── Helpers ─────────────────────────────────────────────────────────────

    function getDeptStyle(dept) {
        return deptColors[dept] || { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', ring: 'ring-gray-600/20' };
    }

    // ── Render Table ────────────────────────────────────────────────────────
    function renderTable() {
        const tbody = document.getElementById('ed-table-body');
        if (!tbody) return;

        const filtered = getFilteredEmployees();
        const total = filtered.length;

        tbody.innerHTML = filtered.map(emp => {
            const ds = getDeptStyle(emp.department);
            const isInactive = emp.status === 'inactive';
            const sc = statusColors[emp.status] || 'bg-gray-400';
            const rowClass = isInactive ? 'opacity-50' : '';
            const statusIndicator = isInactive
                ? `<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-600/20">Inactive</span>`
                : `<span class="absolute bottom-0 right-0 size-2.5 rounded-full ${sc} ring-2 ring-white dark:ring-[#111418]"></span>`;
            const deactivateIcon = isInactive ? 'undo' : 'block';
            const deactivateTitle = isInactive ? 'Reactivate' : 'Deactivate';
            const deactivateBtnClass = isInactive
                ? 'ed-reactivate-row-btn text-[#637588] dark:text-[#9dabb9] hover:text-green-500 p-1 rounded-md hover:bg-green-500/10 transition-colors'
                : 'ed-deactivate-row-btn text-[#637588] dark:text-[#9dabb9] hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 transition-colors';
            return `
        <tr class="group ${rowClass} border-b border-[#e5e7eb] dark:border-[#283039] hover:bg-primary/5 dark:hover:bg-[#1c2127] transition-colors cursor-pointer" data-emp-id="${emp.id}">
            <td class="px-4 py-4 text-center">
                <input class="form-checkbox rounded border-gray-300 dark:border-gray-600 bg-transparent text-primary focus:ring-primary/50 size-4 cursor-pointer ed-row-check" type="checkbox" data-id="${emp.id}"/>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-1 ring-white dark:ring-[#283039]"
                             style="background-image: url('${emp.avatar}')"></div>
                        ${isInactive ? '' : `<span class="absolute bottom-0 right-0 size-2.5 rounded-full ${sc} ring-2 ring-white dark:ring-[#111418]"></span>`}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-[#111418] dark:text-white text-sm font-semibold leading-tight group-hover:text-primary transition-colors">${emp.name}</span>
                        <span class="text-[#637588] dark:text-[#9dabb9] text-xs">${emp.email}</span>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3">
            <span class="text-[#111418] dark:text-white text-sm">${emp.gender || '—'}</span>
        </td>
        <td class="px-4 py-3">
            ${isInactive
                    ? `<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 ring-1 ring-inset ring-gray-600/20">Inactive</span>`
                    : `<span class="inline-flex items-center rounded-full ${ds.bg} px-2.5 py-0.5 text-xs font-medium ${ds.text} ring-1 ring-inset ${ds.ring}">${emp.department}</span>`
                }
        </td>
        <td class="px-4 py-3">
            <span class="text-[#637588] dark:text-[#9dabb9] text-sm">${emp.phone || '—'}</span>
        </td>
        <td class="px-4 py-3">
            <div class="flex items-center gap-1.5 text-[#637588] dark:text-[#9dabb9] text-sm">
                <span class="material-symbols-outlined text-[16px]">location_on</span>
                ${emp.location}
            </div>
        </td>
        <td class="px-4 py-3 text-center">
            <span class="inline-flex items-center justify-center rounded-full bg-[#f0f2f4] dark:bg-[#283039] px-2.5 py-0.5 text-xs font-medium text-[#111418] dark:text-white">
                ${emp.startDate || '—'}
            </span>
        </td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    ${isInactive ? '' : `<button class="ed-edit-btn text-[#637588] dark:text-[#9dabb9] hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors" title="Edit" data-id="${emp.id}"><span class="material-symbols-outlined text-lg">edit</span></button>`}
                    <button class="${deactivateBtnClass}" title="${deactivateTitle}" data-id="${emp.id}">
                        <span class="material-symbols-outlined text-lg">${deactivateIcon}</span>
                    </button>
                    ${isInactive ? '' : `<button class="ed-delete-btn text-[#637588] dark:text-[#9dabb9] hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 transition-colors" title="Delete" data-id="${emp.id}"><span class="material-symbols-outlined text-lg">delete</span></button>`}
                </div>
            </td>
        </tr>`;
        }).join('');

        // Update count
        const countEl = document.getElementById('ed-result-count');
        if (countEl) {
            const allCount = showInactive
                ? getEmployees().length
                : getEmployees().filter(e => e.status !== 'inactive').length;
            countEl.innerHTML = `Showing <span class="font-medium text-[#111418] dark:text-white">1</span> to <span class="font-medium text-[#111418] dark:text-white">${total}</span> of <span class="font-medium text-[#111418] dark:text-white">${allCount}</span> results`;
        }

        updateDeactivateButtonState();
        attachRowListeners();
    }

    // ── Filtering ───────────────────────────────────────────────────────────
    function getFilteredEmployees() {
        return getEmployees().filter(emp => {
            // Hide inactive unless the toggle is on
            if (emp.status === 'inactive' && !showInactive) return false;

            const searchLower = currentFilter.search.toLowerCase();
            const matchSearch = !searchLower ||
                emp.name.toLowerCase().includes(searchLower) ||
                (emp.email || '').toLowerCase().includes(searchLower) ||
                (emp.phone || '').toLowerCase().includes(searchLower) ||
                emp.id.toLowerCase().includes(searchLower);
            const matchDept = !currentFilter.department || emp.department === currentFilter.department;
            const matchLoc = !currentFilter.location ||
                (emp.location || '').toLowerCase().includes(currentFilter.location.toLowerCase());
            return matchSearch && matchDept && matchLoc;
        });
    }

    // ── CRUD Operations ─────────────────────────────────────────────────────

    // CREATE
    function addEmployee(data) {
        const employee = SharedEmployeeStore.add(data);
        renderTable();
        showToast(`${employee.name} added successfully`, 'success');
        return employee;
    }

    // UPDATE
    function updateEmployee(id, data) {
        const result = SharedEmployeeStore.update(id, data);
        if (!result) return null;
        if (result.__saveError) {
            showToast('⚠️ Changes could not be saved – storage is full. Remove employee photos to free space.', 'error');
            return null;
        }
        renderTable();
        showToast(`${result.name} updated successfully`, 'success');
        return result;
    }

    // DELETE
    function deleteEmployee(id) {
        const emp = SharedEmployeeStore.delete(id);
        if (!emp) return;
        renderTable();
        showToast(`${emp.name} removed`, 'warning');
    }

    // ── Modal Management ────────────────────────────────────────────────────
    function setAvatarPreview(url) {
        const preview = document.getElementById('ed-avatar-preview');
        const placeholder = document.getElementById('ed-avatar-placeholder');
        if (!preview) return;
        if (url) {
            preview.style.backgroundImage = `url('${url}')`;
            if (placeholder) placeholder.style.display = 'none';
        } else {
            preview.style.backgroundImage = '';
            if (placeholder) placeholder.style.display = '';
        }
    }

    function openModal(employee = null) {
        editingEmployee = employee;
        pendingAvatarDataUrl = null;
        const modal = document.getElementById('ed-modal');
        const title = document.getElementById('ed-modal-title');
        const form = document.getElementById('ed-form');
        if (!modal || !form) return;

        title.textContent = employee ? 'Edit Employee' : 'Add New Employee';

        // Populate fields
        form.querySelector('#ed-field-name').value = employee?.name || '';
        form.querySelector('#ed-field-email').value = employee?.email || '';
        form.querySelector('#ed-field-startdate').value = employee?.startDate || '';
        form.querySelector('#ed-field-gender').value = employee?.gender || 'Male';
        form.querySelector('#ed-field-phone').value = employee?.phone || '';
        form.querySelector('#ed-field-location').value = employee?.location || '';
        form.querySelector('#ed-field-status').value = employee?.status || 'active';

        // Department: restore value; add temp option if dept isn't in the current list
        const deptSel = form.querySelector('#ed-field-dept');
        if (deptSel) {
            const dept = employee?.department || '';
            deptSel.value = dept;
            if (dept && deptSel.value !== dept) {
                // Dept not in dropdown — add it temporarily so the value is never lost
                const tempOpt = document.createElement('option');
                tempOpt.value = dept;
                tempOpt.textContent = dept + ' (imported)';
                deptSel.prepend(tempOpt);
                deptSel.value = dept;
            }
        }

        // Reset file input
        const avatarInput = form.querySelector('#ed-field-avatar');
        if (avatarInput) avatarInput.value = '';

        // Set avatar preview
        setAvatarPreview(employee?.avatar || null);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // Focus first field
        setTimeout(() => form.querySelector('#ed-field-name').focus(), 100);
    }

    function closeModal() {
        const modal = document.getElementById('ed-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        editingEmployee = null;
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('ed-form');
        const data = {
            name: form.querySelector('#ed-field-name').value.trim(),
            email: form.querySelector('#ed-field-email').value.trim(),
            startDate: form.querySelector('#ed-field-startdate').value,
            gender: form.querySelector('#ed-field-gender').value,
            department: form.querySelector('#ed-field-dept').value,
            phone: form.querySelector('#ed-field-phone').value.trim(),
            location: form.querySelector('#ed-field-location').value.trim(),
            status: form.querySelector('#ed-field-status').value,
        };

        // Include avatar if a new one was selected
        if (pendingAvatarDataUrl) {
            data.avatar = pendingAvatarDataUrl;
        }

        if (!data.name || !data.email) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        if (editingEmployee) {
            updateEmployee(editingEmployee.id, data);
        } else {
            addEmployee(data);
        }
        closeModal();
    }

    // ── Delete Confirmation ─────────────────────────────────────────────────
    function openDeleteConfirm(id) {
        const emp = SharedEmployeeStore.getById(id);
        if (!emp) return;

        const modal = document.getElementById('ed-delete-modal');
        if (!modal) return;
        modal.querySelector('#ed-delete-name').textContent = emp.name;
        modal.dataset.deleteId = id;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeDeleteConfirm() {
        const modal = document.getElementById('ed-delete-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function confirmDelete() {
        const modal = document.getElementById('ed-delete-modal');
        if (modal && modal.dataset.deleteId) {
            deleteEmployee(modal.dataset.deleteId);
            closeDeleteConfirm();
        }
    }

    // ── Toast Notifications ─────────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const colors = {
            success: 'bg-emerald-600', warning: 'bg-amber-600',
            error: 'bg-red-600', info: 'bg-blue-600'
        };
        const icons = {
            success: 'check_circle', warning: 'warning',
            error: 'error', info: 'info'
        };
        const toast = document.createElement('div');
        toast.className = `fixed bottom-6 right-6 z-[100] flex items-center gap-3 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all transform translate-y-4 opacity-0`;
        toast.innerHTML = `<span class="material-symbols-outlined text-lg">${icons[type]}</span> ${message}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
        setTimeout(() => {
            toast.style.transform = 'translateY(16px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── Deactivate / Reactivate ─────────────────────────────────────────────
    let _pendingDeactivateIds = [];

    function openDeactivateConfirm(ids) {
        _pendingDeactivateIds = ids;
        const modal = document.getElementById('ed-deactivate-modal');
        const msg = document.getElementById('ed-deactivate-modal-msg');
        if (!modal) return;
        if (msg) {
            msg.textContent = ids.length === 1
                ? 'This will deactivate 1 employee.'
                : `This will deactivate ${ids.length} employees.`;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeDeactivateConfirm() {
        const modal = document.getElementById('ed-deactivate-modal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        _pendingDeactivateIds = [];
    }

    function confirmDeactivate() {
        // Auth guard: defensive check
        if (typeof AuthStore !== 'undefined' && !AuthStore.can('edit')) {
            closeDeactivateConfirm();
            return;
        }
        _pendingDeactivateIds.forEach(id => SharedEmployeeStore.update(id, { status: 'inactive' }));
        const count = _pendingDeactivateIds.length;
        closeDeactivateConfirm();
        // Uncheck all
        document.querySelectorAll('.ed-row-check').forEach(cb => cb.checked = false);
        const selectAll = document.getElementById('ed-select-all');
        if (selectAll) selectAll.checked = false;
        renderTable();
        showToast(`${count} employee${count !== 1 ? 's' : ''} deactivated`, 'success');
    }

    function reactivateEmployee(id) {
        const emp = SharedEmployeeStore.update(id, { status: 'active' });
        if (emp) {
            renderTable();
            showToast(`${emp.name} reactivated`, 'success');
        }
    }

    function updateDeactivateButtonState() {
        const btn = document.getElementById('ed-deactivate-btn');
        if (!btn) return;
        const checked = document.querySelectorAll('.ed-row-check:checked').length;
        btn.disabled = checked === 0;
    }

    // ── Event Listeners ─────────────────────────────────────────────────────
    function attachRowListeners() {
        // Helper: check auth, prompt login if needed, return false for guests
        function requireAuth(action) {
            if (typeof AuthStore !== 'undefined' && !AuthStore.can(action)) {
                if (typeof AuthUI !== 'undefined') AuthUI.openLoginModal();
                return false;
            }
            return true;
        }

        document.querySelectorAll('.ed-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!requireAuth('edit')) return;
                const emp = SharedEmployeeStore.getById(btn.dataset.id);
                if (emp) openModal(emp);
            });
        });
        document.querySelectorAll('.ed-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!requireAuth('delete')) return;
                openDeleteConfirm(btn.dataset.id);
            });
        });
        document.querySelectorAll('.ed-deactivate-row-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!requireAuth('edit')) return;
                openDeactivateConfirm([btn.dataset.id]);
            });
        });
        document.querySelectorAll('.ed-reactivate-row-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!requireAuth('edit')) return;
                reactivateEmployee(btn.dataset.id);
            });
        });
        // Row checkbox state → toolbar button
        document.querySelectorAll('.ed-row-check').forEach(cb => {
            cb.addEventListener('change', updateDeactivateButtonState);
        });
    }

    // ── Import from CSV / XLSX ──────────────────────────────────────────────
    let importStep = 1;
    let importHeaders = [];
    let importRows = [];
    let importMapping = {}; // { fileColumn: employeeField }

    // Employee fields users can map to
    const IMPORT_FIELDS = [
        { key: '', label: '\u2014 skip \u2014' },
        { key: 'name', label: 'Name' },
        { key: 'title', label: 'Job Title' },
        { key: 'email', label: 'Email' },
        { key: 'department', label: 'Department' },
        { key: 'location', label: 'Location' },
        { key: 'status', label: 'Status' },
        { key: 'phone', label: 'Phone' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'gender', label: 'Gender' },
        { key: 'manager', label: 'Manager' },
    ];

    // Smart header → field auto-detect
    function autoDetectField(header) {
        const h = (header || '').toLowerCase().trim();
        const map = {
            'name': 'name', 'full name': 'name', 'fullname': 'name', 'employee name': 'name', 'employee': 'name',
            'title': 'title', 'job title': 'title', 'position': 'title', 'role': 'title', 'job role': 'title', 'designation': 'title',
            'status': 'status', 'employee status': 'status', 'state': 'status',
            'start date': 'startDate', 'startdate': 'startDate', 'start_date': 'startDate', 'hire date': 'startDate', 'date hired': 'startDate', 'date started': 'startDate',
            'gender': 'gender', 'sex': 'gender',
            'department': 'department', 'dept': 'department', 'dept.': 'department', 'division': 'department',
            'phone': 'phone', 'phone number': 'phone', 'telephone': 'phone', 'mobile': 'phone', 'contact': 'phone', 'contact number': 'phone', 'phne': 'phone',
            'email': 'email', 'e-mail': 'email', 'email address': 'email', 'mail': 'email',
            'location': 'location', 'office': 'location', 'city': 'location', 'office location': 'location',
            'manager': 'manager', 'manager email': 'manager', 'manager_email': 'manager', 'reports to': 'manager', 'supervisor': 'manager',
        };
        return map[h] || '';
    }

    function openImportModal() {
        importStep = 1;
        importHeaders = [];
        importRows = [];
        importMapping = {};

        const modal = document.getElementById('ed-import-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Reset UI to step 1
        showImportStep(1);

        // Reset file input & info
        const fileInput = document.getElementById('ed-import-file');
        if (fileInput) fileInput.value = '';
        document.getElementById('ed-import-file-info')?.classList.add('hidden');
        document.getElementById('ed-import-next').disabled = true;
    }

    function closeImportModal() {
        const modal = document.getElementById('ed-import-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function showImportStep(step) {
        importStep = step;
        const step1 = document.getElementById('ed-import-step1');
        const step2 = document.getElementById('ed-import-step2');
        const nextBtn = document.getElementById('ed-import-next');
        const confirmBtn = document.getElementById('ed-import-confirm');
        const backBtn = document.getElementById('ed-import-back');
        const label = document.getElementById('ed-import-step-label');

        if (step === 1) {
            step1?.classList.remove('hidden');
            step2?.classList.add('hidden');
            nextBtn?.classList.remove('hidden');
            confirmBtn?.classList.add('hidden');
            backBtn?.classList.add('hidden');
            if (label) label.textContent = 'Step 1 of 2 \u2014 Upload file';
        } else {
            step1?.classList.add('hidden');
            step2?.classList.remove('hidden');
            nextBtn?.classList.add('hidden');
            confirmBtn?.classList.remove('hidden');
            backBtn?.classList.remove('hidden');
            if (label) label.textContent = 'Step 2 of 2 \u2014 Review & import';
        }
    }

    function handleImportFile(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();

        // Show file info
        document.getElementById('ed-import-file-info')?.classList.remove('hidden');
        const nameEl = document.getElementById('ed-import-filename');
        const sizeEl = document.getElementById('ed-import-filesize');
        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = formatFileSize(file.size);

        if (ext === 'csv') {
            // Native CSV parsing
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const { headers, rows } = parseCSV(text);
                importHeaders = headers;
                importRows = rows;
                autoMapColumns();
                document.getElementById('ed-import-next').disabled = false;
            };
            reader.readAsText(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            // SheetJS parsing
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    if (jsonData.length > 0) {
                        importHeaders = jsonData[0].map(h => String(h || '').trim());
                        importRows = jsonData.slice(1).filter(row => row.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
                    }
                    autoMapColumns();
                    document.getElementById('ed-import-next').disabled = false;
                } catch (err) {
                    showToast('Failed to parse file: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            showToast('Unsupported file format. Use CSV, XLSX, or XLS.', 'error');
        }
    }

    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return { headers: [], rows: [] };
        const delimiter = lines[0].includes('\t') ? '\t' : ',';
        const headers = splitCSVLine(lines[0], delimiter);
        const rows = lines.slice(1).map(l => splitCSVLine(l, delimiter));
        return { headers, rows };
    }

    function splitCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === delimiter) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function autoMapColumns() {
        importMapping = {};
        importHeaders.forEach((h, idx) => {
            importMapping[idx] = autoDetectField(h);
        });
    }

    function renderImportPreview() {
        // Column mapping dropdowns
        const mappingEl = document.getElementById('ed-import-mapping');
        if (mappingEl) {
            mappingEl.innerHTML = importHeaders.map((h, idx) => {
                const options = IMPORT_FIELDS.map(f =>
                    `<option value="${f.key}" ${importMapping[idx] === f.key ? 'selected' : ''}>${f.label}</option>`
                ).join('');
                return `
                <div class="flex items-center gap-2 bg-[#f9fafb] dark:bg-[#111418] rounded-lg p-2.5 border border-[#e5e7eb] dark:border-[#3b4754]">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs text-[#637588] dark:text-[#9dabb9] mb-0.5">File Column</p>
                        <p class="text-sm font-semibold text-[#111418] dark:text-white truncate">${h}</p>
                    </div>
                    <span class="material-symbols-outlined text-[#9dabb9] text-sm">arrow_forward</span>
                    <select class="ed-import-map-select flex-1 text-xs rounded border border-[#e5e7eb] dark:border-[#3b4754] bg-white dark:bg-[#1c2127] text-[#111418] dark:text-white h-8 px-2 outline-none" data-col="${idx}">
                        ${options}
                    </select>
                </div>`;
            }).join('');

            mappingEl.querySelectorAll('.ed-import-map-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    importMapping[parseInt(e.target.dataset.col)] = e.target.value;
                });
            });
        }

        // Preview table
        const thead = document.getElementById('ed-import-preview-head');
        const tbody = document.getElementById('ed-import-preview-body');
        if (thead) {
            thead.innerHTML = importHeaders.map(h =>
                `<th class="px-3 py-2 text-left text-[#637588] dark:text-[#9dabb9] text-xs font-semibold uppercase tracking-wider">${h}</th>`
            ).join('');
        }
        if (tbody) {
            const preview = importRows.slice(0, 5);
            tbody.innerHTML = preview.map(row =>
                `<tr class="border-b border-[#e5e7eb] dark:border-[#283039]">${importHeaders.map((_, i) =>
                    `<td class="px-3 py-2 text-sm text-[#111418] dark:text-white">${row[i] ?? ''}</td>`
                ).join('')
                }</tr>`
            ).join('');
        }

        // Count
        const countEl = document.getElementById('ed-import-count');
        if (countEl) countEl.textContent = importRows.length;
    }

    function executeImport() {
        // Build reverse mapping: employeeField -> columnIndex
        const fieldToCol = {};
        Object.entries(importMapping).forEach(([colIdx, field]) => {
            if (field) fieldToCol[field] = parseInt(colIdx);
        });

        if (!('name' in fieldToCol)) {
            showToast('Please map at least the "Name" column', 'error');
            return;
        }

        let added = 0;
        importRows.forEach(row => {
            const emp = {};
            Object.entries(fieldToCol).forEach(([field, idx]) => {
                emp[field] = String(row[idx] ?? '').trim();
            });
            // Skip rows without a name
            if (!emp.name) return;
            // Default status
            if (!emp.status) emp.status = 'active';

            SharedEmployeeStore.add(emp, true); // true = silent
            added++;
        });

        // Add single summary log for the bulk import
        if (added > 0 && typeof SharedLogStore !== 'undefined') {
            SharedLogStore.add({
                type: 'sync',
                action: 'Bulk imported employees',
                target: `${added} employees`,
                icon: 'group_add',
                iconBg: 'bg-indigo-600'
            });
        }

        renderTable();
        closeImportModal();
        showToast(`Successfully imported ${added} employee${added !== 1 ? 's' : ''}`, 'success');
    }

    function populateDeptDropdowns(preserveFilter) {
        const depts = (typeof DepartmentStore !== 'undefined') ? DepartmentStore.getAll() : [];

        // Filter dropdown
        const filterSel = document.getElementById('ed-filter-dept');
        if (filterSel) {
            const prev = filterSel.value;
            filterSel.innerHTML = '<option value="">All Departments</option>' +
                depts.map(d => `<option value="${d}">${d}</option>`).join('');
            if (preserveFilter && depts.includes(prev)) filterSel.value = prev;
        }

        // Add/Edit modal dropdown
        const formSel = document.getElementById('ed-field-dept');
        if (formSel) {
            const curr = formSel.value;
            formSel.innerHTML = '<option value="">— select —</option>' +
                depts.map(d => `<option value="${d}">${d}</option>`).join('');
            if (depts.includes(curr)) formSel.value = curr;
        }
    }

    function init() {
        // Populate department dropdowns from DepartmentStore
        populateDeptDropdowns(false);
        if (typeof DepartmentStore !== 'undefined') {
            DepartmentStore.onChange(() => populateDeptDropdowns(true));
        }

        const searchInput = document.getElementById('ed-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentFilter.search = e.target.value;
                renderTable();
            });
        }

        // Department filter
        const deptFilter = document.getElementById('ed-filter-dept');
        if (deptFilter) {
            deptFilter.addEventListener('change', (e) => {
                currentFilter.department = e.target.value;
                renderTable();
            });
        }

        // Location filter
        const locFilter = document.getElementById('ed-filter-loc');
        if (locFilter) {
            locFilter.addEventListener('change', (e) => {
                currentFilter.location = e.target.value;
                renderTable();
            });
        }

        // Add button
        const addBtn = document.getElementById('ed-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => openModal());
        }

        // Form submit
        const form = document.getElementById('ed-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }

        // Avatar file input
        const avatarInput = document.getElementById('ed-field-avatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                    showToast('Image must be under 5 MB', 'error');
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // Compress to max 200×200 px JPEG to avoid localStorage quota overflow
                    const img = new Image();
                    img.onload = () => {
                        const MAX = 200;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
                        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        pendingAvatarDataUrl = canvas.toDataURL('image/jpeg', 0.75);
                        setAvatarPreview(pendingAvatarDataUrl);
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // Modal close buttons
        document.getElementById('ed-modal-close')?.addEventListener('click', closeModal);
        document.getElementById('ed-modal-cancel')?.addEventListener('click', closeModal);

        // Delete confirm modal
        document.getElementById('ed-delete-cancel')?.addEventListener('click', closeDeleteConfirm);
        document.getElementById('ed-delete-confirm')?.addEventListener('click', confirmDelete);

        // Close modals on backdrop click
        document.getElementById('ed-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'ed-modal') closeModal();
        });
        document.getElementById('ed-delete-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'ed-delete-modal') closeDeleteConfirm();
        });

        // Select all checkbox
        document.getElementById('ed-select-all')?.addEventListener('change', (e) => {
            document.querySelectorAll('.ed-row-check').forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateDeactivateButtonState();
        });

        // Show inactive toggle
        document.getElementById('ed-show-inactive')?.addEventListener('change', (e) => {
            showInactive = e.target.checked;
            renderTable();
        });

        // Toolbar deactivate button
        document.getElementById('ed-deactivate-btn')?.addEventListener('click', () => {
            const selectedIds = [...document.querySelectorAll('.ed-row-check:checked')].map(cb => cb.dataset.id);
            if (selectedIds.length > 0) openDeactivateConfirm(selectedIds);
        });

        // Deactivate confirmation modal
        document.getElementById('ed-deactivate-modal-cancel')?.addEventListener('click', closeDeactivateConfirm);
        document.getElementById('ed-deactivate-modal-confirm')?.addEventListener('click', confirmDeactivate);
        document.getElementById('ed-deactivate-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'ed-deactivate-modal') closeDeactivateConfirm();
        });

        // Listen for changes from other modules (e.g. Org Chart edits)
        SharedEmployeeStore.onChange((action, data) => {
            // Re-render if the page is visible
            const page = document.getElementById('page-employee-directory');
            if (page && !page.classList.contains('hidden')) {
                renderTable();
            }
        });

        // Import button
        document.getElementById('ed-import-btn')?.addEventListener('click', openImportModal);

        // Import modal controls
        document.getElementById('ed-import-close')?.addEventListener('click', closeImportModal);
        document.getElementById('ed-import-cancel')?.addEventListener('click', closeImportModal);
        document.getElementById('ed-import-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'ed-import-modal') closeImportModal();
        });

        // Import dropzone
        const dropzone = document.getElementById('ed-import-dropzone');
        const fileInput = document.getElementById('ed-import-file');
        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('border-primary', 'bg-primary/5');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('border-primary', 'bg-primary/5');
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-primary', 'bg-primary/5');
                if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
            });
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) handleImportFile(e.target.files[0]);
            });
        }

        // Remove file button
        document.getElementById('ed-import-file-remove')?.addEventListener('click', () => {
            importHeaders = [];
            importRows = [];
            document.getElementById('ed-import-file-info')?.classList.add('hidden');
            document.getElementById('ed-import-next').disabled = true;
            if (fileInput) fileInput.value = '';
        });

        // Next button (step 1 → step 2)
        document.getElementById('ed-import-next')?.addEventListener('click', () => {
            if (importRows.length === 0) {
                showToast('No data found in file', 'error');
                return;
            }
            renderImportPreview();
            showImportStep(2);
        });

        // Back button (step 2 → step 1)
        document.getElementById('ed-import-back')?.addEventListener('click', () => {
            showImportStep(1);
        });

        // Confirm import
        document.getElementById('ed-import-confirm')?.addEventListener('click', executeImport);

        // Initial render
        renderTable();
    }

    return { init, addEmployee, updateEmployee, deleteEmployee, renderTable };
})();
