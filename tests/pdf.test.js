const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');
const app = require('../src/app');
const storageService = require('../src/services/storageService');
const config = require('../src/config');

// Helper to generate a valid test PDF in memory
async function createTestPdf(text = 'PDFNova Test Document', pagesCount = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pagesCount; i++) {
    const page = doc.addPage([400, 400]);
    page.drawText(`${text} - Page ${i}`, {
      x: 50,
      y: 350,
      size: 18,
      font,
      color: rgb(0.2, 0.2, 0.2)
    });
  }

  return Buffer.from(await doc.save());
}

// Helper to generate a valid test image
async function createTestImage() {
  return await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 233, g: 67, b: 80, alpha: 1 }
    }
  }).png().toBuffer();
}

describe('PDFNova Integration and Security Test Suite', () => {

  let testPdfBuffer1;
  let testPdfBuffer2;
  let testImageBuffer;

  beforeAll(async () => {
    testPdfBuffer1 = await createTestPdf('Test Doc 1', 1);
    testPdfBuffer2 = await createTestPdf('Test Doc 2', 2);
    testImageBuffer = await createTestImage();
  });

  afterAll(() => {
    // Cleanup any lingering temp job files created during test
    storageService.cleanupExpiredJobs();
  });

  describe('1. System and Health Endpoints', () => {
    test('GET /api/health returns healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptime).toBe('number');
    });

    test('GET /api/system/capabilities reports engine status', async () => {
      const res = await request(app).get('/api/system/capabilities');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.capabilities).toBeDefined();
      expect(res.body.capabilities.pdfLib.available).toBe(true);
      expect(res.body.capabilities.tesseractOcr.available).toBe(true);
      expect(res.body.capabilities.imageEngine.available).toBe(true);
    });
  });

  describe('2. Core PDF Operations', () => {
    test('POST /api/pdf/merge combines multiple PDFs', async () => {
      const res = await request(app)
        .post('/api/pdf/merge')
        .attach('files', testPdfBuffer1, 'doc1.pdf')
        .attach('files', testPdfBuffer2, 'doc2.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.jobId).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.downloadUrl).toContain('/download?token=');
      expect(res.body.stats.pageCount).toBe(3); // 1 + 2 pages
    });

    test('POST /api/pdf/compress reduces or optimizes PDF streams', async () => {
      const res = await request(app)
        .post('/api/pdf/compress')
        .attach('file', testPdfBuffer2, 'uncompressed.pdf')
        .field('level', 'extreme');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.outputSize).toBeGreaterThan(0);
      expect(res.body.stats.pageCount).toBe(2);
    });

    test('POST /api/pdf/rotate rotates pages by specified angle', async () => {
      const res = await request(app)
        .post('/api/pdf/rotate')
        .attach('file', testPdfBuffer1, 'rotate.pdf')
        .field('angle', '90')
        .field('pages', 'all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.pageCount).toBe(1);
    });

    test('POST /api/pdf/watermark applies watermark to PDF pages', async () => {
      const res = await request(app)
        .post('/api/pdf/watermark')
        .attach('file', testPdfBuffer1, 'watermark.pdf')
        .field('text', 'TOP SECRET')
        .field('opacity', '0.3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.pageCount).toBe(1);
    });

    test('POST /api/pdf/page-numbers stamps page numbers', async () => {
      const res = await request(app)
        .post('/api/pdf/page-numbers')
        .attach('file', testPdfBuffer2, 'numbers.pdf')
        .field('position', 'bottom-center')
        .field('format', 'Page {n} of {total}');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.pageCount).toBe(2);
    });

    test('POST /api/pdf/protect encrypts PDF with password and /unlock decrypts it', async () => {
      // 1. Protect
      const protectRes = await request(app)
        .post('/api/pdf/protect')
        .attach('file', testPdfBuffer1, 'plain.pdf')
        .field('password', 'secretNova2026');

      expect(protectRes.status).toBe(200);
      expect(protectRes.body.success).toBe(true);

      // Download encrypted PDF bytes
      const dlRes = await request(app).get(protectRes.body.downloadUrl);
      expect(dlRes.status).toBe(200);
      const encryptedPdfBytes = dlRes.body;

      // 2. Unlock with correct password
      const unlockRes = await request(app)
        .post('/api/pdf/unlock')
        .attach('file', encryptedPdfBytes, 'locked.pdf')
        .field('password', 'secretNova2026');

      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.success).toBe(true);
      expect(unlockRes.body.stats.unlocked).toBe(true);

      // 3. Unlock with wrong password fails safely
      const failUnlockRes = await request(app)
        .post('/api/pdf/unlock')
        .attach('file', encryptedPdfBytes, 'locked.pdf')
        .field('password', 'wrongPassword');

      expect(failUnlockRes.status).toBe(400);
      expect(failUnlockRes.body.success).toBe(false);
    });

    test('POST /api/pdf/images-to-pdf converts images to PDF document', async () => {
      const res = await request(app)
        .post('/api/pdf/images-to-pdf')
        .attach('files', testImageBuffer, 'photo1.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.pageCount).toBe(1);
    });

    test('POST /api/pdf/pdf-to-word produces valid .docx Word document', async () => {
      const res = await request(app)
        .post('/api/pdf/pdf-to-word')
        .attach('file', testPdfBuffer1, 'document.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.downloadFileName).toContain('.docx');
      expect(res.body.stats.outputSize).toBeGreaterThan(1000);
    });
  });

  describe('3. Security, Authorization, and Storage Lifecycle', () => {
    test('Rejects invalid file extensions (e.g. .exe)', async () => {
      const fakeExe = Buffer.from('MZ...executable payload');
      const res = await request(app)
        .post('/api/pdf/compress')
        .attach('file', fakeExe, 'malicious.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not supported');
    });

    test('Blocks download access without valid capability token', async () => {
      // Create a valid job first
      const jobRes = await request(app)
        .post('/api/pdf/compress')
        .attach('file', testPdfBuffer1, 'doc.pdf');

      const jobId = jobRes.body.jobId;

      // Access without token
      const noTokenRes = await request(app).get(`/api/jobs/${jobId}/download`);
      expect(noTokenRes.status).toBe(403);
      expect(noTokenRes.body.error.code).toBe('UNAUTHORIZED');

      // Access with invalid/tampered token
      const badTokenRes = await request(app).get(`/api/jobs/${jobId}/download?token=forgedtoken1234567890`);
      expect(badTokenRes.status).toBe(403);
      expect(badTokenRes.body.error.code).toBe('UNAUTHORIZED');

      // Access with correct token succeeds
      const goodTokenRes = await request(app).get(jobRes.body.downloadUrl);
      expect(goodTokenRes.status).toBe(200);
      expect(goodTokenRes.header['content-type']).toBe('application/pdf');
    });

    test('Prevents path traversal and invalid identifiers in jobId parameter', async () => {
      const traversalRes = await request(app).get('/api/jobs/invalid..traversal..id/download?token=xyz');
      expect(traversalRes.status).toBe(400);
      expect(traversalRes.body.error.code).toBe('INVALID_JOB_ID');
    });

    test('Immediate delete endpoint removes job files immediately from disk', async () => {
      const jobRes = await request(app)
        .post('/api/pdf/compress')
        .attach('file', testPdfBuffer1, 'to_delete.pdf');

      const { jobId, token, deleteUrl } = jobRes.body;

      // Ensure job folder exists
      const jobDir = path.join(config.jobsDir, jobId);
      expect(fs.existsSync(jobDir)).toBe(true);

      // Perform immediate delete
      const delRes = await request(app).delete(deleteUrl);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify folder was deleted from disk
      expect(fs.existsSync(jobDir)).toBe(false);

      // Subsequent download attempt fails with 404 or 403
      const afterRes = await request(app).get(jobRes.body.downloadUrl);
      expect([403, 404]).toContain(afterRes.status);
    });

    test('Scheduled cleanup removes expired jobs', () => {
      // Create an expired dummy job
      const { jobId, token } = storageService.createJob('test');
      const pastDate = new Date(Date.now() - 100000); // in the past

      storageService.updateJobMeta(jobId, {
        expiresAt: pastDate.toISOString()
      });

      const jobDir = path.join(config.jobsDir, jobId);
      expect(fs.existsSync(jobDir)).toBe(true);

      // Run cleanup
      const cleaned = storageService.cleanupExpiredJobs();
      expect(cleaned).toBeGreaterThanOrEqual(1);

      // Verify expired directory was purged
      expect(fs.existsSync(jobDir)).toBe(false);
    });
  });

  describe('4. Administrative Operations and Controls', () => {
    test('POST /api/admin/auth rejects missing or invalid admin key', async () => {
      const resNoKey = await request(app).post('/api/admin/auth');
      expect([401, 403]).toContain(resNoKey.status);

      const resBadKey = await request(app)
        .post('/api/admin/auth')
        .set('x-admin-key', 'wrong_key');
      expect(resBadKey.status).toBe(403);
    });

    test('POST /api/admin/auth succeeds with valid key', async () => {
      const res = await request(app)
        .post('/api/admin/auth')
        .set('x-admin-key', config.adminKey);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('GET /api/admin/metrics returns system resources and storage info', async () => {
      const res = await request(app)
        .get('/api/admin/metrics')
        .set('x-admin-key', config.adminKey);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics.system).toBeDefined();
      expect(res.body.metrics.storage).toBeDefined();
      expect(res.body.metrics.capabilities).toBeDefined();
    });

    test('GET /api/admin/jobs lists active job sandboxes', async () => {
      const res = await request(app)
        .get('/api/admin/jobs')
        .set('x-admin-key', config.adminKey);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    test('POST /api/admin/cleanup purges expired jobs via admin control', async () => {
      const res = await request(app)
        .post('/api/admin/cleanup')
        .set('x-admin-key', config.adminKey);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.cleanedCount).toBe('number');
    });
  });

});
