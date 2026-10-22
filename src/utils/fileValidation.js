const fs = require('fs');
const path = require('path');

const MAGIC_SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47], // .PNG
  jpeg: [0xff, 0xd8, 0xff],       // JPEG
  zip: [0x50, 0x4b, 0x03, 0x04]   // PK (DOCX, PPTX, XLSX, ZIP)
};

/**
 * Checks if buffer matches signature
 */
function matchesSignature(buffer, signature) {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Reads first N bytes of a file safely
 */
function readFileHeader(filePath, bytes = 16) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    const bytesRead = fs.readSync(fd, buffer, 0, bytes, 0);
    fs.closeSync(fd);
    return buffer.subarray(0, bytesRead);
  } catch {
    return Buffer.alloc(0);
  }
}

/**
 * Validates if a file is a valid PDF
 */
function isValidPdf(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const header = readFileHeader(filePath, 8);
  return matchesSignature(header, MAGIC_SIGNATURES.pdf);
}

/**
 * Validates if an image file has valid signature (JPEG/PNG/WEBP)
 */
function isValidImage(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const header = readFileHeader(filePath, 12);
  if (matchesSignature(header, MAGIC_SIGNATURES.jpeg)) return true;
  if (matchesSignature(header, MAGIC_SIGNATURES.png)) return true;
  // WEBP: RIFF....WEBP
  if (header.length >= 12 &&
      header.toString('ascii', 0, 4) === 'RIFF' &&
      header.toString('ascii', 8, 12) === 'WEBP') {
    return true;
  }
  return false;
}

/**
 * Sanitizes a filename, strips paths and illegal characters
 */
function sanitizeFileName(rawName, defaultExt = '.pdf') {
  if (!rawName || typeof rawName !== 'string') {
    return `document_${Date.now()}${defaultExt}`;
  }
  const basename = path.basename(rawName).replace(/[^\w.\- ]/g, '_').trim();
  const safe = basename.replace(/\s+/g, '_');
  return safe || `document_${Date.now()}${defaultExt}`;
}

/**
 * Checks for path traversal in job IDs or parameters
 */
function isSafeIdentifier(id) {
  if (!id || typeof id !== 'string') return false;
  // Only alphanumeric and dashes/underscores allowed (UUID format)
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

module.exports = {
  isValidPdf,
  isValidImage,
  sanitizeFileName,
  isSafeIdentifier,
  readFileHeader
};
