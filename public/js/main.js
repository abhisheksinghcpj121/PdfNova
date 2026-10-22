/**
 * PDFNova Homepage Script
 */
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const popularToolsGrid = document.getElementById('popularToolsGrid');
  const categoryPillsContainer = document.getElementById('categoryPills');
  const categoryCardsRow = document.getElementById('categoryCardsRow');
  const searchInput = document.getElementById('toolSearchInput');
  const heroDropzone = document.getElementById('heroDropzone');
  const heroFileInput = document.getElementById('heroFileInput');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  // Render Popular Tools
  function renderTools(filterText = '', categoryFilter = 'all') {
    if (!popularToolsGrid) return;
    popularToolsGrid.innerHTML = '';

    const filtered = PDF_TOOLS.filter(tool => {
      const matchText = filterText === '' ||
        tool.name.toLowerCase().includes(filterText.toLowerCase()) ||
        tool.description.toLowerCase().includes(filterText.toLowerCase());

      const matchCat = categoryFilter === 'all' || tool.category === categoryFilter;

      return matchText && matchCat;
    });

    if (filtered.length === 0) {
      popularToolsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 1.1rem; font-weight: 600;">No tools found matching "${filterText}"</p>
          <button class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="resetFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    filtered.forEach(tool => {
      const card = document.createElement('a');
      card.href = `tool.html?tool=${tool.id}`;
      card.className = 'tool-card';
      card.innerHTML = `
        <div class="tool-card-icon ${tool.icon}">
          ${tool.iconSvg}
        </div>
        <div>
          <h3 class="tool-card-title">${tool.name}</h3>
          <p class="tool-card-desc">${tool.description}</p>
        </div>
      `;
      popularToolsGrid.appendChild(card);
    });
  }

  // Render Categories
  function renderCategories() {
    if (categoryPillsContainer) {
      categoryPillsContainer.innerHTML = `
        <button class="cat-pill active" data-cat="all">All Tools <span class="count">(${PDF_TOOLS.length})</span></button>
      `;
      CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-pill';
        btn.setAttribute('data-cat', cat.id);
        const count = PDF_TOOLS.filter(t => t.category === cat.id).length;
        btn.innerHTML = `${cat.name} <span class="count">(${count})</span>`;
        categoryPillsContainer.appendChild(btn);
      });

      categoryPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (!pill) return;
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.getAttribute('data-cat');
        renderTools(searchInput?.value || '', cat);
      });
    }

    if (categoryCardsRow) {
      categoryCardsRow.innerHTML = '';
      CATEGORIES.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.setAttribute('data-cat', cat.id);
        const count = PDF_TOOLS.filter(t => t.category === cat.id).length;
        card.innerHTML = `
          <div class="category-card-icon ${cat.iconClass}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="category-card-name">${cat.name}</div>
          <div class="category-card-count">${count} tools</div>
        `;
        card.addEventListener('click', () => {
          document.querySelectorAll('.cat-pill').forEach(p => {
            if (p.getAttribute('data-cat') === cat.id) {
              p.classList.add('active');
            } else {
              p.classList.remove('active');
            }
          });
          renderTools(searchInput?.value || '', cat.id);
          // Scroll to tools grid
          document.getElementById('popularTools')?.scrollIntoView({ behavior: 'smooth' });
        });
        categoryCardsRow.appendChild(card);
      });
    }
  }

  window.resetFilters = function() {
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.cat-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-cat') === 'all');
    });
    renderTools('', 'all');
  };

  // Search Input Handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const activePill = document.querySelector('.cat-pill.active');
      const cat = activePill ? activePill.getAttribute('data-cat') : 'all';
      renderTools(e.target.value.trim(), cat);
    });

    // Keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  // Hero Upload Dropzone
  if (heroDropzone && heroFileInput) {
    heroDropzone.addEventListener('click', () => heroFileInput.click());

    ['dragenter', 'dragover'].forEach(name => {
      heroDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        heroDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      heroDropzone.addEventListener(name, (e) => {
        e.preventDefault();
        heroDropzone.classList.remove('dragover');
      });
    });

    heroDropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleHeroFiles(files);
      }
    });

    heroFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleHeroFiles(e.target.files);
      }
    });
  }

  function handleHeroFiles(files) {
    const firstFile = files[0];
    const ext = firstFile.name.split('.').pop().toLowerCase();

    // Store files in session transfer cache
    window.droppedFiles = Array.from(files);

    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      window.location.href = 'tool.html?tool=jpg-to-pdf';
    } else if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)) {
      window.location.href = 'tool.html?tool=office-to-pdf';
    } else {
      // Default PDF: show quick chooser or route to merge if multiple, editor if single
      if (files.length > 1) {
        window.location.href = 'tool.html?tool=merge';
      } else {
        window.location.href = 'tool.html?tool=compress';
      }
    }
  }

  // FAQ Accordion
  document.querySelectorAll('.faq-question').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  });

  // Mobile Menu Drawer
  if (mobileMenuBtn && mobileDrawer && closeDrawerBtn) {
    mobileMenuBtn.addEventListener('click', () => mobileDrawer.classList.add('open'));
    closeDrawerBtn.addEventListener('click', () => mobileDrawer.classList.remove('open'));
  }

  // Initial render
  renderCategories();
  renderTools();

  // Register Service Worker for 100% Offline Support & PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('[PWA] ServiceWorker active for offline caching:', reg.scope);
        })
        .catch(err => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });
    });
  }

  // Offline / Online Status Monitor
  function updateOnlineStatus() {
    let offlineBanner = document.getElementById('offlineStatusBanner');
    if (!navigator.onLine) {
      if (!offlineBanner) {
        offlineBanner = document.createElement('div');
        offlineBanner.id = 'offlineStatusBanner';
        offlineBanner.className = 'offline-status-banner';
        offlineBanner.innerHTML = `
          <span>⚡ Offline Mode Active · Processing PDF files locally in your browser memory</span>
        `;
        document.body.prepend(offlineBanner);
      }
      offlineBanner.style.display = 'flex';
      if (typeof showToast === 'function') {
        showToast('You are offline. Running local browser PDF engine.', 'info', 4000);
      }
    } else if (offlineBanner) {
      offlineBanner.style.display = 'none';
      if (typeof showToast === 'function') {
        showToast('Back online! Cloud connection restored.', 'success', 3000);
      }
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  if (!navigator.onLine) updateOnlineStatus();
});
