const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');
const storageService = require('../services/storageService');
const pdfService = require('../services/pdfService');
const logger = require('../utils/logger');
const { isSafeIdentifier } = require('../utils/fileValidation');

class AdminController {
  /**
   * Validates admin key authentication
   */
  auth(req, res) {
    res.status(200).json({
      success: true,
      message: 'Admin authorization verified successfully.'
    });
  }

  /**
   * Returns comprehensive system health, resource, and storage metrics
   */
  getMetrics(req, res) {
    try {
      const memoryUsage = process.memoryUsage();
      const jobsDir = config.jobsDir;

      let totalJobs = 0;
      let activeJobs = 0;
      let expiredJobs = 0;
      let totalBytesUsed = 0;

      const now = new Date();

      if (fs.existsSync(jobsDir)) {
        const entries = fs.readdirSync(jobsDir);
        for (const entry of entries) {
          if (!isSafeIdentifier(entry)) continue;
          totalJobs++;

          const jobPath = path.join(jobsDir, entry);
          const metaPath = path.join(jobPath, 'meta.json');

          // Calculate directory size
          totalBytesUsed += this.getDirectorySize(jobPath);

          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              if (meta.expiresAt && new Date(meta.expiresAt) <= now) {
                expiredJobs++;
              } else {
                activeJobs++;
              }
            } catch {
              expiredJobs++;
            }
          } else {
            expiredJobs++;
          }
        }
      }

      const libreOfficeAvailable = pdfService.isLibreOfficeAvailable();

      return res.status(200).json({
        success: true,
        metrics: {
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptimeSeconds: Math.round(process.uptime()),
            hostname: os.hostname(),
            cpuCount: os.cpus().length,
            freeMemoryBytes: os.freemem(),
            totalMemoryBytes: os.totalmem(),
            processMemory: {
              rss: memoryUsage.rss,
              heapTotal: memoryUsage.heapTotal,
              heapUsed: memoryUsage.heapUsed,
              external: memoryUsage.external
            }
          },
          storage: {
            jobsDirectory: jobsDir,
            totalJobs,
            activeJobs,
            expiredJobs,
            totalBytesUsed,
            ttlMinutes: config.lifecycle.jobTtlMinutes,
            cleanupIntervalMinutes: config.lifecycle.cleanupIntervalMinutes
          },
          capabilities: {
            libreOffice: {
              available: libreOfficeAvailable,
              path: pdfService.libreOfficePath || 'Not configured'
            },
            tesseractOcr: {
              available: true,
              version: 'v7.0.0'
            },
            pdfLib: {
              available: true,
              version: '1.17.1'
            },
            sharp: {
              available: true,
              version: '0.35.5'
            }
          },
          configLimits: {
            maxFileSizeMb: config.limits.maxFileSizeMb,
            maxBatchFiles: config.limits.maxBatchFiles,
            processingTimeoutMs: config.limits.processingTimeoutMs,
            rateLimitWindowMs: config.rateLimit.windowMs,
            rateLimitMaxRequests: config.rateLimit.maxRequests
          }
        }
      });
    } catch (err) {
      logger.error('Failed to retrieve admin metrics', err);
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  /**
   * Lists all current job sandboxes on disk
   */
  getJobs(req, res) {
    try {
      const jobsDir = config.jobsDir;
      const jobs = [];
      const now = new Date();

      if (fs.existsSync(jobsDir)) {
        const entries = fs.readdirSync(jobsDir);
        for (const entry of entries) {
          if (!isSafeIdentifier(entry)) continue;

          const jobPath = path.join(jobsDir, entry);
          const metaPath = path.join(jobPath, 'meta.json');
          const stat = fs.statSync(jobPath);
          const dirSize = this.getDirectorySize(jobPath);

          let meta = {
            jobId: entry,
            tool: 'unknown',
            status: 'untracked',
            createdAt: stat.birthtime.toISOString(),
            expiresAt: new Date(stat.birthtime.getTime() + config.lifecycle.jobTtlMinutes * 60000).toISOString()
          };

          if (fs.existsSync(metaPath)) {
            try {
              const fileData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              meta = { ...meta, ...fileData };
            } catch {
              // fallback
            }
          }

          const isExpired = meta.expiresAt ? new Date(meta.expiresAt) <= now : false;

          jobs.push({
            jobId: entry,
            tool: meta.tool || 'general',
            status: meta.status || 'pending',
            createdAt: meta.createdAt,
            expiresAt: meta.expiresAt,
            sizeBytes: dirSize,
            isExpired
          });
        }
      }

      // Sort by creation desc
      jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.status(200).json({
        success: true,
        jobs
      });
    } catch (err) {
      logger.error('Failed to list admin jobs', err);
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  /**
   * Admin force deletes an individual job
   */
  deleteJob(req, res) {
    try {
      const { jobId } = req.params;
      if (!isSafeIdentifier(jobId)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid job ID' } });
      }

      const jobDir = path.join(config.jobsDir, jobId);
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
        logger.info(`Admin deleted job ${jobId}`);
        return res.status(200).json({ success: true, message: `Job ${jobId} deleted.` });
      }

      return res.status(404).json({ success: false, error: { message: 'Job directory not found.' } });
    } catch (err) {
      logger.error('Admin delete job failed', err);
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  /**
   * Triggers garbage collection of expired jobs
   */
  cleanupExpired(req, res) {
    try {
      const cleaned = storageService.cleanupExpiredJobs();
      return res.status(200).json({
        success: true,
        cleanedCount: cleaned,
        message: `Garbage collection purged ${cleaned} expired job(s).`
      });
    } catch (err) {
      logger.error('Admin cleanup expired failed', err);
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  /**
   * Emergency wipe of all temporary job directories
   */
  wipeAll(req, res) {
    try {
      const jobsDir = config.jobsDir;
      let count = 0;

      if (fs.existsSync(jobsDir)) {
        const entries = fs.readdirSync(jobsDir);
        for (const entry of entries) {
          if (!isSafeIdentifier(entry)) continue;
          const jobDir = path.join(jobsDir, entry);
          fs.rmSync(jobDir, { recursive: true, force: true });
          count++;
        }
      }

      logger.warn(`Admin emergency wiped all temp storage (${count} jobs removed)`);
      return res.status(200).json({
        success: true,
        deletedCount: count,
        message: `Successfully wiped all ${count} temporary job directories.`
      });
    } catch (err) {
      logger.error('Admin wipe all failed', err);
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }

  /**
   * Recursively computes directory size in bytes
   */
  getDirectorySize(dirPath) {
    let size = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          size += this.getDirectorySize(fullPath);
        } else {
          size += stat.size;
        }
      }
    } catch {
      return 0;
    }
    return size;
  }
}

module.exports = new AdminController();
