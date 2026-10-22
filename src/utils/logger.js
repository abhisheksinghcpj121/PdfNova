const config = require('../config');

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage('warn', message, meta));
  },
  error(message, errorOrMeta) {
    if (errorOrMeta instanceof Error) {
      const sanitized = {
        name: errorOrMeta.name,
        message: errorOrMeta.message,
        ...(config.env === 'development' ? { stack: errorOrMeta.stack } : {})
      };
      console.error(formatMessage('error', message, sanitized));
    } else {
      console.error(formatMessage('error', message, errorOrMeta));
    }
  },
  debug(message, meta) {
    if (config.env === 'development') {
      console.debug(formatMessage('debug', message, meta));
    }
  }
};

module.exports = logger;
