/**
 * PDFNova API Client
 * Robust REST client with upload progress, error mapping, and job history
 */
var PDFNovaAPI = {
  /**
   * Determine API base URL (supports Node.js server, VS Code Live Server, GitHub Pages + cloud backend)
   */
  getBaseUrl() {
    // 1. Explicit config override (global variable or localStorage for GitHub Pages)
    if (typeof window !== 'undefined') {
      if (window.PDFNOVA_API_URL) {
        return window.PDFNOVA_API_URL.replace(/\/$/, '');
      }
      try {
        const customBackend = localStorage.getItem('pdfnova_api_backend');
        if (customBackend) return customBackend.replace(/\/$/, '');
      } catch (e) {}

      // 2. Direct file:// protocol
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000';
      }

      // 3. Any port other than 3000 (e.g. VS Code Live Server port 5500, 5501, 8080)
      const port = window.location.port;
      const hostname = window.location.hostname || 'localhost';
      if (port && port !== '3000') {
        return `http://${hostname}:3000`;
      }
    }

    // 4. Same-origin (e.g. when served directly on port 3000 or production domains)
    return '';
  },

  /**
   * Performs multipart form upload with real progress tracking and automatic offline fallback
   */
  upload(endpoint, formData, onProgress) {
    // 1. Direct Offline Mode: If offline, process immediately in client-side engine
    if (!navigator.onLine && typeof PDFNovaOffline !== 'undefined' && PDFNovaOffline.isAvailable()) {
      if (typeof onProgress === 'function') onProgress(50);
      return PDFNovaOffline.process(endpoint, formData);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.getBaseUrl()}${endpoint}`;

      xhr.open('POST', url, true);

      // Attach user auth token if logged in
      try {
        const authToken = localStorage.getItem('pdfnova_auth_token');
        if (authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        }
      } catch (e) {}

      // Upload progress
      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        let responseJson;
        try {
          responseJson = JSON.parse(xhr.responseText);
        } catch {
          responseJson = { success: false, error: { message: xhr.statusText || 'Server communication error' } };
        }

        if (xhr.status >= 200 && xhr.status < 300 && responseJson.success) {
          // Record to local session history
          this.recordJobHistory(responseJson);
          resolve(responseJson);
        } else {
          const errMessage = responseJson.error?.message || `Request failed with status ${xhr.status}`;
          reject(new Error(errMessage));
        }
      };

      xhr.onerror = async () => {
        // Automatic Offline Fallback: If network failed, attempt processing locally in browser memory
        if (typeof PDFNovaOffline !== 'undefined' && PDFNovaOffline.isAvailable()) {
          try {
            if (typeof showToast === 'function') {
              showToast('Server unreachable. Running local offline PDF engine...', 'info', 4000);
            }
            if (typeof onProgress === 'function') onProgress(60);
            const offlineResult = await PDFNovaOffline.process(endpoint, formData);
            if (typeof onProgress === 'function') onProgress(100);
            return resolve(offlineResult);
          } catch (offlineErr) {
            return reject(new Error(offlineErr.message || 'Offline processing failed.'));
          }
        }
        reject(new Error('Network error. Unable to reach PDFNova server.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Processing timed out. Please try with smaller files.'));
      };

      xhr.timeout = 120000; // 2 minutes
      xhr.send(formData);
    });
  },

  /**
   * Deletes a temporary job immediately from the server
   */
  async deleteJob(jobId, token) {
    const url = `${this.getBaseUrl()}/api/jobs/${encodeURIComponent(jobId)}?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { method: 'DELETE' });
    const json = await res.json().catch(() => ({ success: false }));
    if (res.ok && json.success) {
      this.removeJobHistory(jobId);
      return true;
    }
    throw new Error(json.error?.message || 'Failed to delete file.');
  },

  /**
   * Checks system capabilities (LibreOffice, OCR, Storage)
   */
  async getCapabilities() {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/system/capabilities`);
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Session Job History helpers
   */
  getJobHistory() {
    try {
      return JSON.parse(sessionStorage.getItem('pdfnova_recent_jobs') || '[]');
    } catch {
      return [];
    }
  },

  recordJobHistory(jobData) {
    try {
      const history = this.getJobHistory();
      // Prepend recent job
      history.unshift({
        jobId: jobData.jobId,
        token: jobData.token,
        downloadUrl: `${this.getBaseUrl()}${jobData.downloadUrl}`,
        fileName: jobData.downloadFileName || 'document.pdf',
        expiresAt: jobData.expiresAt,
        createdAt: new Date().toISOString()
      });
      sessionStorage.setItem('pdfnova_recent_jobs', JSON.stringify(history.slice(0, 10)));
    } catch (e) {
      console.warn('Could not save job history to sessionStorage', e);
    }
  },

  removeJobHistory(jobId) {
    try {
      const history = this.getJobHistory().filter(j => j.jobId !== jobId);
      sessionStorage.setItem('pdfnova_recent_jobs', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not update job history', e);
    }
  },

  formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
};

// Check backend connection when running on VS Code Live Server or external dev ports
if (PDFNovaAPI.getBaseUrl()) {
  window.addEventListener('DOMContentLoaded', () => {
    fetch(`${PDFNovaAPI.getBaseUrl()}/api/health`)
      .then(r => r.json())
      .then(data => {
        if (data && data.status === 'healthy') {
          console.log('[PDFNova] Live Server successfully connected to Express backend at http://localhost:3000');
        }
      })
      .catch(() => {
        console.warn('[PDFNova] Backend server not detected on http://localhost:3000');
        setTimeout(() => {
          if (typeof showToast === 'function') {
            showToast('Node.js backend is offline. Please run "npm start" in your terminal to process PDFs.', 'error', 8000);
          }
        }, 800);
      });
  });
}

// Global exports so PDFNovaAPI, api, and API are accessible everywhere
if (typeof window !== 'undefined') {
  window.PDFNovaAPI = PDFNovaAPI;
  window.api = PDFNovaAPI;
  window.API = PDFNovaAPI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFNovaAPI;
}

