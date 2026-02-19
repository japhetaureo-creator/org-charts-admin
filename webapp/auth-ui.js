// =============================================================================
// Auth UI Controller
// =============================================================================
// Manages the login modal, change password modal, user popover, and wires up
// the avatar button. Depends on AuthStore (auth.js).
// =============================================================================

const AuthUI = (() => {

    // ── DOM refs ──────────────────────────────────────────────────────────────
    function _el(id) { return document.getElementById(id); }

    // ── Open / close login modal ──────────────────────────────────────────────
    function openLoginModal() {
        const overlay = _el('auth-modal-overlay');
        if (!overlay) return;
        const form = _el('auth-login-form');
        if (form) form.reset();
        hideError();
        overlay.classList.add('open');
        setTimeout(() => { const e = _el('auth-email'); if (e) e.focus(); }, 150);
    }

    function closeLoginModal() {
        const overlay = _el('auth-modal-overlay');
        if (overlay) overlay.classList.remove('open');
    }

    function hideError() {
        const err = _el('auth-error');
        if (err) err.classList.add('hidden');
    }

    function showError(msg) {
        const err = _el('auth-error');
        const text = _el('auth-error-text');
        if (!err || !text) return;
        text.textContent = msg;
        err.classList.remove('hidden');
    }

    // ── Change password modal ─────────────────────────────────────────────────
    function openChangePasswordModal() {
        closePopover();
        const overlay = _el('chpw-modal-overlay');
        if (!overlay) return;
        const form = _el('chpw-form');
        if (form) form.reset();
        _el('chpw-error')?.classList.add('hidden');
        _el('chpw-success')?.classList.add('hidden');
        overlay.classList.add('open');
        setTimeout(() => { _el('chpw-current')?.focus(); }, 150);
    }

    function closeChangePasswordModal() {
        const overlay = _el('chpw-modal-overlay');
        if (overlay) overlay.classList.remove('open');
    }

    function _handleChangePasswordSubmit(e) {
        e.preventDefault();
        const current = _el('chpw-current')?.value || '';
        const newPw = _el('chpw-new')?.value || '';
        const confirm = _el('chpw-confirm')?.value || '';
        const btn = _el('chpw-submit-btn');
        const errEl = _el('chpw-error');
        const errText = _el('chpw-error-text');
        const successEl = _el('chpw-success');

        errEl?.classList.add('hidden');
        successEl?.classList.add('hidden');

        if (!current || !newPw || !confirm) {
            if (errText) errText.textContent = 'All fields are required.';
            errEl?.classList.remove('hidden');
            return;
        }
        if (newPw !== confirm) {
            if (errText) errText.textContent = 'New passwords do not match.';
            errEl?.classList.remove('hidden');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

        setTimeout(() => {
            const result = AuthStore.changePassword(current, newPw);
            if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }

            if (result.ok) {
                const form = _el('chpw-form');
                if (form) form.reset();
                successEl?.classList.remove('hidden');
                setTimeout(() => closeChangePasswordModal(), 1800);
            } else {
                if (errText) errText.textContent = result.error;
                errEl?.classList.remove('hidden');
            }
        }, 350);
    }

    // ── Open / close user popover ─────────────────────────────────────────────
    function openPopover() {
        const session = AuthStore.getSession();
        if (!session) return;

        const popover = _el('auth-user-popover');
        if (!popover) return;

        const nameEl = _el('auth-popover-name');
        const roleEl = _el('auth-popover-role');
        const emailEl = _el('auth-popover-email');
        if (nameEl) nameEl.textContent = session.name;
        if (roleEl) roleEl.textContent = session.role;
        if (emailEl) emailEl.textContent = session.email;

        popover.classList.add('open');
    }

    function closePopover() {
        const popover = _el('auth-user-popover');
        if (popover) popover.classList.remove('open');
    }

    // ── Avatar button click handler ───────────────────────────────────────────
    function _handleAvatarClick() {
        if (AuthStore.isLoggedIn()) {
            const popover = _el('auth-user-popover');
            if (popover && popover.classList.contains('open')) {
                closePopover();
            } else {
                openPopover();
            }
        } else {
            openLoginModal();
        }
    }

    // ── Sync avatar image visibility ──────────────────────────────────────────
    function _syncAvatarImage() {
        const img = _el('user-avatar-img');
        const icon = document.querySelector('#user-avatar-btn .avatar-guest-icon');
        const session = AuthStore.getSession();

        if (session && img) {
            img.src = session.avatar || '';
            img.classList.remove('user-avatar-img-hidden');
            if (icon) icon.style.display = 'none';
        } else {
            if (img) img.classList.add('user-avatar-img-hidden');
            if (icon) icon.style.display = '';
        }
    }

    // ── Login form submit ─────────────────────────────────────────────────────
    function _handleLoginSubmit(e) {
        e.preventDefault();
        const email = (_el('auth-email')?.value || '').trim();
        const password = (_el('auth-password')?.value || '');
        const btn = _el('auth-submit-btn');

        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

        setTimeout(() => {
            const result = AuthStore.login(email, password);
            if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }

            if (result.ok) {
                closeLoginModal();
                _syncAvatarImage();
                if (typeof applyAuthPermissions === 'function') applyAuthPermissions();
            } else {
                showError(result.error);
            }
        }, 400);
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        // Avatar button
        const avatarBtn = _el('user-avatar-btn');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _handleAvatarClick();
            });
        }

        // Login form
        const form = _el('auth-login-form');
        if (form) form.addEventListener('submit', _handleLoginSubmit);

        // Close login modal on overlay click
        const overlay = _el('auth-modal-overlay');
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLoginModal(); });

        // Close login modal on X
        const closeBtn = _el('auth-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeLoginModal);

        // Change password button in popover
        const chpwBtn = _el('auth-change-password-btn');
        if (chpwBtn) chpwBtn.addEventListener('click', openChangePasswordModal);

        // Change password form
        const chpwForm = _el('chpw-form');
        if (chpwForm) chpwForm.addEventListener('submit', _handleChangePasswordSubmit);

        // Close change password modal on overlay click
        const chpwOverlay = _el('chpw-modal-overlay');
        if (chpwOverlay) chpwOverlay.addEventListener('click', (e) => { if (e.target === chpwOverlay) closeChangePasswordModal(); });

        // Close change password modal on X
        const chpwClose = _el('chpw-modal-close');
        if (chpwClose) chpwClose.addEventListener('click', closeChangePasswordModal);

        // Escape key closes all modals and popover
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLoginModal();
                closeChangePasswordModal();
                closePopover();
            }
        });

        // Logout button
        const logoutBtn = _el('auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AuthStore.logout();
                closePopover();
                _syncAvatarImage();
                if (typeof applyAuthPermissions === 'function') applyAuthPermissions();
            });
        }

        // Click outside popover → close
        document.addEventListener('click', (e) => {
            const popover = _el('auth-user-popover');
            const avatarBtn = _el('user-avatar-btn');
            if (!popover || !avatarBtn) return;
            if (!popover.contains(e.target) && !avatarBtn.contains(e.target)) closePopover();
        });

        // Keep avatar in sync with auth state changes
        if (typeof AuthStore !== 'undefined') {
            AuthStore.onChange(() => _syncAvatarImage());
        }

        _syncAvatarImage();
    }

    return { init, openLoginModal, closeLoginModal, openChangePasswordModal };
})();

// Auto-init once DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthUI.init());
} else {
    AuthUI.init();
}

console.log('auth-ui.js loaded');
