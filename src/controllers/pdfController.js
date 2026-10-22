const path = require('path');
const fs = require('fs');
const config = require('../config');
const pdfService = require('../services/pdfService');
const storageService = require('../services/storageService');
const authService = require('../services/authService');
const { sanitizeFileName, isValidPdf, isSafeIdentifier } = require('../utils/fileValidation');
const logger = require('../utils/logger');

class PdfController {
  /**
   * Helper to finish a job and return standard response
   */
  finishJob(res, job, outputFilePath, downloadFileName, mimeType = 'application/pdf', stats = {}, req = null) {
    if (!fs.existsSync(outputFilePath)) {
      throw new Error('Processing failed to create the output document.');
    }

    const stat = fs.statSync(outputFilePath);
    const outputSize = stat.size;

    const updatedMeta = storageService.updateJobMeta(job.jobId, {
      status: 'completed',
      outputFiles: [outputFilePath],
      downloadFileName: sanitizeFileName(downloadFileName),
      mimeType,
      stats: {
        ...stats,
        outputSize
      }
    });

    const downloadUrl = `/api/jobs/${job.jobId}/download?token=${job.token}`;
    const deleteUrl = `/api/jobs/${job.jobId}?token=${job.token}`;

    if (req && req.user) {
      authService.recordUserJob(req.user.id, {
        jobId: job.jobId,
        fileName: sanitizeFileName(downloadFileName),
        downloadUrl,
        size: outputSize,
        mimeType,
        stats
      });
    }

    return res.status(200).json({
      success: true,
      jobId: job.jobId,
      token: job.token,
      downloadUrl,
      deleteUrl,
      downloadFileName: sanitizeFileName(downloadFileName),
      mimeType,
      expiresAt: updatedMeta.expiresAt,
      stats: {
        originalSize: updatedMeta.stats.originalSize || 0,
        outputSize,
        savedPercent: stats.savedPercent || 0,
        ...stats
      }
    });
  }

