const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');

// API Index & Health endpoints
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PDFNova API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

router.get('/system/capabilities', (req, res) => {
  pdfController.getSystemCapabilities(req, res);
});

// Authentication Routes & Middleware
const authController = require('../controllers/authController');
const { requireAuth, optionalAuth } = require('../middleware/userAuth');

router.post('/auth/signup', (req, res, next) => authController.signup(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));
router.get('/auth/me', requireAuth, (req, res, next) => authController.me(req, res, next));
router.post('/auth/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
router.get('/auth/history', requireAuth, (req, res, next) => authController.history(req, res, next));

// Attach optional user auth to PDF operations
router.use('/pdf', optionalAuth);

// PDF Operations
router.post('/pdf/merge', uploadMultiple, (req, res, next) => pdfController.mergePdfs(req, res, next));
router.post('/pdf/split', uploadSingle, (req, res, next) => pdfController.splitPdf(req, res, next));
router.post('/pdf/compress', uploadSingle, (req, res, next) => pdfController.compressPdf(req, res, next));
router.post('/pdf/rotate', uploadSingle, (req, res, next) => pdfController.rotatePdf(req, res, next));
router.post('/pdf/delete-pages', uploadSingle, (req, res, next) => pdfController.deletePages(req, res, next));
router.post('/pdf/organize', uploadSingle, (req, res, next) => pdfController.organizePages(req, res, next));
router.post('/pdf/watermark', uploadSingle, (req, res, next) => pdfController.addWatermark(req, res, next));
router.post('/pdf/page-numbers', uploadSingle, (req, res, next) => pdfController.addPageNumbers(req, res, next));
router.post('/pdf/protect', uploadSingle, (req, res, next) => pdfController.protectPdf(req, res, next));
router.post('/pdf/unlock', uploadSingle, (req, res, next) => pdfController.unlockPdf(req, res, next));
router.post('/pdf/images-to-pdf', uploadMultiple, (req, res, next) => pdfController.imagesToPdf(req, res, next));
router.post('/pdf/pdf-to-images', uploadSingle, (req, res, next) => pdfController.pdfToImages(req, res, next));
router.post('/pdf/pdf-to-word', uploadSingle, (req, res, next) => pdfController.pdfToWord(req, res, next));
router.post('/pdf/ocr', uploadSingle, (req, res, next) => pdfController.ocrPdf(req, res, next));
router.post('/pdf/office-to-pdf', uploadSingle, (req, res, next) => pdfController.officeToPdf(req, res, next));
router.post('/pdf/save-editor', uploadSingle, (req, res, next) => pdfController.saveEditor(req, res, next));
router.post('/pdf/info', uploadSingle, (req, res, next) => pdfController.getPdfInfo(req, res, next));

// Job Management
router.get('/jobs/:jobId/status', (req, res, next) => pdfController.getJobStatus(req, res, next));
router.get('/jobs/:jobId/download', (req, res, next) => pdfController.downloadJobOutput(req, res, next));
router.delete('/jobs/:jobId', (req, res, next) => pdfController.deleteJob(req, res, next));

// Administrative Management Routes
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

router.post('/admin/auth', adminAuth, (req, res) => adminController.auth(req, res));
router.get('/admin/metrics', adminAuth, (req, res) => adminController.getMetrics(req, res));
router.get('/admin/jobs', adminAuth, (req, res) => adminController.getJobs(req, res));
router.delete('/admin/jobs/:jobId', adminAuth, (req, res) => adminController.deleteJob(req, res));
router.post('/admin/cleanup', adminAuth, (req, res) => adminController.cleanupExpired(req, res));
router.post('/admin/wipe-all', adminAuth, (req, res) => adminController.wipeAll(req, res));

module.exports = router;
