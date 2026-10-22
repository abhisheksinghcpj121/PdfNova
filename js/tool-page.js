/**
 * PDFNova Reusable Tool Page Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  // Parse tool id from URL
  const params = new URLSearchParams(window.location.search);
  const toolId = params.get('tool') || 'merge';

  const toolConfig = PDF_TOOLS.find(t => t.id === toolId) || PDF_TOOLS[0];

  // DOM Elements
  const toolTitle = document.getElementById('toolTitle');
  const toolDesc = document.getElementById('toolDesc');
  const toolIcon = document.getElementById('toolIcon');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  const dropzone = document.getElementById('toolDropzone');
  const fileInput = document.getElementById('toolFileInput');
  const dropzoneSubtitle = document.getElementById('dropzoneSubtitle');
  const selectedFilesPanel = document.getElementById('selectedFilesPanel');
  const fileItemsList = document.getElementById('fileItemsList');
  const selectedCountLabel = document.getElementById('selectedCountLabel');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const tipsList = document.getElementById('tipsList');
  const optionsContainer = document.getElementById('optionsContainer');
  const actionButton = document.getElementById('actionButton');
  const actionButtonText = document.getElementById('actionButtonText');
  const progressCard = document.getElementById('progressCard');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressPercentText = document.getElementById('progressPercentText');
  const progressStatusText = document.getElementById('progressStatusText');
  const resultCard = document.getElementById('resultCard');
  const downloadBtn = document.getElementById('downloadBtn');
  const deleteNowBtn = document.getElementById('deleteNowBtn');
  const expiryTimerText = document.getElementById('expiryTimerText');
  const statsComparison = document.getElementById('statsComparison');
  const originalSizeVal = document.getElementById('originalSizeVal');
  const outputSizeVal = document.getElementById('outputSizeVal');
  const savedPercentVal = document.getElementById('savedPercentVal');
  const processAnotherBtn = document.getElementById('processAnotherBtn');
  const sidebarToolsList = document.getElementById('sidebarToolsList');
  const sidebarSearchInput = document.getElementById('sidebarSearchInput');

  // State
  let selectedFiles = [];
  let currentJobResult = null;
  let countdownInterval = null;

  // Initialize UI with toolConfig
  function initTool() {
    document.title = `${toolConfig.name} - PDFNova`;
    if (toolTitle) toolTitle.textContent = toolConfig.name;
    if (toolDesc) toolDesc.textContent = toolConfig.description;
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = toolConfig.name;

    if (toolIcon) {
      toolIcon.className = `tool-header-icon ${toolConfig.icon}`;
      toolIcon.innerHTML = toolConfig.iconSvg;
    }

    if (actionButtonText) {
      actionButtonText.textContent = `${toolConfig.buttonText} →`;
    }

    if (fileInput) {
      fileInput.multiple = Boolean(toolConfig.multiple);
      fileInput.accept = toolConfig.accept;
    }

    if (dropzoneSubtitle) {
      dropzoneSubtitle.textContent = toolConfig.multiple
        ? 'You can select multiple files or drag a folder'
        : 'Select a single document to process';
    }

    // Render Tips
    if (tipsList) {
      tipsList.innerHTML = '';
      toolConfig.tips.forEach(tip => {
        const li = document.createElement('li');
        li.className = 'tips-item';
        li.innerHTML = `<span class="dot"></span><span>${tip}</span>`;
        tipsList.appendChild(li);
      });
    }

    // Render Options Form
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      if (!toolConfig.options || toolConfig.options.length === 0) {
        optionsContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">Default standard settings will be applied.</p>`;
      } else {
        toolConfig.options.forEach(opt => {
          const formGroup = document.createElement('div');
          formGroup.className = 'form-group';

          const label = document.createElement('label');
          label.className = 'form-label';
          label.textContent = opt.label;
          formGroup.appendChild(label);

          if (opt.type === 'select') {
            const select = document.createElement('select');
            select.className = 'form-select';
            select.id = `opt_${opt.id}`;
            opt.options.forEach(o => {
              const op = document.createElement('option');
              op.value = o.value;
              op.textContent = o.label;
              if (o.value === opt.defaultValue) op.selected = true;
              select.appendChild(op);
            });
            formGroup.appendChild(select);
          } else {
            const input = document.createElement('input');
            input.type = opt.type || 'text';
            input.className = 'form-input';
            input.id = `opt_${opt.id}`;
            input.placeholder = opt.placeholder || '';
            input.value = opt.defaultValue || '';
            formGroup.appendChild(input);
          }

          optionsContainer.appendChild(formGroup);
        });
      }
    }

    // Populate Sidebar Tools
    renderSidebarTools('');
  }

  function renderSidebarTools(filter = '') {
    if (!sidebarToolsList) return;
    sidebarToolsList.innerHTML = '';

    const list = PDF_TOOLS.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
    list.forEach(t => {
      const li = document.createElement('li');
      li.className = `sidebar-tool-item ${t.id === toolConfig.id ? 'active' : ''}`;
      li.innerHTML = `
        <a href="tool.html?tool=${t.id}">
          <span style="display:flex;align-items:center;">${t.iconSvg}</span>
          <span>${t.name}</span>
        </a>
      `;
      sidebarToolsList.appendChild(li);
    });
  }

  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => {
      renderSidebarTools(e.target.value.trim());
    });
  }

  // File Upload Handlers
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addFiles(Array.from(files));
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(Array.from(e.target.files));
      }
    });
  }

  function addFiles(newFiles) {
    if (!toolConfig.multiple) {
      selectedFiles = [newFiles[0]];
    } else {
      // Append without exceeding max batch
      selectedFiles = [...selectedFiles, ...newFiles].slice(0, 20);
    }
    renderSelectedFiles();
  }

  function renderSelectedFiles() {
    if (!selectedFilesPanel || !fileItemsList) return;

    if (selectedFiles.length === 0) {
      selectedFilesPanel.style.display = 'none';
      if (actionButton) actionButton.disabled = true;
      return;
    }

    selectedFilesPanel.style.display = 'block';
    if (selectedCountLabel) {
      selectedCountLabel.textContent = `(${selectedFiles.length})`;
    }
    if (actionButton) actionButton.disabled = false;

    fileItemsList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.draggable = Boolean(toolConfig.multiple);
      item.dataset.index = index;

      item.innerHTML = `
        <div class="file-item-left">
          ${toolConfig.multiple ? `<span class="drag-handle" title="Drag to reorder">⋮⋮</span>` : ''}
          <div class="tool-card-icon ${toolConfig.icon}" style="width:34px;height:34px;font-size:1rem;border-radius:6px;">
            ${toolConfig.iconSvg}
          </div>
          <div>
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-size">${PDFNovaAPI.formatBytes(file.size)}</div>
          </div>
        </div>
        <button type="button" class="remove-file-btn" data-index="${index}" title="Remove file">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      // Remove handler
      item.querySelector('.remove-file-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderSelectedFiles();
      });

      // Drag to reorder
      if (toolConfig.multiple) {
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', index);
          item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', () => {
          item.style.opacity = '1';
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
        });

        item.addEventListener('drop', (e) => {
          e.preventDefault();
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const toIndex = index;
          if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            const moved = selectedFiles.splice(fromIndex, 1)[0];
            selectedFiles.splice(toIndex, 0, moved);
            renderSelectedFiles();
          }
        });
      }

      fileItemsList.appendChild(item);
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      selectedFiles = [];
      renderSelectedFiles();
    });
  }

  // Action Button (Run Tool)
  if (actionButton) {
    actionButton.addEventListener('click', async () => {
      if (selectedFiles.length === 0) return;

      if (toolConfig.id === 'merge' && selectedFiles.length < 2) {
        if (typeof showToast === 'function') {
          showToast('Please select at least 2 PDF files to merge.', 'error', 4500);
        } else {
          alert('Please select at least 2 PDF files to merge.');
        }
        return;
      }

      if (toolConfig.id === 'delete-pages') {
        const pagesInput = document.getElementById('opt_pages');
        if (!pagesInput || !pagesInput.value.trim()) {
          if (typeof showToast === 'function') {
            showToast('Please enter page numbers to delete (e.g. 2, 4).', 'error', 4500);
          } else {
            alert('Please enter page numbers to delete.');
          }
          pagesInput?.focus();
          return;
        }
      }

      if (toolConfig.id === 'protect') {
        const pwInput = document.getElementById('opt_password');
        if (!pwInput || !pwInput.value.trim()) {
          if (typeof showToast === 'function') {
            showToast('Please enter a secure password to encrypt this PDF.', 'error', 4500);
          } else {
            alert('Please enter a password to protect.');
          }
          pwInput?.focus();
          return;
        }
      }

      if (toolConfig.id === 'unlock') {
        const pwInput = document.getElementById('opt_password');
        if (!pwInput || !pwInput.value.trim()) {
          if (typeof showToast === 'function') {
            showToast('Please enter the password to decrypt this PDF.', 'error', 4500);
          } else {
            alert('Please enter the password to unlock.');
          }
          pwInput?.focus();
          return;
        }
      }

      const formData = new FormData();

      if (toolConfig.multiple) {
        selectedFiles.forEach(file => formData.append('files', file));
      } else {
        formData.append('file', selectedFiles[0]);
      }

      // Collect option inputs
      if (toolConfig.options) {
        toolConfig.options.forEach(opt => {
          const el = document.getElementById(`opt_${opt.id}`);
          if (el) {
            formData.append(opt.id, el.value);
          }
        });
      }

      // Transition to progress view
      if (dropzone) dropzone.style.display = 'none';
      if (selectedFilesPanel) selectedFilesPanel.style.display = 'none';
      if (actionButton) actionButton.style.display = 'none';
      if (progressCard) {
        progressCard.style.display = 'block';
        updateProgress(5, 'Uploading document to isolated job sandbox...');
      }

      try {
        const response = await PDFNovaAPI.upload(toolConfig.endpoint, formData, (percent) => {
          if (percent < 95) {
            updateProgress(percent, `Uploading file (${percent}%)...`);
          } else {
            updateProgress(95, 'Processing and validating document on server...');
          }
        });

        updateProgress(100, 'Finishing up...');
        if (typeof showToast === 'function') {
          showToast('Document processed successfully!', 'success');
        }
        setTimeout(() => {
          showResult(response);
        }, 350);

      } catch (err) {
        if (typeof showToast === 'function') {
          showToast(err.message, 'error', 5000);
        } else {
          alert(`Error: ${err.message}`);
        }
        // Reset view
        if (progressCard) progressCard.style.display = 'none';
        if (dropzone) dropzone.style.display = 'block';
        renderSelectedFiles();
        if (actionButton) actionButton.style.display = 'inline-flex';
      }
    });
  }

  function updateProgress(percent, message) {
    if (progressBarFill) progressBarFill.style.width = `${percent}%`;
    if (progressPercentText) progressPercentText.textContent = `${percent}%`;
    if (progressStatusText) progressStatusText.textContent = message;
  }

  // Universal multi-strategy reliable file downloader
  function triggerDownload(url, fileName) {
    if (typeof showToast === 'function') {
      showToast('Starting your download...', 'info', 2500);
    }

    // Strategy 1: Direct native anchor click
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document.pdf';
      a.target = '_self';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1000);
    } catch (err) {
      console.warn('Anchor download fallback', err);
    }

    // Strategy 2: Invisible iframe fallback for server endpoints (skip for local blob URLs)
    if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
      setTimeout(() => {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = url;
          document.body.appendChild(iframe);
          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 20000);
        } catch (e) {}
      }, 400);
    }
  }

  function showResult(jobResult) {
    currentJobResult = jobResult;
    if (progressCard) progressCard.style.display = 'none';
    if (resultCard) {
      resultCard.style.display = 'block';
      setTimeout(() => {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    // Handle offline blob URLs vs. server relative endpoints
    const rawUrl = jobResult.downloadUrl || '';
    const downloadFullUrl = (rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
      ? rawUrl
      : `${PDFNovaAPI.getBaseUrl()}${rawUrl}`;

    const dlFileName = jobResult.downloadFileName || 'document.pdf';

    if (downloadBtn) {
      downloadBtn.href = downloadFullUrl;
      downloadBtn.setAttribute('download', dlFileName);
      downloadBtn.setAttribute('target', '_self');
      // Native click handler for immediate browser attachment download
      downloadBtn.onclick = () => {
        if (typeof showToast === 'function') {
          showToast('Downloading your file...', 'info', 2000);
        }
      };
    }

    // Comparison Stats
    if (originalSizeVal && outputSizeVal) {
      const orig = jobResult.stats?.originalSize || (selectedFiles[0] ? selectedFiles[0].size : 0);
      const out = jobResult.stats?.outputSize || jobResult.stats?.newSize || 0;
      
      if (orig > 0 && out > 0) {
        if (statsComparison) statsComparison.style.display = 'flex';
        originalSizeVal.textContent = PDFNovaAPI.formatBytes(orig);
        outputSizeVal.textContent = PDFNovaAPI.formatBytes(out);

        if (toolConfig.id === 'compress') {
          const savedPct = jobResult.stats?.savedPercent || 0;
          if (savedPct > 0) {
            savedPercentVal.textContent = `-${savedPct}%`;
            savedPercentVal.style.color = '#10B981';
            savedPercentVal.style.fontWeight = '800';
          } else {
            savedPercentVal.textContent = 'Optimized';
            savedPercentVal.style.color = '#7046D0';
            savedPercentVal.style.fontWeight = '700';
            if (typeof showToast === 'function') {
              showToast('Document was already at optimal compression! Ready to download.', 'info', 4000);
            }
          }
        } else if (savedPercentVal && jobResult.stats?.savedPercent) {
          savedPercentVal.textContent = `(-${jobResult.stats.savedPercent}%)`;
          savedPercentVal.style.color = '#10B981';
        }
      } else if (statsComparison && toolConfig.id !== 'compress') {
        statsComparison.style.display = 'none';
      }
    }

    // Live countdown timer
    if (jobResult.expiresAt && expiryTimerText) {
      startExpiryCountdown(new Date(jobResult.expiresAt));
    }

    // Automatic download trigger
    setTimeout(() => {
      triggerDownload(downloadFullUrl, dlFileName);
    }, 600);
  }

  function startExpiryCountdown(expiresDate) {
    if (countdownInterval) clearInterval(countdownInterval);

    function tick() {
      const now = new Date();
      const diffMs = expiresDate.getTime() - now.getTime();
      if (diffMs <= 0) {
        expiryTimerText.textContent = 'Expired and removed from server.';
        if (downloadBtn) downloadBtn.classList.add('disabled');
        clearInterval(countdownInterval);
        return;
      }
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      expiryTimerText.textContent = `Auto-deletes from server in ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }

    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // Delete Now Handler
  if (deleteNowBtn) {
    deleteNowBtn.addEventListener('click', async () => {
      if (!currentJobResult) return;
      if (!confirm('Are you sure you want to permanently delete this document from the server now?')) return;

      try {
        await PDFNovaAPI.deleteJob(currentJobResult.jobId, currentJobResult.token);
        if (typeof showToast === 'function') {
          showToast('Document permanently removed from server storage.', 'success');
        } else {
          alert('Your file has been permanently deleted from server storage.');
        }
        resetToolState();
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast(`Failed to delete: ${err.message}`, 'error');
        } else {
          alert(`Failed to delete: ${err.message}`);
        }
      }
    });
  }

  // Process Another File
  if (processAnotherBtn) {
    processAnotherBtn.addEventListener('click', resetToolState);
  }

  function resetToolState() {
    selectedFiles = [];
    currentJobResult = null;
    if (countdownInterval) clearInterval(countdownInterval);

    if (resultCard) resultCard.style.display = 'none';
    if (progressCard) progressCard.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
    if (actionButton) {
      actionButton.style.display = 'inline-flex';
      actionButton.disabled = true;
    }
    renderSelectedFiles();
  }

  // Init
  initTool();
});
