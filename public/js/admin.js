/**
 * PDFNova Admin Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'pdfnova_admin_key';

  // Elements
  const authOverlay = document.getElementById('adminAuthOverlay');
  const authForm = document.getElementById('adminAuthForm');
  const adminKeyInput = document.getElementById('adminKeyInput');
  const authErrorText = document.getElementById('authErrorText');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const refreshBtn = document.getElementById('refreshMetricsBtn');
  const purgeExpiredBtn = document.getElementById('purgeExpiredBtn');
  const wipeAllBtn = document.getElementById('wipeAllBtn');

  // Metrics Elements
  const metricActiveJobs = document.getElementById('metricActiveJobs');
  const metricStorageUsed = document.getElementById('metricStorageUsed');
  const metricMemoryHeap = document.getElementById('metricMemoryHeap');
  const metricUptime = document.getElementById('metricUptime');
  const systemNodeVer = document.getElementById('systemNodeVer');
  const systemPlatform = document.getElementById('systemPlatform');
  const systemLibreOffice = document.getElementById('systemLibreOffice');
  const systemOcr = document.getElementById('systemOcr');
  const systemTtl = document.getElementById('systemTtl');
  const systemMaxFile = document.getElementById('systemMaxFile');
  const jobsTableBody = document.getElementById('jobsTableBody');
  const jobsCountBadge = document.getElementById('jobsCountBadge');

  let currentKey = sessionStorage.getItem(STORAGE_KEY) || '';

  function getBaseUrl() {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3000';
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '3000') {
        return 'http://localhost:3000';
      }
    }
    return '';
  }

  async function apiAdminRequest(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-key': currentKey
    };

    const res = await fetch(`${getBaseUrl()}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const data = await res.json().catch(() => ({ success: false, error: { message: 'Failed to parse JSON' } }));

    if (res.status === 401 || res.status === 403) {
      // Key invalid
      sessionStorage.removeItem(STORAGE_KEY);
      currentKey = '';
      showAuthOverlay();
      throw new Error(data.error?.message || 'Unauthorized admin access.');
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || `Request failed with status ${res.status}`);
    }

    return data;
  }

  function showAuthOverlay() {
    if (authOverlay) authOverlay.classList.add('open');
  }

  function hideAuthOverlay() {
    if (authOverlay) authOverlay.classList.remove('open');
  }

  // Auth Form Submit
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredKey = adminKeyInput.value.trim();
      if (!enteredKey) return;

      currentKey = enteredKey;
      if (authErrorText) authErrorText.style.display = 'none';

      try {
        await apiAdminRequest('/api/admin/auth', 'POST');
        sessionStorage.setItem(STORAGE_KEY, currentKey);
        hideAuthOverlay();
        loadDashboard();
      } catch (err) {
        if (authErrorText) {
          authErrorText.textContent = err.message || 'Invalid admin key.';
          authErrorText.style.display = 'block';
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(STORAGE_KEY);
      currentKey = '';
      showAuthOverlay();
    });
  }

  // Load Dashboard Data
  async function loadDashboard() {
    try {
      await Promise.all([loadMetrics(), loadJobs()]);
    } catch (e) {
      console.warn('Dashboard load error', e);
    }
  }

  async function loadMetrics() {
    const data = await apiAdminRequest('/api/admin/metrics');
    const m = data.metrics;

    if (metricActiveJobs) {
      metricActiveJobs.textContent = m.storage.activeJobs;
    }
    if (metricStorageUsed) {
      metricStorageUsed.textContent = formatBytes(m.storage.totalBytesUsed);
    }
    if (metricMemoryHeap) {
      metricMemoryHeap.textContent = formatBytes(m.system.processMemory.heapUsed);
    }
    if (metricUptime) {
      metricUptime.textContent = formatUptime(m.system.uptimeSeconds);
    }

    // System info pills
    if (systemNodeVer) systemNodeVer.textContent = m.system.nodeVersion;
    if (systemPlatform) systemPlatform.textContent = `${m.system.platform} (${m.system.arch})`;
    if (systemLibreOffice) {
      systemLibreOffice.textContent = m.capabilities.libreOffice.available ? 'Active (Headless)' : 'Optional (Not installed)';
      systemLibreOffice.className = `badge ${m.capabilities.libreOffice.available ? 'badge-mint' : 'badge-gray'}`;
    }
    if (systemOcr) systemOcr.textContent = m.capabilities.tesseractOcr.version;
    if (systemTtl) systemTtl.textContent = `${m.storage.ttlMinutes} mins`;
    if (systemMaxFile) systemMaxFile.textContent = `${m.configLimits.maxFileSizeMb} MB`;
  }

  async function loadJobs() {
    const data = await apiAdminRequest('/api/admin/jobs');
    const jobs = data.jobs || [];

    if (jobsCountBadge) jobsCountBadge.textContent = `${jobs.length} total`;
    if (!jobsTableBody) return;

    if (jobs.length === 0) {
      jobsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">
            No temporary jobs currently stored in sandbox. Storage is clean!
          </td>
        </tr>
      `;
      return;
    }

    jobsTableBody.innerHTML = '';
    jobs.forEach(job => {
      const tr = document.createElement('tr');
      const isExpired = job.isExpired;
      const statusBadge = isExpired
        ? `<span class="badge badge-coral">Expired</span>`
        : `<span class="badge badge-mint">Active</span>`;

      const shortId = job.jobId.slice(0, 8);

      tr.innerHTML = `
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="code-pill">${shortId}...</span>
            <button type="button" class="btn btn-outline btn-sm" style="padding:2px 6px;font-size:0.75rem;" title="Copy Job ID" onclick="navigator.clipboard.writeText('${job.jobId}'); alert('Copied: ${job.jobId}');">📋</button>
          </div>
        </td>
        <td><span class="badge badge-violet">${job.tool}</span></td>
        <td>${formatDate(job.createdAt)}</td>
        <td>${formatCountdown(job.expiresAt)}</td>
        <td>${formatBytes(job.sizeBytes)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            ${statusBadge}
            <button type="button" class="btn btn-outline btn-sm delete-job-btn" data-id="${job.jobId}" style="padding:4px 8px;color:#DC2626;border-color:rgba(220,38,38,0.2);" title="Force Delete Now">
              ✕
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.delete-job-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (!confirm(`Delete temporary job directory '${id}' immediately?`)) return;

        try {
          await apiAdminRequest(`/api/admin/jobs/${id}`, 'DELETE');
          if (typeof showToast === 'function') showToast(`Job ${id} deleted.`, 'success');
          loadDashboard();
        } catch (err) {
          if (typeof showToast === 'function') showToast(`Error: ${err.message}`, 'error');
          else alert(`Error deleting job: ${err.message}`);
        }
      });

      jobsTableBody.appendChild(tr);
    });
  }

  // Purge Expired Action
  if (purgeExpiredBtn) {
    purgeExpiredBtn.addEventListener('click', async () => {
      purgeExpiredBtn.disabled = true;
      purgeExpiredBtn.textContent = 'Purging...';
      try {
        const res = await apiAdminRequest('/api/admin/cleanup', 'POST');
        if (typeof showToast === 'function') showToast(res.message || 'Cleanup completed.', 'success');
        else alert(res.message || 'Cleanup completed.');
        loadDashboard();
      } catch (err) {
        if (typeof showToast === 'function') showToast(`Cleanup error: ${err.message}`, 'error');
        else alert(`Cleanup error: ${err.message}`);
      } finally {
        purgeExpiredBtn.disabled = false;
        purgeExpiredBtn.textContent = 'Purge Expired Jobs';
      }
    });
  }

  // Emergency Wipe All Action
  if (wipeAllBtn) {
    wipeAllBtn.addEventListener('click', async () => {
      const confirmText = prompt('WARNING: This will permanently delete ALL active and pending temporary job files from server disk. Type "WIPE" to confirm:');
      if (confirmText !== 'WIPE') return;

      wipeAllBtn.disabled = true;
      wipeAllBtn.textContent = 'Wiping...';
      try {
        const res = await apiAdminRequest('/api/admin/wipe-all', 'POST');
        if (typeof showToast === 'function') showToast(res.message || 'All temporary files wiped.', 'success');
        else alert(res.message || 'All temporary files wiped.');
        loadDashboard();
      } catch (err) {
        if (typeof showToast === 'function') showToast(`Wipe error: ${err.message}`, 'error');
        else alert(`Wipe error: ${err.message}`);
      } finally {
        wipeAllBtn.disabled = false;
        wipeAllBtn.textContent = 'Emergency Wipe All';
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadDashboard();
    });
  }

  // Helper Formatters
  function formatBytes(bytes) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  }

  function formatDate(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  function formatCountdown(expiresAt) {
    try {
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      if (diffMs <= 0) return '<span style="color:#DC2626;font-weight:600;">Expired</span>';
      const mins = Math.floor(diffMs / 60000);
      return `${mins}m left`;
    } catch {
      return '-';
    }
  }

  // Check initial state
  if (!currentKey) {
    showAuthOverlay();
  } else {
    hideAuthOverlay();
    loadDashboard();
  }
});
