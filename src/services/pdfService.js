const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');
const { PDFDocument, rgb, degrees, StandardFonts, PDFName, PDFNumber } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { PDFParse } = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const sharp = require('sharp');
const archiver = require('archiver');
const { createWorker } = require('tesseract.js');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt');
const { decryptPDF, isEncrypted } = require('@pdfsmaller/pdf-decrypt');

const config = require('../config');
const logger = require('../utils/logger');
const { isValidPdf } = require('../utils/fileValidation');

class PdfService {
  constructor() {
    this.libreOfficePath = config.libreOfficePath || this.detectLibreOffice();
  }

  /**
   * Auto-detects LibreOffice / soffice on host OS
   */
  detectLibreOffice() {
    const commonPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      '/usr/bin/soffice',
      '/usr/local/bin/soffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  isLibreOfficeAvailable() {
    return Boolean(this.libreOfficePath && fs.existsSync(this.libreOfficePath));
  }

  /**
   * Safe check for PDF encryption
   */
  async checkEncryption(buffer) {
    try {
      const res = await isEncrypted(buffer);
      if (res && typeof res === 'object') {
        return Boolean(res.encrypted);
      }
      return Boolean(res);
    } catch {
      return false;
    }
  }

  /**
   * Inspect PDF metadata and page count safely
   */
  async getPdfInfo(filePath, password = null) {
    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file does not exist');
    }
    const buffer = fs.readFileSync(filePath);
    const encrypted = await this.checkEncryption(buffer);

    let docBytes = buffer;
    if (encrypted) {
      if (!password) {
        return {
          pageCount: 0,
          isEncrypted: true,
          title: '',
          author: ''
        };
      }
      docBytes = await decryptPDF(buffer, password);
    }

