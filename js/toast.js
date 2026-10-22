/**
 * PDFNova High-Performance Toast System
 * Non-blocking, GPU-accelerated micro-notifications
 */
(function() {
  let container = null;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'pdfnova-toast-container';
      document.body.appendChild(container);
    }
  }

  window.showToast = function(message, type = 'info', duration = 3500) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `pdfnova-toast ${type}`;

    const iconMap = {
      success: '✓',
      error: '✕',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <div class="pdfnova-toast-icon">${iconMap[type] || 'ℹ'}</div>
      <div class="pdfnova-toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const timer = setTimeout(() => {
      dismissToast(toast);
    }, duration);

    toast.addEventListener('click', () => {
      clearTimeout(timer);
      dismissToast(toast);
    });
  };

  function dismissToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }

  // Instant Page Prefetcher on Mouse Hover
  document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');

    // Only prefetch internal relative HTML links
    if (href && !href.startsWith('http') && !href.startsWith('#') && href.endsWith('.html')) {
      if (!document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
        const prefetch = document.createElement('link');
        prefetch.rel = 'prefetch';
        prefetch.href = href;
        document.head.appendChild(prefetch);
      }
    }
  }, { passive: true });
})();
