const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config');
const storageService = require('../services/storageService');
const { sanitizeFileName } = require('../utils/fileValidation');

// Allowed MIME types and extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt'
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint'
]);

/**
 * Custom Multer storage engine that places uploads in an isolated job directory
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // If job hasn't been created yet for this request, create one
    if (!req.job) {
      const toolName = req.baseUrl.split('/').pop() || req.path.split('/')[1] || 'general';
      req.job = storageService.createJob(toolName);
    }
    cb(null, req.job.inputsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    const randomName = `${crypto.randomBytes(16).toString('hex')}${safeExt}`;
    cb(null, randomName);
  }
});

/**
 * File filter to prevent arbitrary files
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type '${ext}' is not supported.`));
  }

  // Also check MIME type if provided
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype) && file.mimetype !== 'application/octet-stream') {
    return cb(new Error(`MIME type '${file.mimetype}' is not permitted.`));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.limits.maxFileSizeBytes,
    files: config.limits.maxBatchFiles
  },
  fileFilter
});

module.exports = {
  uploadSingle: upload.single('file'),
  uploadMultiple: upload.array('files', config.limits.maxBatchFiles),
  uploadFields: upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: config.limits.maxBatchFiles }
  ])
};
