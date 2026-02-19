// =============================================================================
// Notifications UI
// =============================================================================
// Renders the slide-in notification drawer, keeps the bell badge in sync,
// and surfaces a browser-push permission prompt when the store requests it.
// Depends on: notification-store.js (NotificationStore), notifications.css
// =============================================================================

const NotificationsUI = (() => {

    // ── DOM refs ──────────────────────────────────────────────────────────────
    let bellBtn, overlay, drawer, listEl, countBadge, pushBanner;

    // ── Time formatting ────────────────────────────────────────────────────────
    function _timeAgo(isoString) {
        const diff = Date.now() - new Date(isoString).getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return 'Just now';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        const d = Math.floor(h / 24);
        return `${d}d ago`;
    }

    // ── Icon CSS class ─────────────────────────────────────────────────────────
    function _iconClass(icon, critical) {
        if (critical) return 'notif-icon--error';
        const map = {
            person_add: 'notif-icon--add',
            person_remove: 'notif-icon--remove',
            sync: 'notif-icon--sync',
            sync_problem: 'notif-icon--error',
            account_tree: 'notif-icon--sync',
            swap_horiz: 'notif-icon--default',
        };
        return map[icon] || 'notif-icon--default';
    }

    // ── Render a single notification item ─────────────────────────────────────
    function _renderItem(notif) {
        const li = document.createElement('div');
        li.className = 'notif-item' + (notif.read ? '' : ' unread');
        li.dataset.id = notif.id;
        li.innerHTML = `
            <span class="notif-icon ${_iconClass(notif.icon, notif.critical)} material-symbols-outlined">${notif.icon}</span>
            <div class="notif-content">
                <p class="notif-title">${notif.title}</p>
                <p class="notif-body">${notif.body}</p>
                <span class="notif-time">${_timeAgo(notif.timestamp)}</span>
            </div>
            <button class="notif-dismiss-btn material-symbols-outlined" aria-label="Dismiss">close</button>
        `;

        // Mark as read on click
        li.addEventListener('click', e => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            NotificationStore.markRead(notif.id);
            li.classList.remove('unread');
        });

        // Dismiss
        li.querySelector('.notif-dismiss-btn').addEventListener('click', e => {
            e.stopPropagation();
            li.style.animation = 'none';
            li.style.opacity = '0';
            li.style.transform = 'translateX(16px)';
            li.style.transition = 'opacity 0.18s, transform 0.18s';
            setTimeout(() => { NotificationStore.dismiss(notif.id); }, 180);
        });

        return li;
    }

    // ── Render full list ───────────────────────────────────────────────────────
    function _renderList() {
        const all = NotificationStore.getAll();
        listEl.innerHTML = '';

        if (!all.length) {
            listEl.innerHTML = `
                <div class="notif-empty">
                    <span class="notif-empty-icon material-symbols-outlined">notifications_off</span>
                    <p class="notif-empty-title">You're all caught up</p>
                    <p class="notif-empty-sub">New employee and sync events will appear here</p>
                </div>
            `;
            return;
        }

        all.forEach(n => listEl.appendChild(_renderItem(n)));
    }

    // ── Update the bell badge ─────────────────────────────────────────────────
    function _updateBadge() {
        const count = NotificationStore.getUnread().length;

        // Remove old badge content
        if (countBadge) {
            if (count === 0) {
                countBadge.classList.add('hidden');
            } else {
                countBadge.classList.remove('hidden');
                countBadge.textContent = count > 99 ? '99+' : count;
            }
        }

        // Update header count chip inside drawer
        const chip = drawer?.querySelector('.notif-header-count');
        if (chip) {
            chip.textContent = count;
            chip.style.display = count === 0 ? 'none' : '';
        }
    }

    // ── Browser push permission banner ────────────────────────────────────────
    function _maybeShowPushBanner() {
        if (!pushBanner) return;
        const prefs = NotificationStore.getPrefs();
        const perm = Notification.permission;

        // Show if: not yet granted, user hasn't turned off browser push manually, and API is supported
        const show = ('Notification' in window) && perm === 'default' && !prefs.browserPush;
        pushBanner.style.display = show ? '' : 'none';
    }

    // ── Open / close ──────────────────────────────────────────────────────────
    function open() {
        overlay.classList.add('open');
        drawer.classList.add('open');
        _renderList();
        _updateBadge();
        _maybeShowPushBanner();
    }

    function close() {
        overlay.classList.remove('open');
        drawer.classList.remove('open');
    }

    // ── Build the drawer DOM ──────────────────────────────────────────────────
    function _buildDrawer() {
        // Overlay (backdrop click to close)
        overlay = document.createElement('div');
        overlay.className = 'notif-overlay';
        overlay.addEventListener('click', e => {
            if (!drawer.contains(e.target)) close();
        });

        // Drawer
        drawer = document.createElement('div');
        drawer.className = 'notif-drawer';
        drawer.setAttribute('aria-label', 'Notifications');
        drawer.role = 'dialog';

        // Push permission banner
        pushBanner = document.createElement('div');
        pushBanner.className = 'notif-push-banner';
        pushBanner.style.display = 'none';
        pushBanner.innerHTML = `
            <span class="notif-push-banner-icon material-symbols-outlined">notifications_active</span>
            <span>Enable browser alerts for sync failures and employee changes</span>
            <button id="notif-allow-push-btn">Allow</button>
        `;
        pushBanner.querySelector('#notif-allow-push-btn').addEventListener('click', async () => {
            const result = await Notification.requestPermission();
            if (result === 'granted') {
                // Save pref
                try {
                    const raw = localStorage.getItem('orgchart_app_settings');
                    const s = raw ? JSON.parse(raw) : {};
                    s.notifications = { ...(s.notifications || {}), browserPush: true };
                    localStorage.setItem('orgchart_app_settings', JSON.stringify(s));
                } catch { }
                // Update Settings UI if open
                const browserPushToggle = document.getElementById('notif-pref-browser-push');
                if (browserPushToggle) browserPushToggle.checked = true;
            }
            _maybeShowPushBanner();
        });

        // Header
        const header = document.createElement('div');
        header.className = 'notif-header';
        header.innerHTML = `
            <div class="notif-header-left">
                <span class="notif-header-icon material-symbols-outlined">notifications</span>
                <span class="notif-header-title">Notifications</span>
                <span class="notif-header-count">0</span>
            </div>
            <div class="notif-header-right">
                <button class="notif-mark-all-btn" id="notif-mark-all">Mark all read</button>
                <button class="notif-close-btn material-symbols-outlined" id="notif-close">close</button>
            </div>
        `;
        header.querySelector('#notif-mark-all').addEventListener('click', () => {
            NotificationStore.markAllRead();
            _renderList();
            _updateBadge();
        });
        header.querySelector('#notif-close').addEventListener('click', close);

        // List
        listEl = document.createElement('div');
        listEl.className = 'notif-list';

        // Footer
        const footer = document.createElement('div');
        footer.className = 'notif-footer';
        footer.innerHTML = `<button class="notif-clear-btn" id="notif-clear-all">Clear all</button>`;
        footer.querySelector('#notif-clear-all').addEventListener('click', () => {
            NotificationStore.clearAll();
            _renderList();
            _updateBadge();
        });

        drawer.appendChild(pushBanner);
        drawer.appendChild(header);
        drawer.appendChild(listEl);
        drawer.appendChild(footer);
        overlay.appendChild(drawer);
        document.body.appendChild(overlay);
    }

    // ── Replace the static red dot on #notifications-btn ─────────────────────
    function _upgradeBellButton() {
        bellBtn = document.getElementById('notifications-btn');
        if (!bellBtn) return;

        // Remove existing static red dot child spans (but keep the icon)
        bellBtn.querySelectorAll('span:not(.material-symbols-outlined)').forEach(el => el.remove());

        // Create the count badge
        countBadge = document.createElement('span');
        countBadge.className = 'notif-count-badge hidden';
        bellBtn.appendChild(countBadge);

        bellBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (drawer.classList.contains('open')) {
                close();
            } else {
                open();
            }
        });
    }

    // ── Subscribe to store events ─────────────────────────────────────────────
    function _wireStore() {
        NotificationStore.onChange((action) => {
            _updateBadge();
            if (drawer?.classList.contains('open')) {
                _renderList();
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        init() {
            _buildDrawer();
            _upgradeBellButton();
            _wireStore();
            _updateBadge();
        },

        open,
        close,
    };
})();

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    NotificationStore.init();
    NotificationsUI.init();
    console.log('notifications.js ready');
});
