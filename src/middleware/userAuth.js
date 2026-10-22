const authService = require('../services/authService');

function extractToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7).trim();
  }
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'];
  }
  if (req.query && req.query.authToken) {
    return req.query.authToken;
  }
  return null;
}

/**
 * Required User Auth: blocks requests without a valid session token
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in.' }
    });
  }

  const user = authService.verifySession(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' }
    });
  }

  req.user = user;
  req.authToken = token;
  next();
}

/**
 * Optional User Auth: attaches req.user if a valid token is present, but allows guests
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const user = authService.verifySession(token);
    if (user) {
      req.user = user;
      req.authToken = token;
    }
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
