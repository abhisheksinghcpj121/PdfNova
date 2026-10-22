const multer = require('multer');
const logger = require('../utils/logger');
const config = require('../config');

function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  logger.error('API Error Encountered', err);

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred while processing your document.';

  // Multer errors
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorCode = 'FILE_TOO_LARGE';
      message = `Uploaded file exceeds the maximum limit of ${config.limits.maxFileSizeMb}MB.`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      errorCode = 'TOO_MANY_FILES';
      message = `Cannot upload more than ${config.limits.maxBatchFiles} files at once.`;
    } else {
      errorCode = 'UPLOAD_ERROR';
      message = err.message;
    }
  } else if (err.name === 'ValidationError' || err.status === 400) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.status === 404) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message;
  } else if (err.status === 403) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = err.message;
  } else if (err.message && (
    err.message.includes('password') ||
    err.message.includes('encrypted') ||
    err.message.includes('LibreOffice') ||
    err.message.includes('supported') ||
    err.message.includes('invalid') ||
    err.message.includes('required')
  )) {
    // Known safe application messages
    statusCode = 400;
    errorCode = 'BAD_REQUEST';
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(config.env === 'development' && statusCode === 500 ? { devDetails: err.message } : {})
    }
  });
}

module.exports = errorHandler;
