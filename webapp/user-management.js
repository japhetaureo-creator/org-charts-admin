// =============================================================================
// User Management — CRUD Module
// =============================================================================

const UserManagement = (() => {
    // ── Data — backed by SharedAdminUserStore ────────────────────────────
    function getUsers() {
        return SharedAdminUserStore.getAll();
    }

    let currentFilter = { role: '', search: '' };
    let editingUser = null;
    let pendingAvatarDataUrl = null;

    const roleStyles = {
        'Super Admin': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', ring: 'ring-purple-600/20' },
        'Admin': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300', ring: 'ring-indigo-600/20' },
    };

    const statusColors = {
        'active': 'bg-green-500',
        'inactive': 'bg-gray-400',
        'suspended': 'bg-red-500',
    };

    // ── Helpers ──────────────────────────────────────────────────────────
    function getRoleStyle(role) {
        return roleStyles[role] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300', ring: 'ring-gray-400/20' };
    }

    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatLastLogin(iso) {
        if (!iso) return 'Never';
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ── Render Table ────────────────────────────────────────────────────
    function renderTable() {
        const tbody = document.getElementById('um-table-body');
        if (!tbody) return;

        const filtered = getFilteredUsers();
        tbody.innerHTML = filtered.map(user => {
            const rs = getRoleStyle(user.role);
            const sc = statusColors[user.status] || 'bg-gray-400';
            return `
            <tr class="border-b border-[#e5e7eb] dark:border-[#283039] hover:bg-[#f9fafb] dark:hover:bg-[#1c2127] transition-colors group" data-user-id="${user.id}">
                <td class="px-4 py-3 text-center">
                    <input class="um-row-cb form-checkbox rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111418] text-primary focus:ring-primary/50 size-4 cursor-pointer"
                           type="checkbox" data-id="${user.id}" />
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="relative flex-shrink-0">
                            <div class="size-10 rounded-full bg-cover bg-center bg-no-repeat ring-2 ring-[#e5e7eb] dark:ring-[#3b4754]"
                                 style="background-image:url('${user.avatar}')"></div>
                            <span class="absolute bottom-0 right-0 block size-2.5 rounded-full ring-2 ring-white dark:ring-[#111418] ${sc}"></span>
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-[#111418] dark:text-white truncate">${user.name}</p>
                            <p class="text-xs text-[#637588] dark:text-[#9dabb9] truncate">${user.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${rs.bg} ${rs.text} ${rs.ring}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5 text-sm">
                        <span class="size-2 rounded-full ${sc}"></span>
                        <span class="text-[#111418] dark:text-white capitalize">${user.status}</span>
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-[#637588] dark:text-[#9dabb9]">
                    ${formatLastLogin(user.lastLogin)}
                </td>
                <td class="px-4 py-3 text-sm text-[#637588] dark:text-[#9dabb9]">
                    ${formatDate(user.createdAt)}
                </td>
                <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="um-edit-btn flex items-center justify-center size-8 rounded-lg hover:bg-[#f0f2f4] dark:hover:bg-[#283039] text-[#637588] dark:text-[#9dabb9] hover:text-primary transition-colors"
                                data-id="${user.id}" title="Edit">
                            <span class="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button class="um-delete-btn flex items-center justify-center size-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#637588] dark:text-[#9dabb9] hover:text-red-500 transition-colors"
                                data-id="${user.id}" title="Delete">
                            <span class="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // Result count
        const countEl = document.getElementById('um-result-count');
        if (countEl) {
            countEl.textContent = `Showing ${filtered.length} of ${getUsers().length} users`;
        }

        attachRowListeners();
    }

    // ── Filtering ───────────────────────────────────────────────────────
    function getFilteredUsers() {
        let list = getUsers();

        if (currentFilter.role) {
            list = list.filter(u => u.role === currentFilter.role);
        }
        if (currentFilter.search) {
            const q = currentFilter.search.toLowerCase();
            list = list.filter(u =>
                (u.name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.role || '').toLowerCase().includes(q)
            );
        }
        return list;
    }

    // ── CRUD Operations ─────────────────────────────────────────────────

    // CREATE
    function addUser(data) {
        const user = SharedAdminUserStore.add(data);
        renderTable();
        showToast(`${user.name} added successfully`, 'success');
        return user;
    }

    // UPDATE
    function updateUser(id, data) {
        const updated = SharedAdminUserStore.update(id, data);
        if (updated) {
            renderTable();
            showToast(`${updated.name} updated successfully`, 'success');
        }
        return updated;
    }

    // DELETE
    function deleteUser(id) {
        const user = SharedAdminUserStore.delete(id);
        if (user) {
            renderTable();
            showToast(`${user.name} has been removed`, 'info');
        }
        return user;
    }

    // ── Modal Management ────────────────────────────────────────────────
    function setAvatarPreview(url) {
        const preview = document.getElementById('um-avatar-preview');
        const placeholder = document.getElementById('um-avatar-placeholder');
        if (!preview) return;
        if (url) {
            preview.style.backgroundImage = `url('${url}')`;
            if (placeholder) placeholder.style.display = 'none';
        } else {
            preview.style.backgroundImage = '';
            if (placeholder) placeholder.style.display = '';
        }
    }

    function openModal(user = null) {
        const modal = document.getElementById('um-modal');
        const title = document.getElementById('um-modal-title');
        const form = document.getElementById('um-form');
        if (!modal || !form) return;

        editingUser = user;
        pendingAvatarDataUrl = null;
        form.reset();
        setAvatarPreview(null);

        if (user) {
            title.textContent = 'Edit User';
            document.getElementById('um-field-name').value = user.name || '';
            document.getElementById('um-field-email').value = user.email || '';
            document.getElementById('um-field-role').value = user.role || 'Admin';
            document.getElementById('um-field-status').value = user.status || 'active';
            if (user.avatar) setAvatarPreview(user.avatar);
            // Password hint: optional when editing
            const pwHint = document.getElementById('um-password-hint');
            const pwField = document.getElementById('um-field-password');
            if (pwHint) pwHint.style.display = '';
            if (pwField) pwField.required = false;
        } else {
            title.textContent = 'Add New User';
            // Password required for new users
            const pwHint = document.getElementById('um-password-hint');
            const pwField = document.getElementById('um-field-password');
            if (pwHint) pwHint.style.display = 'none';
            if (pwField) pwField.required = true;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => document.getElementById('um-field-name')?.focus(), 100);
    }

    function closeModal() {
        const modal = document.getElementById('um-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        editingUser = null;
        pendingAvatarDataUrl = null;
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const passwordVal = (document.getElementById('um-field-password')?.value || '').trim();
        const data = {
            name: document.getElementById('um-field-name').value.trim(),
            email: document.getElementById('um-field-email').value.trim(),
            role: document.getElementById('um-field-role').value,
            status: document.getElementById('um-field-status').value,
        };
        // Only set password if a value was entered (keeps existing when editing)
        if (passwordVal) data.password = passwordVal;
        if (pendingAvatarDataUrl) data.avatar = pendingAvatarDataUrl;

        if (editingUser) {
            updateUser(editingUser.id, data);
        } else {
            addUser(data);
        }
        closeModal();
    }

    // ── Delete Confirmation ─────────────────────────────────────────────
    let pendingDeleteId = null;

    function openDeleteConfirm(id) {
        const user = SharedAdminUserStore.getById(id);
        if (!user) return;
        pendingDeleteId = id;

        const modal = document.getElementById('um-delete-modal');
        const nameEl = document.getElementById('um-delete-name');
        if (nameEl) nameEl.textContent = user.name;
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeDeleteConfirm() {
        const modal = document.getElementById('um-delete-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        pendingDeleteId = null;
    }

    function confirmDelete() {
        if (pendingDeleteId) deleteUser(pendingDeleteId);
        closeDeleteConfirm();
    }

    // ── Toast Notifications ─────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-indigo-600',
            warning: 'bg-amber-600'
        };
        const toast = document.createElement('div');
        toast.className = `fixed bottom-6 right-6 z-[100] ${colors[type] || colors.info} text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 animate-slide-up`;
        toast.style.animation = 'slideUp 0.3s ease-out';
        const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
        toast.innerHTML = `<span class="material-symbols-outlined text-lg">${icons[type] || 'info'}</span> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── Event Listeners ─────────────────────────────────────────────────
    function attachRowListeners() {
        document.querySelectorAll('.um-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = SharedAdminUserStore.getById(btn.dataset.id);
                if (user) openModal(user);
            });
        });
        document.querySelectorAll('.um-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openDeleteConfirm(btn.dataset.id);
            });
        });
    }

    function init() {
        // ── Search ──────────────────────────────────────────────────────
        const searchInput = document.getElementById('um-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentFilter.search = e.target.value;
                renderTable();
            });
        }

        // ── Role filter ─────────────────────────────────────────────────
        const roleFilter = document.getElementById('um-filter-role');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                currentFilter.role = e.target.value;
                renderTable();
            });
        }

        // ── Add button ──────────────────────────────────────────────────
        const addBtn = document.getElementById('um-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => openModal());
        }

        // ── Modal events ────────────────────────────────────────────────
        const form = document.getElementById('um-form');
        if (form) form.addEventListener('submit', handleFormSubmit);

        const modalClose = document.getElementById('um-modal-close');
        if (modalClose) modalClose.addEventListener('click', closeModal);

        const modalCancel = document.getElementById('um-modal-cancel');
        if (modalCancel) modalCancel.addEventListener('click', closeModal);

        // ── Avatar upload ───────────────────────────────────────────────
        const avatarInput = document.getElementById('um-field-avatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    pendingAvatarDataUrl = e.target.result;
                    setAvatarPreview(pendingAvatarDataUrl);
                };
                reader.readAsDataURL(file);
            });
        }

        // ── Delete modal events ─────────────────────────────────────────
        const deleteCancel = document.getElementById('um-delete-cancel');
        if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteConfirm);

        const deleteConfirm = document.getElementById('um-delete-confirm');
        if (deleteConfirm) deleteConfirm.addEventListener('click', confirmDelete);

        // ── Select all checkbox ─────────────────────────────────────────
        const selectAll = document.getElementById('um-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                document.querySelectorAll('.um-row-cb').forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });
        }

        // ── Sync on data changes ────────────────────────────────────────
        SharedAdminUserStore.onChange(() => renderTable());

        // ── Initial render ──────────────────────────────────────────────
        renderTable();
    }

    return { init, addUser, updateUser, deleteUser, renderTable };
})();
