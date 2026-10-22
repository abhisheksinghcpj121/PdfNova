/**
 * PDFNova Client-Side Offline Processing Engine
 * Powered by local PDF-lib bundle (public/vendor/pdflib/pdf-lib.min.js)
 * Processes PDF files 100% locally in browser memory when offline or disconnected
 */

const PDFNovaOffline = {
  isAvailable() {
    return typeof PDFLib !== 'undefined';
  },

  /**
   * Main dispatch router for offline processing
   */
  async process(endpoint, formData) {
    if (!this.isAvailable()) {
      throw new Error('Local offline PDF engine is initializing. Please retry in a moment.');
    }

    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

    // Helper: read File to Uint8Array
    async function fileToBytes(file) {
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    }

    // Helper: trigger virtual job result
    function createOfflineResult(pdfBytes, defaultName, stats = {}) {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      return {
        success: true,
        offline: true,
        jobId: 'offline_' + Math.random().toString(36).substring(2, 9),
        token: 'offline_token',
        downloadUrl: blobUrl,
        downloadFileName: defaultName,
        mimeType: 'application/pdf',
        stats: {
          outputSize: pdfBytes.length,
          pageCount: stats.pageCount || 1,
          ...stats
        }
      };
    }

    // 1. MERGE PDFs OFFLINE
    if (endpoint.includes('merge')) {
      const files = formData.getAll('files');
      if (!files || files.length < 2) throw new Error('Please select at least 2 PDF files to merge.');

      const mergedDoc = await PDFDocument.create();
      let totalOriginalSize = 0;

      for (const file of files) {
        totalOriginalSize += file.size;
        const bytes = await fileToBytes(file);
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(page => mergedDoc.addPage(page));
      }

      const outBytes = await mergedDoc.save();
      return createOfflineResult(outBytes, 'merged_document.pdf', {
        originalSize: totalOriginalSize,
        pageCount: mergedDoc.getPageCount()
      });
    }

    // 2. COMPRESS PDF OFFLINE
    if (endpoint.includes('compress')) {
      const file = formData.get('file');
      if (!file) throw new Error('Please upload a PDF to compress.');

      const bytes = await fileToBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const compressedBytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });

      const originalSize = bytes.length;
      const newSize = compressedBytes.length < originalSize ? compressedBytes.length : originalSize;
      const finalBytes = compressedBytes.length < originalSize ? compressedBytes : bytes;
      const savedBytes = Math.max(0, originalSize - newSize);
      const savedPercent = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

      return createOfflineResult(finalBytes, `compressed_${file.name || 'document.pdf'}`, {
        originalSize,
        newSize,
        savedBytes,
        savedPercent,
        alreadyOptimized: savedBytes === 0,
        pageCount: doc.getPageCount()
      });
    }

    // 3. ROTATE PDF OFFLINE
    if (endpoint.includes('rotate')) {
      const file = formData.get('file');
      const angle = parseInt(formData.get('angle') || '90', 10);
      const bytes = await fileToBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = doc.getPages();

      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + angle) % 360));
      });

      const outBytes = await doc.save();
      return createOfflineResult(outBytes, `rotated_${file.name || 'document.pdf'}`, {
        pageCount: pages.length
      });
    }

    // 4. DELETE PAGES OFFLINE
    if (endpoint.includes('delete-pages')) {
      const file = formData.get('file');
      const pagesStr = formData.get('pages') || '';
      const toDelete = pagesStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));

      const bytes = await fileToBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const totalPages = doc.getPageCount();

      // Sort descending so deletion doesn't shift earlier indices
      const sorted = [...new Set(toDelete)].filter(p => p >= 1 && p <= totalPages).sort((a, b) => b - a);
      if (sorted.length >= totalPages) {
        throw new Error('Cannot delete all pages of the document.');
      }

      sorted.forEach(p => doc.removePage(p - 1));
      const outBytes = await doc.save();
      return createOfflineResult(outBytes, `trimmed_${file.name || 'document.pdf'}`, {
        pageCount: doc.getPageCount()
      });
    }

    // 5. WATERMARK OFFLINE
    if (endpoint.includes('watermark')) {
      const file = formData.get('file');
      const text = formData.get('text') || 'CONFIDENTIAL';
      const bytes = await fileToBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const pages = doc.getPages();

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const fontSize = Math.min(width, height) / 8;
        page.drawText(text, {
          x: width / 4,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.91, 0.26, 0.31), // Coral
          opacity: 0.25,
          rotate: degrees(45)
        });
      });

      const outBytes = await doc.save();
      return createOfflineResult(outBytes, `watermarked_${file.name || 'document.pdf'}`, {
        pageCount: pages.length
      });
    }

    // 6. PAGE NUMBERS OFFLINE
    if (endpoint.includes('page-numbers')) {
      const file = formData.get('file');
      const bytes = await fileToBytes(file);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const totalPages = pages.length;

      pages.forEach((page, idx) => {
        const { width } = page.getSize();
        const stamp = `${idx + 1} of ${totalPages}`;
        page.drawText(stamp, {
          x: width - 80,
          y: 25,
          size: 10,
          font,
          color: rgb(0.3, 0.3, 0.3)
        });
      });

      const outBytes = await doc.save();
      return createOfflineResult(outBytes, `numbered_${file.name || 'document.pdf'}`, {
        pageCount: totalPages
      });
    }

    // 7. IMAGES TO PDF OFFLINE
    if (endpoint.includes('images-to-pdf')) {
      const files = formData.getAll('files');
      if (!files || files.length === 0) throw new Error('Please select images to convert.');

      const doc = await PDFDocument.create();

      for (const file of files) {
        const imgBytes = await fileToBytes(file);
        let embedded;
        if (file.type === 'image/png' || file.name.endsWith('.png')) {
          embedded = await doc.embedPng(imgBytes);
        } else {
          embedded = await doc.embedJpg(imgBytes);
        }

        const page = doc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height
        });
      }

      const outBytes = await doc.save();
      return createOfflineResult(outBytes, 'converted_images.pdf', {
        pageCount: doc.getPageCount()
      });
    }

    // 8. ORGANIZE PAGES OFFLINE
    if (endpoint.includes('organize')) {
      const file = formData.get('file');
      const orderStr = formData.get('order') || '';
      const bytes = await fileToBytes(file);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      const newDoc = await PDFDocument.create();
      let pageIndices = [];

      if (orderStr.trim()) {
        pageIndices = orderStr.split(',')
          .map(s => parseInt(s.trim(), 10) - 1)
          .filter(idx => !isNaN(idx) && idx >= 0 && idx < totalPages);
      }

      if (pageIndices.length === 0) {
        pageIndices = srcDoc.getPageIndices();
      }

      const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => newDoc.addPage(p));

      const outBytes = await newDoc.save();
      return createOfflineResult(outBytes, `organized_${file.name || 'document.pdf'}`, {
        pageCount: newDoc.getPageCount()
      });
    }

    // 9. PDF TO IMAGES OFFLINE (using local PDF.js)
    if (endpoint.includes('pdf-to-images')) {
      const file = formData.get('file');
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js renderer is not loaded. Please connect to internet or reload.');
      }
      const bytes = await fileToBytes(file);
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const totalPages = pdf.numPages;

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      const blobUrl = URL.createObjectURL(blob);
      return {
        success: true,
        offline: true,
        downloadUrl: blobUrl,
        downloadFileName: `page_1_${file.name.replace(/\.pdf$/i, '')}.jpg`,
        mimeType: 'image/jpeg',
        stats: {
          outputSize: blob.size,
          pageCount: totalPages
        }
      };
    }

    // 10. PDF TO WORD / TEXT OFFLINE
    if (endpoint.includes('pdf-to-word') || endpoint.includes('ocr')) {
      const file = formData.get('file');
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF text extraction requires PDF.js library.');
      }
      const bytes = await fileToBytes(file);
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `--- Page ${i} ---\n\n${pageText}\n\n`;
      }

      const textBlob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(textBlob);
      return {
        success: true,
        offline: true,
        downloadUrl: blobUrl,
        downloadFileName: `${file.name.replace(/\.pdf$/i, '')}_extracted.txt`,
        mimeType: 'text/plain',
        stats: {
          outputSize: textBlob.size,
          pageCount: pdf.numPages
        }
      };
    }

    throw new Error('This specific tool requires a server connection for complex format conversions. Please connect to internet or use local tools.');
  }
};