  /**
   * MERGE PDFs
   */
  async mergePdfs(req, res, next) {
    try {
      const files = req.files;
      if (!files || files.length < 2) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Please upload at least 2 PDF files to merge.' }
        });
      }

      const inputPaths = files.map(f => f.path);
      const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);
      storageService.updateJobMeta(req.job.jobId, {
        stats: { originalSize: totalOriginalSize }
      });

      const outPath = path.join(req.job.outputsDir, 'merged_document.pdf');
      const result = await pdfService.mergePdfs(inputPaths, outPath);

      return this.finishJob(res, req.job, outPath, 'merged_document.pdf', 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: totalOriginalSize
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * SPLIT PDF
   */
  async splitPdf(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No PDF file was provided for splitting.' }
        });
      }

      storageService.updateJobMeta(req.job.jobId, {
        stats: { originalSize: file.size }
      });

      const rangeString = req.body.ranges || 'all';
      const result = await pdfService.splitPdf(file.path, req.job.outputsDir, rangeString);

      const mimeType = result.isZip ? 'application/zip' : 'application/pdf';
      const downloadName = result.isZip ? 'split_pages.zip' : path.basename(result.singleFile);

      return this.finishJob(res, req.job, result.singleFile, downloadName, mimeType, {
        isZip: result.isZip,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * COMPRESS PDF
   */
  async compressPdf(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF to compress.' }
        });
      }

      storageService.updateJobMeta(req.job.jobId, {
        stats: { originalSize: file.size }
      });

      const level = req.body.level || 'recommended'; // low, recommended, extreme
      const outPath = path.join(req.job.outputsDir, 'compressed_document.pdf');
      const stats = await pdfService.compressPdf(file.path, outPath, level);

      return this.finishJob(res, req.job, outPath, `compressed_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        ...stats,
        originalSize: file.size,
        outputSize: stats.newSize,
        compressionLevel: level
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ROTATE PDF
   */
  async rotatePdf(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF to rotate.' }
        });
      }

      const angle = parseInt(req.body.angle || '90', 10);
      const pageRange = req.body.pages || 'all';
      const outPath = path.join(req.job.outputsDir, 'rotated_document.pdf');

      const result = await pdfService.rotatePdf(file.path, outPath, angle, pageRange);

      return this.finishJob(res, req.job, outPath, `rotated_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE PAGES
   */
  async deletePages(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      let pages = req.body.pages;
      if (typeof pages === 'string') {
        pages = pages.split(',').map(p => parseInt(p.trim(), 10)).filter(Boolean);
      } else if (!Array.isArray(pages)) {
        pages = [];
      }

      if (pages.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_PAGES', message: 'Please specify at least one page number to delete.' }
        });
      }

      const outPath = path.join(req.job.outputsDir, 'modified_document.pdf');
      const result = await pdfService.deletePages(file.path, outPath, pages);

      return this.finishJob(res, req.job, outPath, `edited_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        remainingPages: result.remainingPages,
        deletedCount: result.deletedCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ORGANIZE PAGES (Reorder / Extract / Duplicate)
   */
  async organizePages(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      let order = req.body.order;
      if (typeof order === 'string') {
        order = order.split(',').map(p => parseInt(p.trim(), 10)).filter(Boolean);
      }

      let extract = req.body.extract;
      if (typeof extract === 'string') {
        extract = extract.split(',').map(p => parseInt(p.trim(), 10)).filter(Boolean);
      }

      const outPath = path.join(req.job.outputsDir, 'organized_document.pdf');
      const result = await pdfService.organizePages(file.path, outPath, { order, extract });

      return this.finishJob(res, req.job, outPath, `organized_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADD WATERMARK
   */
  async addWatermark(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      const options = {
        text: req.body.text || 'CONFIDENTIAL',
        fontSize: parseInt(req.body.fontSize || '48', 10),
        opacity: parseFloat(req.body.opacity || '0.25'),
        colorHex: req.body.color || '#E94350',
        rotationAngle: parseInt(req.body.rotation || '45', 10),
        pages: req.body.pages || 'all'
      };

      const outPath = path.join(req.job.outputsDir, 'watermarked_document.pdf');
      const result = await pdfService.addWatermark(file.path, outPath, options);

      return this.finishJob(res, req.job, outPath, `watermarked_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ADD PAGE NUMBERS
   */
  async addPageNumbers(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      const options = {
        position: req.body.position || 'bottom-center',
        format: req.body.format || 'Page {n} of {total}',
        fontSize: parseInt(req.body.fontSize || '11', 10),
        margin: parseInt(req.body.margin || '30', 10)
      };

      const outPath = path.join(req.job.outputsDir, 'numbered_document.pdf');
      const result = await pdfService.addPageNumbers(file.path, outPath, options);

      return this.finishJob(res, req.job, outPath, `numbered_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PROTECT PDF (Password)
   */
  async protectPdf(req, res, next) {
    try {
      const file = req.file;
      const password = req.body.password;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file to protect.' }
        });
      }

      if (!password || password.length < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_PASSWORD', message: 'A secure password is required to encrypt the PDF.' }
        });
      }

      const outPath = path.join(req.job.outputsDir, 'protected_document.pdf');
      const result = await pdfService.protectPdf(file.path, outPath, password);

      return this.finishJob(res, req.job, outPath, `protected_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        originalSize: file.size,
        protected: true
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * UNLOCK PDF
   */
  async unlockPdf(req, res, next) {
    try {
      const file = req.file;
      const password = req.body.password;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a password-protected PDF file.' }
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_PASSWORD', message: 'Password is required to unlock this document.' }
        });
      }

      const outPath = path.join(req.job.outputsDir, 'unlocked_document.pdf');
      const result = await pdfService.unlockPdf(file.path, outPath, password);

      return this.finishJob(res, req.job, outPath, `unlocked_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size,
        unlocked: true
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * IMAGES TO PDF
   */
  async imagesToPdf(req, res, next) {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_IMAGES', message: 'Please upload at least one image file (JPG, PNG, WebP).' }
        });
      }

      const imagePaths = files.map(f => f.path);
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);

      const outPath = path.join(req.job.outputsDir, 'converted_images.pdf');
      const result = await pdfService.imagesToPdf(imagePaths, outPath);

      return this.finishJob(res, req.job, outPath, 'images_converted.pdf', 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: totalSize
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PDF TO IMAGES
   */
  async pdfToImages(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      const format = req.body.format || 'png'; // png or jpg
      const result = await pdfService.pdfToImages(file.path, req.job.outputsDir, format);

      const mimeType = result.isZip ? 'application/zip' : (format === 'jpg' ? 'image/jpeg' : 'image/png');
      const downloadName = result.isZip ? 'extracted_images.zip' : path.basename(result.singleFile);

      return this.finishJob(res, req.job, result.singleFile, downloadName, mimeType, {
        isZip: result.isZip,
        imageCount: result.count,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PDF TO WORD (.docx)
   */
  async pdfToWord(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      const outPath = path.join(req.job.outputsDir, `${baseName}.docx`);
      const result = await pdfService.pdfToWord(file.path, outPath);

      return this.finishJob(
        res,
        req.job,
        outPath,
        `${baseName}.docx`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        {
          pagesCount: result.pagesCount,
          originalSize: file.size
        }
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * OCR FOR SCANNED DOCUMENTS
   */
  async ocrPdf(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a scanned document or PDF file.' }
        });
      }

      const lang = req.body.lang || 'eng';
      const result = await pdfService.ocrPdf(file.path, req.job.outputsDir, lang);

      const outputType = req.body.output || 'pdf'; // 'pdf' or 'text'
      const activeFile = outputType === 'text' ? result.textPath : result.pdfPath;
      const mimeType = outputType === 'text' ? 'text/plain' : 'application/pdf';
      const dlName = outputType === 'text' ? 'ocr_transcription.txt' : 'ocr_searchable.pdf';

      return this.finishJob(res, req.job, activeFile, dlName, mimeType, {
        pageCount: result.pageCount,
        avgConfidence: result.avgConfidence,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * OFFICE TO PDF
   */
  async officeToPdf(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload an Office document (.docx, .xlsx, .pptx).' }
        });
      }

      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      const outPath = path.join(req.job.outputsDir, `${baseName}.pdf`);

      await pdfService.officeToPdf(file.path, outPath);

      return this.finishJob(res, req.job, outPath, `${baseName}.pdf`, 'application/pdf', {
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PDF EDITOR SAVE
   */
  async saveEditor(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload the PDF being edited.' }
        });
      }

      let modifications = {};
      if (req.body.modifications) {
        try {
          modifications = typeof req.body.modifications === 'string'
            ? JSON.parse(req.body.modifications)
            : req.body.modifications;
        } catch {
          modifications = {};
        }
      }

      const outPath = path.join(req.job.outputsDir, 'edited_document.pdf');
      const result = await pdfService.saveEditorModifications(file.path, outPath, modifications);

      return this.finishJob(res, req.job, outPath, `edited_${file.originalname || 'document.pdf'}`, 'application/pdf', {
        pageCount: result.pageCount,
        originalSize: file.size
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET PDF INFO
   */
  async getPdfInfo(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'Please upload a PDF file.' }
        });
      }

      const password = req.body.password || null;
      const info = await pdfService.getPdfInfo(file.path, password);

      return res.status(200).json({
        success: true,
        info: {
          ...info,
          fileName: file.originalname,
          size: file.size
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET JOB STATUS
   */
  async getJobStatus(req, res, next) {
    try {
      const { jobId } = req.params;
      if (!isSafeIdentifier(jobId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_JOB_ID', message: 'Invalid job identifier.' }
        });
      }

      const meta = storageService.getJobMeta(jobId);
      if (!meta) {
        return res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: 'Job not found or has expired.' }
        });
      }

      return res.status(200).json({
        success: true,
        jobId: meta.jobId,
        status: meta.status,
        tool: meta.tool,
        createdAt: meta.createdAt,
        expiresAt: meta.expiresAt,
        stats: meta.stats
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DOWNLOAD JOB OUTPUT
   */
  async downloadJobOutput(req, res, next) {
    try {
      const { jobId } = req.params;
      const { token } = req.query;

      if (!isSafeIdentifier(jobId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_JOB_ID', message: 'Invalid job identifier.' }
        });
      }

      if (!token || !storageService.verifyToken(jobId, token)) {
        return res.status(403).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or missing capability token for this document.' }
        });
      }

      const meta = storageService.getJobMeta(jobId);
      if (!meta || !meta.outputFiles || meta.outputFiles.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Output file is no longer available or was cleaned up.' }
        });
      }

      const filePath = meta.outputFiles[0];
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: { code: 'FILE_MISSING', message: 'Processed file does not exist on disk.' }
        });
      }

      const fileName = meta.downloadFileName || path.basename(filePath);

      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

      return res.download(filePath, fileName, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE JOB IMMEDIATELY
   */
  async deleteJob(req, res, next) {
    try {
      const { jobId } = req.params;
      const { token } = req.query;

      if (!isSafeIdentifier(jobId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_JOB_ID', message: 'Invalid job identifier.' }
        });
      }

      if (!token || !storageService.verifyToken(jobId, token)) {
        return res.status(403).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or missing capability token for deleting this job.' }
        });
      }

      const deleted = storageService.deleteJob(jobId, token);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found or already deleted.' }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Job files deleted immediately from server storage.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * SYSTEM CAPABILITIES
   */
  async getSystemCapabilities(req, res) {
    const libreOfficeAvailable = pdfService.isLibreOfficeAvailable();

    return res.status(200).json({
      success: true,
      platform: process.platform,
      capabilities: {
        libreOffice: {
          available: libreOfficeAvailable,
          path: libreOfficeAvailable ? pdfService.libreOfficePath : null,
          note: libreOfficeAvailable
            ? 'LibreOffice headless engine is active and ready for Office document conversions.'
            : 'LibreOffice headless is optional. Required only for Word/Excel/PowerPoint to PDF conversions. PDF-to-Word is natively supported via pure JavaScript without LibreOffice.'
        },
        tesseractOcr: {
          available: true,
          engine: 'Tesseract.js v7',
          languages: ['eng']
        },
        pdfLib: {
          available: true,
          version: '1.17.1'
        },
        imageEngine: {
          available: true,
          engine: 'Sharp v0.35'
        },
        storage: {
          type: 'Local Sandboxed Filesystem',
          ttlMinutes: config.lifecycle.jobTtlMinutes,
          cleanupIntervalMinutes: config.lifecycle.cleanupIntervalMinutes
        }
      }
    });
  }
}

module.exports = new PdfController();
