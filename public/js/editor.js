/**
 * PDFNova PDF Editor & Workspace
 * Powered by PDF.js for rendering and canvas overlays
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check PDF.js availability
  if (typeof pdfjsLib === 'undefined') {
    console.error('PDF.js library not loaded');
    return;
  }

  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';

  // DOM Elements
  const openFileBtn = document.getElementById('openFileBtn');
  const fileInput = document.getElementById('editorFileInput');
  const downloadBtn = document.getElementById('downloadPdfBtn');
  const pdfTitleEl = document.getElementById('editorDocTitle');
  const thumbnailsContainer = document.getElementById('thumbnailsContainer');
  const pdfCanvas = document.getElementById('pdfCanvas');
  const overlayCanvas = document.getElementById('overlayCanvas');
  const pageWrapper = document.getElementById('pageWrapper');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomLevelText = document.getElementById('zoomLevelText');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfoText = document.getElementById('pageInfoText');
  
  // Signature Modal Elements
  const sigModal = document.getElementById('sigModal');
  const closeSigModalBtn = document.getElementById('closeSigModalBtn');
  const clearSigBtn = document.getElementById('clearSigBtn');
  const applySigBtn = document.getElementById('applySigBtn');
  const sigPad = document.getElementById('sigPad');

  // State
  let currentFile = null;
  let pdfDoc = null;
  let currentPage = 1;
  let totalPages = 0;
  let scale = 1.25;
  let activeTool = 'select'; // select, text, highlight, rectangle, signature
  let annotations = []; // { pageIndex, type, xPercent, yPercent, widthPercent, heightPercent, ... }
  let pageRotations = {}; // pageIndex -> degrees
  let deletedPages = [];

  // Signature drawing state
  let isDrawingSig = false;
  let sigCtx = null;

  if (sigPad) {
    sigCtx = sigPad.getContext('2d');
    sigPad.width = 460;
    sigPad.height = 180;
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#0F172A';

    sigPad.addEventListener('mousedown', (e) => {
      isDrawingSig = true;
      sigCtx.beginPath();
      const rect = sigPad.getBoundingClientRect();
      sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    sigPad.addEventListener('mousemove', (e) => {
      if (!isDrawingSig) return;
      const rect = sigPad.getBoundingClientRect();
      sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      sigCtx.stroke();
    });

    window.addEventListener('mouseup', () => { isDrawingSig = false; });

    if (clearSigBtn) {
      clearSigBtn.addEventListener('click', () => {
        sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
      });
    }

    if (applySigBtn) {
      applySigBtn.addEventListener('click', () => {
        const dataUrl = sigPad.toDataURL('image/png');
        addAnnotation({
          type: 'signature',
          imageData: dataUrl,
          xPercent: 35,
          yPercent: 40,
          widthPercent: 30
        });
        sigModal.classList.remove('open');
      });
    }

    if (closeSigModalBtn) {
      closeSigModalBtn.addEventListener('click', () => sigModal.classList.remove('open'));
    }
  }

  // File Picker
  if (openFileBtn && fileInput) {
    openFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadPdfFile(e.target.files[0]);
      }
    });
  }

  async function loadPdfFile(file) {
    currentFile = file;
    if (pdfTitleEl) pdfTitleEl.textContent = file.name;
    const arrayBuffer = await file.arrayBuffer();

    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      annotations = [];
      pageRotations = {};
      deletedPages = [];

      renderThumbnails();
      renderPage(currentPage);
    } catch (err) {
      alert(`Could not open PDF: ${err.message}`);
    }
  }

  // Render Thumbnails
  async function renderThumbnails() {
    if (!thumbnailsContainer || !pdfDoc) return;
    thumbnailsContainer.innerHTML = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (deletedPages.includes(pageNum - 1)) continue;

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });

      const thumbDiv = document.createElement('div');
      thumbDiv.className = `thumb-item ${pageNum === currentPage ? 'active' : ''}`;
      thumbDiv.dataset.page = pageNum;

      const canvas = document.createElement('canvas');
      canvas.className = 'thumb-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderCtx = {
        canvasContext: canvas.getContext('2d'),
        viewport
      };

      await page.render(renderCtx).promise;

      thumbDiv.appendChild(canvas);
      thumbDiv.innerHTML += `<div class="thumb-label">${pageNum}</div>`;

      thumbDiv.addEventListener('click', () => {
        currentPage = pageNum;
        document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
        thumbDiv.classList.add('active');
        renderPage(currentPage);
      });

      thumbnailsContainer.appendChild(thumbDiv);
    }
  }

  // Render Active Page
  async function renderPage(num) {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(num);

    const rotation = (pageRotations[num - 1] || 0);
    const viewport = page.getViewport({ scale, rotation });

    const ctx = pdfCanvas.getContext('2d');
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;

    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;
    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.height = `${viewport.height}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport
    };

    await page.render(renderContext).promise;

    if (pageInfoText) pageInfoText.textContent = `${num} / ${totalPages}`;
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(scale * 100)}%`;

    renderOverlayAnnotations();
  }

  // Overlay Canvas for Annotations
  function renderOverlayAnnotations() {
    const oCtx = overlayCanvas.getContext('2d');
    oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const pageAnns = annotations.filter(a => a.pageIndex === (currentPage - 1));

    pageAnns.forEach(ann => {
      const x = (ann.xPercent / 100) * overlayCanvas.width;
      const y = (ann.yPercent / 100) * overlayCanvas.height;

      if (ann.type === 'text') {
        oCtx.font = `${ann.fontSize || 16}px Inter, sans-serif`;
        oCtx.fillStyle = ann.color || '#E94350';
        oCtx.fillText(ann.text, x, y);
      } else if (ann.type === 'highlight') {
        const w = (ann.widthPercent / 100) * overlayCanvas.width;
        const h = (ann.heightPercent / 100) * overlayCanvas.height;
        oCtx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        oCtx.fillRect(x, y, w, h);
      } else if (ann.type === 'rectangle') {
        const w = (ann.widthPercent / 100) * overlayCanvas.width;
        const h = (ann.heightPercent / 100) * overlayCanvas.height;
        oCtx.strokeStyle = ann.color || '#E94350';
        oCtx.lineWidth = 2;
        oCtx.strokeRect(x, y, w, h);
      } else if (ann.type === 'signature' && ann.imageData) {
        const img = new Image();
        img.src = ann.imageData;
        img.onload = () => {
          const w = (ann.widthPercent / 100) * overlayCanvas.width;
          const h = (w / img.width) * img.height;
          oCtx.drawImage(img, x, y, w, h);
        };
      }
    });
  }

  function addAnnotation(ann) {
    annotations.push({
      pageIndex: currentPage - 1,
      ...ann
    });
    renderOverlayAnnotations();
  }

  // Overlay Click to add active tool
  overlayCanvas.addEventListener('click', (e) => {
    if (activeTool === 'select') return;

    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = (x / overlayCanvas.width) * 100;
    const yPercent = (y / overlayCanvas.height) * 100;

    if (activeTool === 'text') {
      const text = prompt('Enter annotation text:', 'PDFNova Note');
      if (text) {
        addAnnotation({
          type: 'text',
          text,
          xPercent,
          yPercent,
          color: '#E94350',
          fontSize: 16
        });
      }
    } else if (activeTool === 'highlight') {
      addAnnotation({
        type: 'highlight',
        xPercent,
        yPercent,
        widthPercent: 20,
        heightPercent: 3
      });
    } else if (activeTool === 'rectangle') {
      addAnnotation({
        type: 'rectangle',
        xPercent,
        yPercent,
        widthPercent: 25,
        heightPercent: 15,
        color: '#E94350'
      });
    }
  });

  // Toolbar Actions
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;

      if (activeTool === 'signature') {
        sigModal.classList.add('open');
      }
    });
  });

  // Page Action Buttons
  document.getElementById('rotateLeftBtn')?.addEventListener('click', () => {
    const cur = pageRotations[currentPage - 1] || 0;
    pageRotations[currentPage - 1] = (cur - 90 + 360) % 360;
    renderPage(currentPage);
  });

  document.getElementById('rotateRightBtn')?.addEventListener('click', () => {
    const cur = pageRotations[currentPage - 1] || 0;
    pageRotations[currentPage - 1] = (cur + 90) % 360;
    renderPage(currentPage);
  });

  document.getElementById('deletePageBtn')?.addEventListener('click', () => {
    if (!deletedPages.includes(currentPage - 1)) {
      deletedPages.push(currentPage - 1);
      alert(`Page ${currentPage} marked for deletion.`);
      renderThumbnails();
      if (currentPage < totalPages) {
        currentPage++;
        renderPage(currentPage);
      }
    }
  });

  document.getElementById('duplicatePageBtn')?.addEventListener('click', () => {
    alert(`Page ${currentPage} will be duplicated on download.`);
  });

  // Zoom
  zoomInBtn?.addEventListener('click', () => {
    if (scale < 3) {
      scale += 0.25;
      renderPage(currentPage);
    }
  });

  zoomOutBtn?.addEventListener('click', () => {
    if (scale > 0.5) {
      scale -= 0.25;
      renderPage(currentPage);
    }
  });

  // Pagination
  prevPageBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage(currentPage);
    }
  });

  nextPageBtn?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderPage(currentPage);
    }
  });

  // Save & Download with reliable Blob trigger
  downloadBtn?.addEventListener('click', async () => {
    if (!currentFile) {
      if (typeof showToast === 'function') showToast('Please open a PDF file first.', 'error');
      else alert('Please open a PDF file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', currentFile);

    const modifications = {
      rotations: pageRotations,
      deletedPages,
      annotations
    };

    formData.append('modifications', JSON.stringify(modifications));

    downloadBtn.textContent = 'Saving...';
    downloadBtn.disabled = true;

    try {
      if (typeof showToast === 'function') showToast('Applying modifications & saving PDF...', 'info');
      const res = await PDFNovaAPI.upload('/api/pdf/save-editor', formData);
      const rawUrl = res.downloadUrl || '';
      const downloadFullUrl = (rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
        ? rawUrl
        : `${PDFNovaAPI.getBaseUrl()}${rawUrl}`;
      const dlFileName = res.downloadFileName || 'edited_document.pdf';

      const tempLink = document.createElement('a');
      tempLink.href = downloadFullUrl;
      tempLink.download = dlFileName;
      document.body.appendChild(tempLink);
      tempLink.click();
      setTimeout(() => tempLink.remove(), 1000);

      if (typeof showToast === 'function') showToast('Edited PDF saved and downloaded!', 'success');
      else alert('Document saved successfully!');
    } catch (err) {
      if (typeof showToast === 'function') showToast(`Failed to save: ${err.message}`, 'error');
      else alert(`Failed to save: ${err.message}`);
    } finally {
      downloadBtn.textContent = 'Download';
      downloadBtn.disabled = false;
    }
  });

  // Default Sample PDF loader for instant live preview demo (offline supported)
  createSampleDocument();

  async function createSampleDocument() {
    // If no file loaded after 300ms, create a pleasant demo PDF using local PDFLib
    try {
      let PDFDocument, StandardFonts, rgb;
      if (typeof PDFLib !== 'undefined') {
        PDFDocument = PDFLib.PDFDocument;
        StandardFonts = PDFLib.StandardFonts;
        rgb = PDFLib.rgb;
      } else {
        const mod = await import('./vendor/pdflib/pdf-lib.min.js').catch(() => ({}));
        if (window.PDFLib) {
          PDFDocument = window.PDFLib.PDFDocument;
          StandardFonts = window.PDFLib.StandardFonts;
          rgb = window.PDFLib.rgb;
        }
      }
      if (PDFDocument) {
        const demoDoc = await PDFDocument.create();
        const font = await demoDoc.embedFont(StandardFonts.Helvetica);
        const bold = await demoDoc.embedFont(StandardFonts.HelveticaBold);

        const page1 = demoDoc.addPage([595, 842]);
        page1.drawText('Welcome to PDFNova PDF Editor', { x: 50, y: 760, size: 24, font: bold, color: rgb(0.91, 0.26, 0.31) });
        page1.drawText('This is a live interactive demonstration document.', { x: 50, y: 720, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
        page1.drawText('1. Use the top toolbar to Zoom, add Text annotations, or Stamp your signature.', { x: 50, y: 680, size: 12, font, color: rgb(0.4, 0.4, 0.4) });
        page1.drawText('2. Use the right sidebar to Rotate pages, Delete unwanted pages, or Duplicate.', { x: 50, y: 650, size: 12, font, color: rgb(0.4, 0.4, 0.4) });
        page1.drawText('3. Click "Download" to export your changes in high fidelity.', { x: 50, y: 620, size: 12, font, color: rgb(0.4, 0.4, 0.4) });

        const page2 = demoDoc.addPage([595, 842]);
        page2.drawText('Page 2: Secure Sandbox Verification', { x: 50, y: 760, size: 20, font: bold, color: rgb(0.44, 0.27, 0.82) });
        page2.drawText('All files are isolated in temporary job folders and automatically wiped.', { x: 50, y: 720, size: 13, font, color: rgb(0.3, 0.3, 0.3) });

        const pdfBytes = await demoDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const file = new File([blob], 'Welcome_PDFNova_Sample.pdf', { type: 'application/pdf' });
        loadPdfFile(file);
      }
    } catch {
      // Fallback
    }
  }
});
