/**
 * PDFNova Client Authentication System
 * Handles Sign In, Sign Up, Session Tokens, User Menu, and Document History
 */
const PDFNovaAuth = {
  TOKEN_KEY: 'pdfnova_auth_token',
  USER_KEY: 'pdfnova_user',

  getToken() {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getUser() {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return Boolean(this.getToken() && this.getUser());
  },

  setSession(user, token) {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
    this.updateNavUI();
  },

  clearSession() {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch (e) {}
    this.updateNavUI();
  },

  getBaseUrl() {
    if (typeof PDFNovaAPI !== 'undefined' && PDFNovaAPI.getBaseUrl) {
      return PDFNovaAPI.getBaseUrl();
    }
    if (window.location.protocol === 'file:') return 'http://localhost:3000';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '3000') return `http://${window.location.hostname}:3000`;
    }
    return '';
  },

  /**
   * SIGN UP request
   */
  async signup(name, email, password) {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Registration failed');
    }
    this.setSession(data.user, data.token);
    return data;
  },

  /**
   * SIGN IN / LOGIN request
   */
  async login(email, password) {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Login failed');
    }
    this.setSession(data.user, data.token);
    return data;
  },

  /**
   * LOGOUT request
   */
  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(`${this.getBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {}
    }
    this.clearSession();
    if (typeof showToast === 'function') {
      showToast('You have been signed out successfully.', 'info', 3000);
    }
  },

  /**
   * Fetch Document History for logged in user
   */
  async getHistory() {
    const token = this.getToken();
    if (!token) return [];
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/auth/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  },

  /**
   * Validate current session with backend on startup
   */
  async checkSession() {
    const token = this.getToken();
    if (!token) {
      this.updateNavUI();
      return;
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
      } else {
        this.clearSession();
      }
    } catch (e) {
      // Offline fallback: keep cached user
    }
    this.updateNavUI();
  },

  /**
   * Dynamically renders User Profile Menu vs. Sign In buttons in the Navbar
   */
  updateNavUI() {
    const user = this.getUser();
    const signInBtns = document.querySelectorAll('.btn-sign-in');
    
    // Find or create container in nav-actions
    let userNavContainer = document.getElementById('userNavContainer');
    
    if (user && this.getToken()) {
      // User is LOGGED IN
      signInBtns.forEach(btn => btn.style.display = 'none');

      if (!userNavContainer) {
        const navActions = document.querySelector('.nav-actions');
        if (navActions) {
          userNavContainer = document.createElement('div');
          userNavContainer.id = 'userNavContainer';
          userNavContainer.className = 'user-nav-container';
          // Insert before mobile menu button
          const mobileBtn = document.getElementById('mobileMenuBtn');
          if (mobileBtn) {
            navActions.insertBefore(userNavContainer, mobileBtn);
          } else {
            navActions.appendChild(userNavContainer);
          }
        }
      }

      if (userNavContainer) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        userNavContainer.innerHTML = `
          <div class="user-dropdown-wrapper" id="userDropdownWrapper">
            <button type="button" class="user-pill-btn" id="userPillBtn" title="Account Menu">
              <span class="user-avatar-circle">${initial}</span>
              <span class="user-name-label">${escapeHtml(user.name.split(' ')[0])}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="user-dropdown-menu" id="userDropdownMenu">
              <div class="user-dropdown-header">
                <div class="user-info-name">${escapeHtml(user.name)}</div>
                <div class="user-info-email">${escapeHtml(user.email)}</div>
                <div class="user-info-badge">${user.plan || 'Free'} Plan</div>
              </div>
              <div class="user-dropdown-divider"></div>
              <button type="button" class="user-dropdown-item" id="navHistoryBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>My Saved Documents</span>
              </button>
              <div class="user-dropdown-divider"></div>
              <button type="button" class="user-dropdown-item logout-link" id="navLogoutBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        `;

        // Bind dropdown toggle
        const pillBtn = document.getElementById('userPillBtn');
        const menu = document.getElementById('userDropdownMenu');
        if (pillBtn && menu) {
          pillBtn.onclick = (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
          };
          document.addEventListener('click', (e) => {
            if (!e.target.closest('#userDropdownWrapper')) {
              menu.classList.remove('show');
            }
          });
        }

        // Bind actions
        document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
          PDFNovaAuth.logout();
        });

        document.getElementById('navHistoryBtn')?.addEventListener('click', () => {
          menu.classList.remove('show');
          PDFNovaAuth.showHistoryModal();
        });
      }
    } else {
      // User is LOGGED OUT
      if (userNavContainer) {
        userNavContainer.innerHTML = '';
      }
      signInBtns.forEach(btn => {
        btn.style.display = 'inline-flex';
        btn.textContent = 'Sign In';
        btn.onclick = () => PDFNovaAuth.openAuthModal('login');
      });
    }
  },

  /**
   * Opens the interactive unified Auth Modal
   * @param {'login' | 'signup'} tab 
   */
  openAuthModal(tab = 'login') {
    let modal = document.getElementById('pdfnovaAuthModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pdfnovaAuthModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card auth-modal-card">
        <div class="modal-header">
          <div class="auth-brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            <span>PDFNova Account</span>
          </div>
          <button type="button" class="modal-close-btn" id="closeAuthModalBtn">&times;</button>
        </div>

        <!-- Auth Tabs -->
        <div class="auth-tabs">
          <button type="button" class="auth-tab-btn ${tab === 'login' ? 'active' : ''}" id="tabLoginBtn">Sign In</button>
          <button type="button" class="auth-tab-btn ${tab === 'signup' ? 'active' : ''}" id="tabSignupBtn">Create Account</button>
        </div>

        <div id="authAlertBanner" class="auth-alert-banner" style="display:none;"></div>

        <!-- LOGIN FORM -->
        <form id="authLoginForm" class="auth-form-content" style="${tab === 'login' ? 'display:block;' : 'display:none;'}">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label class="form-label" style="margin-bottom:0;">Password</label>
              <a href="javascript:void(0)" onclick="alert('Use demo@pdfnova.com / Password123! or create a new account.')" style="font-size:0.75rem;color:var(--primary);">Demo Account?</a>
            </div>
            <div class="password-input-wrap">
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="toggle-pwd-btn" onclick="PDFNovaAuth.togglePwdVisibility('loginPassword', this)">👁</button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="loginSubmitBtn">
            <span>Sign In to PDFNova</span>
          </button>
          <p class="auth-footer-text">
            Don't have an account? <a href="javascript:void(0)" id="switchSignupLink">Create one free</a>
          </p>
        </form>

        <!-- SIGNUP FORM -->
        <form id="authSignupForm" class="auth-form-content" style="${tab === 'signup' ? 'display:block;' : 'display:none;'}">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="signupName" class="form-input" placeholder="Your full name" required autocomplete="name">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="signupEmail" class="form-input" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Create Password (min 6 chars)</label>
            <div class="password-input-wrap">
              <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required minlength="6" autocomplete="new-password">
              <button type="button" class="toggle-pwd-btn" onclick="PDFNovaAuth.togglePwdVisibility('signupPassword', this)">👁</button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="signupSubmitBtn">
            <span>Create Free Account</span>
          </button>
          <p class="auth-footer-text">
            Already have an account? <a href="javascript:void(0)" id="switchLoginLink">Sign in here</a>
          </p>
        </form>
      </div>
    `;

    modal.classList.add('open');

    // Bind Close
    document.getElementById('closeAuthModalBtn').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };

    // Bind Tab Switching
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabSignup = document.getElementById('tabSignupBtn');
    const formLogin = document.getElementById('authLoginForm');
    const formSignup = document.getElementById('authSignupForm');
    const alertBanner = document.getElementById('authAlertBanner');

    function switchTab(target) {
      alertBanner.style.display = 'none';
      if (target === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        formLogin.style.display = 'block';
        formSignup.style.display = 'none';
      } else {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        formSignup.style.display = 'block';
        formLogin.style.display = 'none';
      }
    }

    tabLogin.onclick = () => switchTab('login');
    tabSignup.onclick = () => switchTab('signup');
    document.getElementById('switchSignupLink').onclick = () => switchTab('signup');
    document.getElementById('switchLoginLink').onclick = () => switchTab('login');

    // Handle Login Submit
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      alertBanner.style.display = 'none';
      const submitBtn = document.getElementById('loginSubmitBtn');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Signing In...</span>`;

      try {
        const res = await PDFNovaAuth.login(email, password);
        modal.classList.remove('open');
        if (typeof showToast === 'function') {
          showToast(`Welcome back, ${res.user.name}!`, 'success', 3500);
        }
      } catch (err) {
        alertBanner.className = 'auth-alert-banner error';
        alertBanner.textContent = err.message;
        alertBanner.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to PDFNova</span>`;
      }
    };

    // Handle Signup Submit
    formSignup.onsubmit = async (e) => {
      e.preventDefault();
      alertBanner.style.display = 'none';
      const submitBtn = document.getElementById('signupSubmitBtn');
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Creating Account...</span>`;

      try {
        const res = await PDFNovaAuth.signup(name, email, password);
        modal.classList.remove('open');
        if (typeof showToast === 'function') {
          showToast(`Account created! Welcome to PDFNova, ${res.user.name}.`, 'success', 4000);
        }
      } catch (err) {
        alertBanner.className = 'auth-alert-banner error';
        alertBanner.textContent = err.message;
        alertBanner.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Create Free Account</span>`;
      }
    };
  },

  /**
   * Displays the Document History Modal for signed-in user
   */
  async showHistoryModal() {
    let modal = document.getElementById('pdfnovaHistoryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pdfnovaHistoryModal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card history-modal-card">
        <div class="modal-header">
          <h3 class="modal-title">My Document History</h3>
          <button type="button" class="modal-close-btn" id="closeHistoryModalBtn">&times;</button>
        </div>
        <div class="history-content-body" id="historyContentBody">
          <div style="text-align:center;padding:30px;color:var(--text-muted);">
            <div class="spinner" style="margin:0 auto 12px;"></div>
            Loading your processed files...
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    document.getElementById('closeHistoryModalBtn').onclick = () => modal.classList.remove('open');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };

    const history = await this.getHistory();
    const container = document.getElementById('historyContentBody');

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:var(--text-secondary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;color:var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h4 style="font-weight:700;margin-bottom:6px;">No recent documents yet</h4>
          <p style="font-size:0.88rem;color:var(--text-muted);">When you merge, compress, or edit PDFs while logged in, your files will appear here for fast re-download.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="history-list">
        ${history.map(item => `
          <div class="history-item-row">
            <div class="history-item-info">
              <div class="history-item-name">${escapeHtml(item.fileName || 'document.pdf')}</div>
              <div class="history-item-meta">
                <span>${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${new Date(item.timestamp).toLocaleDateString()}</span>
                <span>·</span>
                <span>${item.size ? (typeof PDFNovaAPI !== 'undefined' ? PDFNovaAPI.formatBytes(item.size) : item.size + ' B') : ''}</span>
              </div>
            </div>
            <a href="${this.getBaseUrl()}${item.downloadUrl}" download="${escapeHtml(item.fileName || 'document.pdf')}" class="btn btn-outline btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download</span>
            </a>
          </div>
        `).join('')}
      </div>
    `;
  },

  togglePwdVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🔒';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PDFNovaAuth.checkSession();
});
