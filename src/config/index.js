const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootDir = path.resolve(__dirname, '..', '..');
const tempDir = path.resolve(rootDir, process.env.TEMP_DIR || 'temp');
const jobsDir = path.join(tempDir, 'jobs');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  rootDir,
  tempDir,
  jobsDir,
  limits: {
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
    maxBatchFiles: parseInt(process.env.MAX_BATCH_FILES || '20', 10),
    processingTimeoutMs: parseInt(process.env.PROCESSING_TIMEOUT_MS || '60000', 10)
  },
  lifecycle: {
    jobTtlMinutes: parseInt(process.env.JOB_TTL_MINUTES || '60', 10),
    cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '15', 10)
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10)
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  libreOfficePath: process.env.LIBREOFFICE_PATH || null,
  adminKey: process.env.ADMIN_KEY || 'pdfnova_admin_secret_2026'
};
