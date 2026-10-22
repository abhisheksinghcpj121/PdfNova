const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const storageService = require('./services/storageService');
const pdfService = require('./services/pdfService');

const PORT = config.port;

// Initialize and run first cleanup
storageService.init();
storageService.cleanupExpiredJobs();

// Setup scheduled cleanup interval
const cleanupIntervalMs = config.lifecycle.cleanupIntervalMinutes * 60 * 1000;
const cleanupTimer = setInterval(() => {
  logger.info('Running scheduled storage cleanup for expired documents...');
  storageService.cleanupExpiredJobs();
}, cleanupIntervalMs);

// Unref timer so it doesn't prevent graceful process exit
cleanupTimer.unref();

const server = app.listen(PORT, () => {
  const libreOfficeStatus = pdfService.isLibreOfficeAvailable() ? 'AVAILABLE' : 'OPTIONAL (NOT INSTALLED)';

  console.log(`
===============================================================
              PDFNova - Production PDF Platform
===============================================================
 Server running at: http://localhost:${PORT}
 Environment:       ${config.env}
 Max File Size:     ${config.limits.maxFileSizeMb} MB
 Job TTL:           ${config.lifecycle.jobTtlMinutes} minutes
 LibreOffice:       ${libreOfficeStatus}
 OCR Engine:        Tesseract.js active
 Ready for requests!
===============================================================
  `);
});

// Graceful shutdown handling
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down PDFNova gracefully...`);
  clearInterval(cleanupTimer);

  server.close(() => {
    logger.info('HTTP server closed.');
    // Run final cleanup
    storageService.cleanupExpiredJobs();
    process.exit(0);
  });

  // Force exit after 10s if hanging
  setTimeout(() => {
    logger.warn('Forcing server shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
