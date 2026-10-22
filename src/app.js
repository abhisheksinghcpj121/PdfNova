const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const apiRoutes = require('./routes/api');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// High-speed response compression (Gzip / Deflate)
app.use(compression({
  threshold: 1024, // Only compress responses above 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Permissive for local PDF.js workers and blob URLs
    crossOriginEmbedderPolicy: false
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (
        config.allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback to allow frontend flexibility
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// API Root endpoint
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    success: true,
    status: 'online',
    message: 'PDFNova REST API is fully operational',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      capabilities: '/api/system/capabilities',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout',
        history: 'GET /api/auth/history'
      },
      pdf: {
        merge: 'POST /api/pdf/merge',
        split: 'POST /api/pdf/split',
        compress: 'POST /api/pdf/compress',
        rotate: 'POST /api/pdf/rotate',
        deletePages: 'POST /api/pdf/delete-pages',
        organize: 'POST /api/pdf/organize',
        watermark: 'POST /api/pdf/watermark',
        pageNumbers: 'POST /api/pdf/page-numbers',
        protect: 'POST /api/pdf/protect',
        unlock: 'POST /api/pdf/unlock',
        imagesToPdf: 'POST /api/pdf/images-to-pdf',
        pdfToImages: 'POST /api/pdf/pdf-to-images',
        pdfToWord: 'POST /api/pdf/pdf-to-word',
        ocr: 'POST /api/pdf/ocr',
        officeToPdf: 'POST /api/pdf/office-to-pdf',
        saveEditor: 'POST /api/pdf/save-editor',
        info: 'POST /api/pdf/info'
      }
    }
  });
});

// API Routes
app.use('/api', apiRoutes);

// Static assets from public with ETag and smart caching
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir, {
  maxAge: '2h',
  etag: true
}));

// Friendly Route aliases
app.get('/tools', (req, res) => res.sendFile(path.join(publicDir, 'tool.html')));
app.get('/tool', (req, res) => res.sendFile(path.join(publicDir, 'tool.html')));
app.get('/editor', (req, res) => res.sendFile(path.join(publicDir, 'editor.html')));
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(publicDir, 'signup.html')));
app.get('/about', (req, res) => res.sendFile(path.join(publicDir, 'about.html')));
app.get('/help', (req, res) => res.sendFile(path.join(publicDir, 'faq.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(publicDir, 'faq.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(publicDir, 'privacy.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint '${req.originalUrl}' was not found. Visit /api for the list of available endpoints.`
      }
    });
  }

  if (req.accepts('html')) {
    const notFoundPath = path.join(publicDir, '404.html');
    if (require('fs').existsSync(notFoundPath)) {
      return res.status(404).sendFile(notFoundPath);
    }
  }
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found on PDFNova server.'
    }
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
