const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.FRONTEND_PORT || 5500;
const publicDir = path.resolve(__dirname, '..', 'public');

app.use(express.static(publicDir));

// Route fallbacks
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

app.listen(PORT, () => {
  console.log(`===============================================================`);
  console.log(`     PDFNova Standalone Frontend Server Running`);
  console.log(`     URL: http://localhost:${PORT} or http://127.0.0.1:${PORT}`);
  console.log(`     Connected Backend: http://localhost:3000`);
  console.log(`===============================================================`);
});
