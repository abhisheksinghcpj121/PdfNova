const crypto = require('crypto');
const config = require('../config');

function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  let providedKey = req.headers['x-admin-key'] || req.query.adminKey;

  if (!providedKey && authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7).trim();
  }

  if (!providedKey || typeof providedKey !== 'string') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED_ADMIN',
        message: 'Admin authorization key is required to access administrative controls.'
      }
    });
  }

  const expectedKey = config.adminKey;
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_ADMIN',
        message: 'Invalid administrative security key.'
      }
    });
  }

  next();
}

module.exports = adminAuth;