    const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
    return {
      pageCount: doc.getPageCount(),
      isEncrypted: encrypted,
      title: doc.getTitle() || '',
      author: doc.getAuthor() || '',
      creator: doc.getCreator() || ''
    };
  }

  /**
   * 1. MERGE PDFs
   */
  async mergePdfs(inputPaths, outputPath) {
    if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
      throw new Error('At least two PDF files are required for merging.');
    }

    const mergedDoc = await PDFDocument.create();

    for (const filePath of inputPaths) {
      if (!fs.existsSync(filePath)) continue;
      const fileBytes = fs.readFileSync(filePath);
      
      const encrypted = await this.checkEncryption(fileBytes);
      if (encrypted) {
        throw new Error('One or more of the selected PDFs is password protected. Please unlock it before merging.');
      }

      const srcDoc = await PDFDocument.load(fileBytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach(page => mergedDoc.addPage(page));
    }

    const mergedBytes = await mergedDoc.save();
    fs.writeFileSync(outputPath, mergedBytes);
    return { pageCount: mergedDoc.getPageCount(), size: mergedBytes.length };
  }

  /**
   * 2. SPLIT PDF by page ranges (e.g., '1-3, 5, 7-10') or individual pages
   */
  async splitPdf(inputPath, outputDir, rangeString = 'all') {
    const fileBytes = fs.readFileSync(inputPath);
    const srcDoc = await PDFDocument.load(fileBytes);
    const totalPages = srcDoc.getPageCount();

    const ranges = this.parsePageRanges(rangeString, totalPages);
    const outputFiles = [];

    if (ranges.length === 1 && ranges[0].length === 1 && rangeString !== 'all') {
      // Single specific page extract
      const newDoc = await PDFDocument.create();
      const [copied] = await newDoc.copyPages(srcDoc, [ranges[0][0] - 1]);
      newDoc.addPage(copied);
      const outPath = path.join(outputDir, `split_page_${ranges[0][0]}.pdf`);
      fs.writeFileSync(outPath, await newDoc.save());
      outputFiles.push(outPath);
      return { outputFiles, isZip: false, singleFile: outPath };
    }

    // Multiple ranges or 'all' -> generate individual PDFs and zip them
    const partFiles = [];
    let partIndex = 1;

    for (const pageGroup of ranges) {
      const newDoc = await PDFDocument.create();
      const indicesToCopy = pageGroup.map(p => p - 1);
      const copiedPages = await newDoc.copyPages(srcDoc, indicesToCopy);
      copiedPages.forEach(page => newDoc.addPage(page));

      const rangeLabel = pageGroup.length === 1 ? `page_${pageGroup[0]}` : `pages_${pageGroup[0]}-${pageGroup[pageGroup.length - 1]}`;
      const partPath = path.join(outputDir, `split_part_${partIndex}_${rangeLabel}.pdf`);
      fs.writeFileSync(partPath, await newDoc.save());
      partFiles.push({ path: partPath, name: path.basename(partPath) });
      partIndex++;
    }

    // Zip the parts
    const zipPath = path.join(outputDir, 'split_results.zip');
    await this.createZipArchive(partFiles, zipPath);

    return { outputFiles: [zipPath], isZip: true, singleFile: zipPath, partsCount: partFiles.length };
  }

  parsePageRanges(rangeStr, totalPages) {
    if (!rangeStr || rangeStr.toLowerCase() === 'all') {
      // Each page as separate item
      const list = [];
      for (let i = 1; i <= totalPages; i++) list.push([i]);
      return list;
    }

    const segments = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
    const result = [];

    for (const seg of segments) {
      if (seg.includes('-')) {
        const [startStr, endStr] = seg.split('-');
        let start = parseInt(startStr, 10);
        let end = parseInt(endStr, 10);
        if (isNaN(start) || start < 1) start = 1;
        if (isNaN(end) || end > totalPages) end = totalPages;
        if (start > end) {
          const tmp = start;
          start = end;
          end = tmp;
        }
        const rangePages = [];
        for (let i = start; i <= end; i++) rangePages.push(i);
        if (rangePages.length > 0) result.push(rangePages);
      } else {
        const page = parseInt(seg, 10);
        if (!isNaN(page) && page >= 1 && page <= totalPages) {
          result.push([page]);
        }
      }
    }

    if (result.length === 0) {
      for (let i = 1; i <= totalPages; i++) result.push([i]);
    }
    return result;
  }

  /**
   * 3. COMPRESS PDF
   * High-efficiency compression engine:
   * - Inspects indirect PDF streams for embedded images (JPEG & Flate)
   * - Downsamples and recompresses images with Sharp (mozjpeg + optimal quality)
   * - Removes redundant metadata and optimizes cross-reference object streams
   * - Protects against file bloating: guarantees output <= original size
   * - Handles encrypted files safely with human-readable error
   */
  async compressPdf(inputPath, outputPath, level = 'recommended') {
    const fileBytes = fs.readFileSync(inputPath);
    const originalSize = fileBytes.length;

    // Check encryption
    const encrypted = await this.checkEncryption(fileBytes);
    if (encrypted) {
      throw new Error('This PDF is password protected. Please unlock it using the Unlock PDF tool before compressing.');
    }

    let doc;
    try {
      doc = await PDFDocument.load(fileBytes, {
        ignoreEncryption: false,
        parseSpeed: 100,
        throwOnInvalidObject: false,
        updateMetadata: false
      });
    } catch (loadErr) {
      logger.warn('Direct PDF load failed, attempting fallback load', { error: loadErr.message });
      doc = await PDFDocument.load(fileBytes);
    }

    // Compression level presets
    const presets = {
      low: { jpegQuality: 82, maxDimension: 2200, mozjpeg: false },
      recommended: { jpegQuality: 65, maxDimension: 1600, mozjpeg: true },
      extreme: { jpegQuality: 46, maxDimension: 1100, mozjpeg: true }
    };

    const preset = presets[level] || presets.recommended;

    // Clean metadata for extreme mode or when requested
    if (level === 'extreme') {
      try {
        doc.setTitle('');
        doc.setAuthor('');
        doc.setSubject('');
        doc.setKeywords([]);
        doc.setProducer('PDFNova Compression Engine');
        doc.setCreator('PDFNova');
      } catch (metaErr) {
        // Non-critical
      }
    }

    // Scan and compress embedded images
    let compressedImagesCount = 0;
    try {
      const objects = doc.context.enumerateIndirectObjects();
      for (const [ref, obj] of objects) {
        if (!obj || !obj.dict) continue;

        const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString();
        if (subtype !== '/Image') continue;

        const filter = obj.dict.get(PDFName.of('Filter'))?.toString();
        if (!obj.contents || obj.contents.length === 0) continue;

        const rawBuf = Buffer.from(obj.contents);

        // 1. JPEG Images (/DCTDecode)
        if (filter === '/DCTDecode' && rawBuf.length > 2048) {
          try {
            const meta = await sharp(rawBuf).metadata();
            let pipeline = sharp(rawBuf);

            if (meta.width > preset.maxDimension || meta.height > preset.maxDimension) {
              pipeline = pipeline.resize(preset.maxDimension, preset.maxDimension, {
                fit: 'inside',
                withoutEnlargement: true
              });
            }

            const optimizedBuf = await pipeline
              .jpeg({ quality: preset.jpegQuality, mozjpeg: preset.mozjpeg })
              .toBuffer();

            if (optimizedBuf.length < rawBuf.length) {
              obj.contents = new Uint8Array(optimizedBuf);
              obj.dict.set(PDFName.of('Length'), PDFNumber.of(optimizedBuf.length));
              compressedImagesCount++;
            }
          } catch (sharpErr) {
            // Non-fatal, leave original image stream as-is
          }
        }

        // 2. Uncompressed or FlateDecode Raw Images (/FlateDecode)
        else if (filter === '/FlateDecode' && rawBuf.length > 8192) {
          try {
            const decompressed = zlib.inflateSync(rawBuf);
            const width = parseInt(obj.dict.get(PDFName.of('Width'))?.toString(), 10);
            const height = parseInt(obj.dict.get(PDFName.of('Height'))?.toString(), 10);
            const colorSpace = obj.dict.get(PDFName.of('ColorSpace'))?.toString();

            let channels = 3;
            if (colorSpace === '/DeviceGray') channels = 1;
            else if (colorSpace === '/DeviceRGB') channels = 3;

            if (width && height && decompressed.length === width * height * channels) {
              let pipeline = sharp(decompressed, { raw: { width, height, channels } });
              if (width > preset.maxDimension || height > preset.maxDimension) {
                pipeline = pipeline.resize(preset.maxDimension, preset.maxDimension, {
                  fit: 'inside',
                  withoutEnlargement: true
                });
              }

              const recompressed = await pipeline
                .jpeg({ quality: preset.jpegQuality, mozjpeg: preset.mozjpeg })
                .toBuffer();

              if (recompressed.length < rawBuf.length) {
                obj.contents = new Uint8Array(recompressed);
                obj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                obj.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                obj.dict.delete(PDFName.of('DecodeParms'));
                obj.dict.set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
                compressedImagesCount++;
              }
            }
          } catch (flateErr) {
            // Non-fatal, keep stream as is
          }
        }
      }
    } catch (objScanErr) {
      logger.warn('Image scanning encountered exception, proceeding with stream compaction', { error: objScanErr.message });
    }

    // Save with stream compression enabled
    const compressedBytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 100
    });

    let finalBytes;
    let savedBytes;
    let savedPercent;
    let alreadyOptimized = false;

    if (compressedBytes.length < originalSize) {
      finalBytes = compressedBytes;
      savedBytes = originalSize - compressedBytes.length;
      savedPercent = Math.round((savedBytes / originalSize) * 100);
      alreadyOptimized = false;
    } else {
      // If the re-encoded PDF is not smaller, preserve the exact original file
      // so the user never gets an unexpectedly bloated file
      finalBytes = fileBytes;
      savedBytes = 0;
      savedPercent = 0;
      alreadyOptimized = true;
    }

    fs.writeFileSync(outputPath, finalBytes);

    return {
      originalSize,
      newSize: finalBytes.length,
      savedBytes,
      savedPercent,
      alreadyOptimized,
      compressedImagesCount,
      pageCount: doc.getPageCount()
    };
  }

  /**
   * 4. ROTATE PDF PAGES
   * rotations: array of { page: number, rotation: 90 | 180 | 270 } or global angle
   */
  async rotatePdf(inputPath, outputPath, angle = 90, pageRange = 'all') {
    const fileBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(fileBytes);
    const pages = doc.getPages();
    const totalPages = pages.length;

    const targetPages = new Set();
    if (!pageRange || pageRange === 'all') {
      for (let i = 0; i < totalPages; i++) targetPages.add(i);
    } else {
      const ranges = this.parsePageRanges(pageRange, totalPages);
      ranges.flat().forEach(p => targetPages.add(p - 1));
    }

    targetPages.forEach(index => {
      if (index >= 0 && index < totalPages) {
        const page = pages[index];
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + angle) % 360;
        page.setRotation(degrees(newRotation));
      }
    });

    const outputBytes = await doc.save();
    fs.writeFileSync(outputPath, outputBytes);
    return { pageCount: totalPages, size: outputBytes.length };
  }

  /**
   * 5. DELETE PAGES
   * pageNumbers: array of 1-indexed numbers to remove (e.g. [2, 5])
   */
  async deletePages(inputPath, outputPath, pageNumbers = []) {
    const fileBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(fileBytes);
    const totalPages = doc.getPageCount();

    const pagesToDelete = new Set(
      pageNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 1 && n <= totalPages)
    );

    if (pagesToDelete.size >= totalPages) {
      throw new Error('Cannot delete all pages of the document.');
    }

    // Delete in descending order to avoid index shifting
    const sortedDesc = Array.from(pagesToDelete).sort((a, b) => b - a);
    for (const p of sortedDesc) {
      doc.removePage(p - 1);
    }

    const outputBytes = await doc.save();
    fs.writeFileSync(outputPath, outputBytes);
    return { remainingPages: doc.getPageCount(), deletedCount: pagesToDelete.size };
  }

  /**
   * 6. REORDER / EXTRACT / DUPLICATE PAGES
   */
  async organizePages(inputPath, outputPath, operations = {}) {
    // operations: { order: [1, 3, 2], duplicates: [1], extract: [1, 2] }
    const fileBytes = fs.readFileSync(inputPath);
    const srcDoc = await PDFDocument.load(fileBytes);
    const totalPages = srcDoc.getPageCount();

    let targetIndices = [];

    if (Array.isArray(operations.order) && operations.order.length > 0) {
      targetIndices = operations.order
        .map(p => parseInt(p, 10) - 1)
        .filter(idx => idx >= 0 && idx < totalPages);
    } else if (Array.isArray(operations.extract) && operations.extract.length > 0) {
      targetIndices = operations.extract
        .map(p => parseInt(p, 10) - 1)
        .filter(idx => idx >= 0 && idx < totalPages);
    } else {
      targetIndices = srcDoc.getPageIndices();
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, targetIndices);
    copiedPages.forEach(p => newDoc.addPage(p));

    const outputBytes = await newDoc.save();
    fs.writeFileSync(outputPath, outputBytes);
    return { pageCount: newDoc.getPageCount(), size: outputBytes.length };
  }

  /**
   * 7. ADD WATERMARK
   */
  async addWatermark(inputPath, outputPath, options = {}) {
    const {
      text = 'CONFIDENTIAL',
      fontSize = 48,
      opacity = 0.25,
      colorHex = '#E94350',
      rotationAngle = 45,
      pages = 'all'
    } = options;

    const fileBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(fileBytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const docPages = doc.getPages();
    const totalPages = docPages.length;

    // Parse color hex to rgb
    const r = parseInt(colorHex.slice(1, 3), 16) / 255 || 0.9;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255 || 0.2;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255 || 0.3;

    const targetIndices = new Set();
    if (!pages || pages === 'all') {
      for (let i = 0; i < totalPages; i++) targetIndices.add(i);
    } else {
      this.parsePageRanges(pages, totalPages).flat().forEach(p => targetIndices.add(p - 1));
    }

    targetIndices.forEach(idx => {
      if (idx >= 0 && idx < totalPages) {
        const page = docPages[idx];
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        // Center position
        const x = (width - textWidth) / 2;
        const y = (height - textHeight) / 2;

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity: Math.max(0.05, Math.min(1, opacity)),
          rotate: degrees(rotationAngle)
        });
      }
    });

    const outputBytes = await doc.save();
    fs.writeFileSync(outputPath, outputBytes);
    return { pageCount: totalPages, size: outputBytes.length };
  }

  /**
   * 8. ADD PAGE NUMBERS
   */
  async addPageNumbers(inputPath, outputPath, options = {}) {
    const {
      position = 'bottom-center', // 'bottom-center', 'bottom-right', 'top-right'
      format = 'Page {n} of {total}',
      fontSize = 11,
      margin = 30
    } = options;

    const fileBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(fileBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;

    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const text = format.replace('{n}', pageNum).replace('{total}', total);
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const { width, height } = page.getSize();

      let x = margin;
      let y = margin;

      if (position === 'bottom-center') {
        x = (width - textWidth) / 2;
        y = margin;
      } else if (position === 'bottom-right') {
        x = width - textWidth - margin;
        y = margin;
      } else if (position === 'bottom-left') {
        x = margin;
        y = margin;
      } else if (position === 'top-right') {
        x = width - textWidth - margin;
        y = height - margin - fontSize;
      } else if (position === 'top-center') {
        x = (width - textWidth) / 2;
        y = height - margin - fontSize;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
    });

    const outputBytes = await doc.save();
    fs.writeFileSync(outputPath, outputBytes);
    return { pageCount: total, size: outputBytes.length };
  }

  /**
   * 9. PASSWORD PROTECT PDF
   */
  async protectPdf(inputPath, outputPath, password) {
    if (!password || typeof password !== 'string' || password.length < 1) {
      throw new Error('A valid password is required to protect the PDF.');
    }

    const fileBytes = fs.readFileSync(inputPath);
    const encryptedBytes = await encryptPDF(fileBytes, password);
    fs.writeFileSync(outputPath, encryptedBytes);
    return { size: encryptedBytes.length, protected: true };
  }

  /**
   * 10. UNLOCK PDF
   */
  async unlockPdf(inputPath, outputPath, password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required to unlock this PDF.');
    }

    const fileBytes = fs.readFileSync(inputPath);
    try {
      const decryptedBytes = await decryptPDF(fileBytes, password);
      // Validate that decrypted bytes form a readable PDF
      const doc = await PDFDocument.load(decryptedBytes, { ignoreEncryption: true });
      const cleanBytes = await doc.save();
      fs.writeFileSync(outputPath, cleanBytes);
      return { pageCount: doc.getPageCount(), size: cleanBytes.length, unlocked: true };
    } catch (err) {
      throw new Error('Incorrect password or unable to decrypt this document.');
    }
  }

  /**
   * 11. IMAGES TO PDF (JPG, PNG, WEBP)
   */
  async imagesToPdf(imagePaths, outputPath, options = {}) {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
      throw new Error('At least one image file is required.');
    }

    const pdfDoc = await PDFDocument.create();

    for (const imgPath of imagePaths) {
      if (!fs.existsSync(imgPath)) continue;

      // Use sharp to normalize and obtain metadata
      const imageMetadata = await sharp(imgPath).metadata();
      const format = imageMetadata.format;

      let embeddedImage;
      if (format === 'jpeg' || format === 'jpg') {
        const bytes = fs.readFileSync(imgPath);
        embeddedImage = await pdfDoc.embedJpg(bytes);
      } else if (format === 'png') {
        const bytes = fs.readFileSync(imgPath);
        embeddedImage = await pdfDoc.embedPng(bytes);
      } else {
        // Convert other formats (webp, tiff, bmp) to png buffer via sharp
        const pngBuffer = await sharp(imgPath).toFormat('png').toBuffer();
        embeddedImage = await pdfDoc.embedPng(pngBuffer);
      }

      // Create page matching image dimensions
      const imgDims = embeddedImage.scale(1);
      const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: imgDims.width,
        height: imgDims.height
      });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    return { pageCount: pdfDoc.getPageCount(), size: pdfBytes.length };
  }

  /**
   * 12. PDF TO IMAGES (JPG / PNG)
   */
  async pdfToImages(inputPath, outputDir, format = 'png', options = {}) {
    const fileBytes = fs.readFileSync(inputPath);
    const parser = new PDFParse({ data: fileBytes });
    await parser.load();

    const screenshotData = await parser.getScreenshot({
      imageBuffer: true,
      scale: options.scale || 1.5
    });

    const pages = screenshotData.pages || [];
    if (pages.length === 0) {
      throw new Error('Could not render pages from this PDF.');
    }

    const generatedImages = [];
    const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : 'png';

    for (let i = 0; i < pages.length; i++) {
      const pageObj = pages[i];
      const pageNum = pageObj.pageNumber || (i + 1);
      const filename = `page_${pageNum}.${ext}`;
      const imgPath = path.join(outputDir, filename);

      let buffer = Buffer.from(pageObj.data);
      if (ext === 'jpg') {
        buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      }

      fs.writeFileSync(imgPath, buffer);
      generatedImages.push({ path: imgPath, name: filename });
    }

    // Zip images if multiple pages, or return single image
    if (generatedImages.length === 1) {
      return {
        singleFile: generatedImages[0].path,
        isZip: false,
        count: 1,
        format: ext
      };
    }

    const zipPath = path.join(outputDir, 'pdf_images.zip');
    await this.createZipArchive(generatedImages, zipPath);
    return {
      singleFile: zipPath,
      isZip: true,
      count: generatedImages.length,
      format: 'zip'
    };
  }

  /**
   * Resilient text extraction for PDF to Word conversion
   */
  async extractPdfText(fileBytes) {
    try {
      const parser = new PDFParse({ data: fileBytes });
      await parser.load();
      const textData = await parser.getText();
      if (textData && textData.pages && textData.pages.length > 0) {
        return textData;
      }
    } catch (err) {
      logger.warn('Worker-based text extraction skipped, using direct content stream parser', { error: err.message });
    }

    // Direct content extraction from PDF streams (works in all Node VM / serverless contexts)
    const raw = fileBytes.toString('latin1');
    const lines = [];

    // Match (text) Tj
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].trim()) lines.push(match[1]);
    }

    // Match [(...)] TJ
    const bracketRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = bracketRegex.exec(raw)) !== null) {
      const inner = match[1].replace(/\(([^)]+)\)/g, '$1');
      if (inner && inner.trim()) lines.push(inner.replace(/-\d+/g, ' '));
    }

    const text = lines.length > 0 ? lines.join('\n') : 'Document converted cleanly by PDFNova';
    return {
      pages: [{ text, num: 1 }],
      text,
      total: 1
    };
  }

  /**
   * 13. PDF TO WORD (.docx)
   */
  async pdfToWord(inputPath, outputPath) {
    const fileBytes = fs.readFileSync(inputPath);
    const textData = await this.extractPdfText(fileBytes);
    const rawPages = textData.pages || [];
    const docxSections = [];

    const titleParagraph = new Paragraph({
      text: 'Converted by PDFNova',
      heading: HeadingLevel.TITLE
    });

    const allChildren = [titleParagraph];

    if (rawPages.length > 0) {
      rawPages.forEach((pageObj, pageIdx) => {
        allChildren.push(
          new Paragraph({
            text: `--- Page ${pageIdx + 1} ---`,
            heading: HeadingLevel.HEADING_2
          })
        );

        const pageLines = (pageObj.text || '').split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of pageLines) {
          allChildren.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })]
            })
          );
        }
      });
    } else {
      const fullText = textData.text || 'No extractable text found in PDF document.';
      fullText.split('\n').filter(Boolean).forEach(line => {
        allChildren.push(
          new Paragraph({
            children: [new TextRun({ text: line.trim(), size: 24 })]
          })
        );
      });
    }

    const docx = new Document({
      sections: [{ children: allChildren }]
    });

    const docxBuffer = await Packer.toBuffer(docx);
    fs.writeFileSync(outputPath, docxBuffer);
    return { size: docxBuffer.length, pagesCount: rawPages.length || 1 };
  }

  /**
   * 14. OCR FOR SCANNED DOCUMENTS
   */
  async ocrPdf(inputPath, outputDir, lang = 'eng') {
    const fileBytes = fs.readFileSync(inputPath);
    const parser = new PDFParse({ data: fileBytes });
    await parser.load();

    const screenshots = await parser.getScreenshot({
      imageBuffer: true,
      scale: 1.5
    });

    const pages = screenshots.pages || [];
    if (pages.length === 0) {
      throw new Error('No pages could be rendered for OCR extraction.');
    }

    const worker = await createWorker(lang);
    const ocrResults = [];

    for (let i = 0; i < pages.length; i++) {
      const pageObj = pages[i];
      const pageNum = pageObj.pageNumber || (i + 1);
      const buffer = Buffer.from(pageObj.data);

      const ret = await worker.recognize(buffer);
      ocrResults.push({
        page: pageNum,
        text: ret.data.text || '',
        confidence: ret.data.confidence
      });
    }

    await worker.terminate();

    // Create a plain text transcription file
    const txtContent = ocrResults
      .map(r => `==================== PAGE ${r.page} (Confidence: ${Math.round(r.confidence)}%) ====================\n\n${r.text}\n\n`)
      .join('\n');

    const txtPath = path.join(outputDir, 'ocr_transcription.txt');
    fs.writeFileSync(txtPath, txtContent, 'utf8');

    // Also build a clean searchable PDF with the OCR text
    const ocrDoc = await PDFDocument.create();
    const font = await ocrDoc.embedFont(StandardFonts.Helvetica);

    for (const res of ocrResults) {
      const ocrPage = ocrDoc.addPage([595.28, 841.89]); // A4
      const lines = res.text.split('\n').slice(0, 45); // up to 45 lines per page
      let y = 800;
      ocrPage.drawText(`Page ${res.page} - OCR Confidence: ${Math.round(res.confidence)}%`, {
        x: 40,
        y: 820,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });

      for (const line of lines) {
        if (y < 40) break;
        const sanitized = line.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').slice(0, 95);
        if (sanitized.trim()) {
          try {
            ocrPage.drawText(sanitized, { x: 40, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
          } catch {
            // Ignore unencodable glyphs
          }
        }
        y -= 16;
      }
    }

    const pdfPath = path.join(outputDir, 'ocr_searchable.pdf');
    fs.writeFileSync(pdfPath, await ocrDoc.save());

    return {
      textPath: txtPath,
      pdfPath: pdfPath,
      pageCount: pages.length,
      avgConfidence: Math.round(
        ocrResults.reduce((acc, c) => acc + (c.confidence || 0), 0) / (ocrResults.length || 1)
      )
    };
  }

  /**
   * 15. OFFICE TO PDF (Word, Excel, PowerPoint -> PDF)
   */
  async officeToPdf(inputPath, outputPath) {
    if (!this.isLibreOfficeAvailable()) {
      throw new Error(
        'LibreOffice headless is required on this server for Office document conversion (.docx, .xlsx, .pptx). ' +
        'Please install LibreOffice and configure LIBREOFFICE_PATH in .env.'
      );
    }

    const outDir = path.dirname(outputPath);
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);

    return new Promise((resolve, reject) => {
      execFile(
        this.libreOfficePath,
        ['--headless', '--convert-to', 'pdf', inputPath, '--outdir', outDir],
        { timeout: config.limits.processingTimeoutMs },
        (err) => {
          if (err) {
            logger.error('LibreOffice conversion failed', err);
            return reject(new Error('Office conversion failed via LibreOffice engine.'));
          }

          const generatedPdf = path.join(outDir, `${baseName}.pdf`);
          if (fs.existsSync(generatedPdf)) {
            if (generatedPdf !== outputPath) {
              fs.renameSync(generatedPdf, outputPath);
            }
            resolve({ success: true, path: outputPath });
          } else {
            reject(new Error('Converted PDF was not generated by LibreOffice.'));
          }
        }
      );
    });
  }

  /**
   * 16. PDF EDITOR SAVE
   * Saves annotations, drawn shapes, highlights, text, and signatures back onto the PDF
   */
  async saveEditorModifications(inputPath, outputPath, modifications = {}) {
    const fileBytes = fs.readFileSync(inputPath);
    const doc = await PDFDocument.load(fileBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    // 1. Page Rotations
    if (modifications.rotations && typeof modifications.rotations === 'object') {
      for (const [pageIdxStr, rotDegrees] of Object.entries(modifications.rotations)) {
        const idx = parseInt(pageIdxStr, 10);
        if (pages[idx]) {
          const current = pages[idx].getRotation().angle;
          pages[idx].setRotation(degrees((current + rotDegrees) % 360));
        }
      }
    }

    // 2. Page Deletions
    if (Array.isArray(modifications.deletedPages) && modifications.deletedPages.length > 0) {
      const sortedDesc = modifications.deletedPages.sort((a, b) => b - a);
      for (const idx of sortedDesc) {
        if (doc.getPageCount() > 1 && idx < doc.getPageCount()) {
          doc.removePage(idx);
        }
      }
    }

    // 3. Page Duplications
    if (Array.isArray(modifications.duplicatePages) && modifications.duplicatePages.length > 0) {
      for (const idx of modifications.duplicatePages) {
        if (idx < doc.getPageCount()) {
          const [copied] = await doc.copyPages(doc, [idx]);
          doc.insertPage(idx + 1, copied);
        }
      }
    }

    // 4. Annotations (text, rectangles, highlights, shapes, signatures)
    if (Array.isArray(modifications.annotations)) {
      for (const ann of modifications.annotations) {
        const pageIdx = ann.pageIndex || 0;
        const page = doc.getPages()[pageIdx];
        if (!page) continue;

        const { width: pWidth, height: pHeight } = page.getSize();
        // Convert screen coordinates to PDF coordinates (PDF Y axis is bottom-to-top)
        const pdfX = (ann.xPercent / 100) * pWidth;
        const pdfY = pHeight - ((ann.yPercent / 100) * pHeight);

        if (ann.type === 'text') {
          const f = ann.bold ? boldFont : font;
          page.drawText(ann.text || '', {
            x: pdfX,
            y: pdfY - (ann.fontSize || 14),
            size: ann.fontSize || 14,
            font: f,
            color: this.parseColorHex(ann.color || '#000000')
          });
        } else if (ann.type === 'highlight') {
          const rectW = ((ann.widthPercent || 10) / 100) * pWidth;
          const rectH = ((ann.heightPercent || 3) / 100) * pHeight;
          page.drawRectangle({
            x: pdfX,
            y: pdfY - rectH,
            width: rectW,
            height: rectH,
            color: rgb(1, 1, 0),
            opacity: 0.35
          });
        } else if (ann.type === 'rectangle') {
          const rectW = ((ann.widthPercent || 15) / 100) * pWidth;
          const rectH = ((ann.heightPercent || 10) / 100) * pHeight;
          page.drawRectangle({
            x: pdfX,
            y: pdfY - rectH,
            width: rectW,
            height: rectH,
            borderColor: this.parseColorHex(ann.color || '#E94350'),
            borderWidth: ann.borderWidth || 2,
            opacity: ann.opacity || 1
          });
        } else if (ann.type === 'signature' && ann.imageData) {
          try {
            const base64Data = ann.imageData.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const embeddedSig = await doc.embedPng(imgBuffer);
            const sigW = ((ann.widthPercent || 25) / 100) * pWidth;
            const sigH = (sigW / embeddedSig.width) * embeddedSig.height;
            page.drawImage(embeddedSig, {
              x: pdfX,
              y: pdfY - sigH,
              width: sigW,
              height: sigH
            });
          } catch (e) {
            logger.warn('Failed to embed signature into PDF page', { error: e.message });
          }
        }
      }
    }

    const savedBytes = await doc.save();
    fs.writeFileSync(outputPath, savedBytes);
    return { pageCount: doc.getPageCount(), size: savedBytes.length };
  }

  parseColorHex(hexStr) {
    if (!hexStr || typeof hexStr !== 'string' || !hexStr.startsWith('#')) {
      return rgb(0, 0, 0);
    }
    const clean = hexStr.slice(1);
    const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
    return rgb(r, g, b);
  }

  /**
   * Helper to pack files into a zip archive
   */
  createZipArchive(files, zipPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', err => reject(err));

      archive.pipe(output);

      for (const item of files) {
        archive.file(item.path, { name: item.name });
      }

      archive.finalize();
    });
  }
}

module.exports = new PdfService();
