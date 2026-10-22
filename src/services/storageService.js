const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const { isSafeIdentifier } = require('../utils/fileValidation');

class StorageService {
  constructor() {
    this.jobsDir = config.jobsDir;
    this.init();
  }

  /**
   * Initializes the storage directory
   */
  init() {
    try {
      if (!fs.existsSync(this.jobsDir)) {
        fs.mkdirSync(this.jobsDir, { recursive: true });
      }
      logger.info('Storage service initialized', { jobsDir: this.jobsDir });
    } catch (err) {
      logger.error('Failed to initialize storage directory', err);
    }
  }

  /**
   * Generates a secure random capability token
   */
  generateToken() {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Creates an isolated job directory and initial metadata
   */
  createJob(toolName = 'general') {
    const jobId = crypto.randomUUID();
    const token = this.generateToken();
    const jobDir = path.join(this.jobsDir, jobId);

    fs.mkdirSync(jobDir, { recursive: true });
    const inputsDir = path.join(jobDir, 'inputs');
    const outputsDir = path.join(jobDir, 'outputs');
    fs.mkdirSync(inputsDir, { recursive: true });
    fs.mkdirSync(outputsDir, { recursive: true });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.lifecycle.jobTtlMinutes * 60 * 1000);

    const meta = {
      jobId,
      token,
      tool: toolName,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      inputFiles: [],
      outputFiles: [],
      stats: {
        originalSize: 0,
        outputSize: 0
      }
    };

    this.writeMeta(jobId, meta);

    return { jobId, token, jobDir, inputsDir, outputsDir, expiresAt };
  }

  /**
   * Reads metadata for a specific job
   */
  getJobMeta(jobId) {
    if (!isSafeIdentifier(jobId)) return null;
    const metaPath = path.join(this.jobsDir, jobId, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;

    try {
      const data = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      logger.error(`Error reading job metadata for ${jobId}`, err);
      return null;
    }
  }

  /**
   * Writes/updates metadata for a job
   */
  writeMeta(jobId, meta) {
    if (!isSafeIdentifier(jobId)) return false;
    const metaPath = path.join(this.jobsDir, jobId, 'meta.json');
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      return true;
    } catch (err) {
      logger.error(`Error writing job metadata for ${jobId}`, err);
      return false;
    }
  }

  /**
   * Updates partial metadata
   */
  updateJobMeta(jobId, updates) {
    const meta = this.getJobMeta(jobId);
    if (!meta) return null;
    const updated = { ...meta, ...updates };
    this.writeMeta(jobId, updated);
    return updated;
  }

  /**
   * Validates capability token for access to a job
   */
  verifyToken(jobId, token) {
    if (!token || typeof token !== 'string') return false;
    const meta = this.getJobMeta(jobId);
    if (!meta) return false;
    // Constant time comparison to prevent timing attacks
    if (meta.token.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(meta.token), Buffer.from(token));
  }

  /**
   * Deletes a job directory and all its files immediately
   */
  deleteJob(jobId, token = null) {
    if (!isSafeIdentifier(jobId)) return false;

    if (token) {
      const isValid = this.verifyToken(jobId, token);
      if (!isValid) {
        logger.warn(`Unauthorized attempt to delete job ${jobId}`);
        return false;
      }
    }

    const jobDir = path.join(this.jobsDir, jobId);
    if (fs.existsSync(jobDir)) {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
        logger.info(`Job deleted: ${jobId}`);
        return true;
      } catch (err) {
        logger.error(`Failed to delete job ${jobId}`, err);
        return false;
      }
    }
    return false;
  }

  /**
   * Cleans up expired jobs and dangling files
   */
  cleanupExpiredJobs() {
    try {
      if (!fs.existsSync(this.jobsDir)) return 0;
      const entries = fs.readdirSync(this.jobsDir);
      const now = new Date();
      let cleanedCount = 0;

      for (const entry of entries) {
        if (!isSafeIdentifier(entry)) continue;
        const jobDir = path.join(this.jobsDir, entry);
        const metaPath = path.join(jobDir, 'meta.json');

        let shouldDelete = false;

        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.expiresAt && new Date(meta.expiresAt) <= now) {
              shouldDelete = true;
            }
          } catch {
            shouldDelete = true;
          }
        } else {
          // If no meta.json exists, check directory age (> 2 hours)
          try {
            const stat = fs.statSync(jobDir);
            const ageMs = now.getTime() - stat.mtime.getTime();
            if (ageMs > 2 * 60 * 60 * 1000) {
              shouldDelete = true;
            }
          } catch {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          try {
            fs.rmSync(jobDir, { recursive: true, force: true });
            cleanedCount++;
          } catch (err) {
            logger.error(`Error cleaning up job folder ${entry}`, err);
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Storage cleanup completed. Cleaned ${cleanedCount} expired job(s).`);
      }
      return cleanedCount;
    } catch (err) {
      logger.error('Error during scheduled storage cleanup', err);
      return 0;
    }
  }
}

module.exports = new StorageService();
