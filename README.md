# PDFNova — Production-Grade Modern PDF Tools & Editor Platform

![PDFNova Platform](public/favicon.ico)

PDFNova is a complete, production-ready, security-first online PDF platform built with **Node.js, Express, and Vanilla HTML5/CSS3/JavaScript**. It features a modern, responsive SaaS interface preserving the original PDFNova visual identity (soft light `#F7F8FC`, primary coral-red `#E94350`, violet `#7046D0`, mint `#E1F5EC`, light blue `#E2EDFF`, and dark navy `#0F172A`).

Every tool card and action is wired to a genuine, fully operational backend engine. There are **zero simulated mockups or fake buttons**.

---

## 🚀 Key Functional Features

| Tool | Engine / Library | Description |
| :--- | :--- | :--- |
| **Merge PDF** | `pdf-lib` | Combine multiple PDFs in custom order into one document. |
| **Split PDF** | `pdf-lib` + `archiver` | Extract page ranges (e.g. `1-3, 5, 8-10`) or all pages as a ZIP archive. |
| **Compress PDF** | `pdf-lib` stream optimizer | Streamlined compression presets (*Recommended*, *Light*, *Extreme*) with before/after size diff. |
| **Rotate PDF** | `pdf-lib` | Rotate all or targeted pages by 90°, 180°, or 270°. |
| **Delete Pages** | `pdf-lib` | Remove unwanted page numbers cleanly. |
| **Organize Pages** | `pdf-lib` | Reorder, extract, or duplicate page sequences. |
| **PDF to Word (.docx)** | `docx` + text parser | Converts PDF text structure directly into a genuine editable `.docx` document **without requiring LibreOffice**! |
| **PDF to JPG / PNG** | `PDFParse` + `sharp` | Renders PDF pages to crisp images; bundles multi-page exports in ZIP archives. |
| **JPG / PNG to PDF** | `sharp` + `pdf-lib` | Converts photos and screenshots into formatted multi-page PDFs. |
| **Add Watermark** | `pdf-lib` | Diagonal or centered text stamps with custom opacity, color, and font metrics. |
| **Add Page Numbers** | `pdf-lib` | Formatted page numbering (`Page {n} of {total}`) in headers or footers. |
| **Password Protect** | `@pdfsmaller/pdf-encrypt` | Standard AES-256 military-grade encryption compatible with Adobe Acrobat. |
| **Unlock PDF** | `@pdfsmaller/pdf-decrypt` | Decrypts protected documents using the correct password. |
| **OCR (Scan to PDF)** | `tesseract.js v7` | Optical Character Recognition for scanned files with confidence scores and transcription. |
| **Admin Console** | Storage & System Ops | Live ephemeral sandbox monitoring, memory heap stats, purge expired jobs, and emergency disk wipe. |
| **Office to PDF** | LibreOffice Headless | Headless conversion for `.docx`, `.xlsx`, `.pptx` (auto-detected; clear status guide if absent). |
| **PDF Editor Workspace** | `PDF.js` + Canvas | Visual editor with page thumbnails, zoom, page actions, text annotations, highlighter, boxes, and **interactive signature pad**. |
| **Delete-Now & Expiry** | Sandboxed Filesystem | Live countdown timer and instant "Delete File Now" capability token wipe. |

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Standard HTML5, CSS3, Vanilla JavaScript (ES6+ modular). No React, Vue, or Angular.
- **Client PDF Viewer**: Local bundled `PDF.js` (in `public/vendor/pdfjs/`) with HTML5 Canvas.
- **Backend**: Node.js with Express 5.
- **Security**: `helmet`, `cors`, `express-rate-limit`, cryptographic capability tokens.
- **File Uploads**: `multer` with MIME/extension filters and file size validation.
- **Storage**: Ephemeral sandboxed job storage (`temp/jobs/<UUID>/`) with automated scheduled cleanup. No database dependency.

---

## 📁 Project Structure

```text
pdf/
├── public/                     # Frontend static assets
│   ├── css/
│   │   └── main.css            # Complete design system & responsive styling
│   ├── js/
│   │   ├── api.js              # REST client with XHR progress & job history
│   │   ├── editor.js           # PDF.js visual editor & annotation engine
│   │   ├── main.js             # Homepage interactions, search & filters
│   │   ├── theme.js            # Dark / Light mode toggle persistence
│   │   ├── tool-page.js        # Reusable tool page runner & drag-and-drop
│   │   └── tools-data.js       # Central registry of tools, categories & tips
│   ├── vendor/
│   │   └── pdfjs/              # Local bundled PDF.js (pdf.min.js, pdf.worker.min.js)
│   ├── index.html              # Homepage
│   ├── tool.html               # Reusable tool runner page
│   ├── editor.html             # PDF preview & visual editor workspace
│   ├── about.html              # About PDFNova & architecture
│   ├── faq.html                # Help & Frequently Asked Questions
│   ├── privacy.html            # Privacy & Security policy
│   └── 404.html                # Custom 404 Page Not Found
├── src/                        # Node.js Express backend
│   ├── config/
│   │   └── index.js            # Environment configuration & limits
│   ├── controllers/
│   │   └── pdfController.js    # REST API controllers & capability endpoints
│   ├── middleware/
│   │   ├── errorHandler.js     # Sanitized safe error handler (no leaked paths)
│   │   ├── rateLimiter.js      # Rate limiting middleware
│   │   └── upload.js           # Multer storage in isolated job sandboxes
│   ├── routes/
│   │   └── api.js              # API route definitions (/api/pdf/*, /api/jobs/*)
│   ├── services/
│   │   ├── pdfService.js       # Core PDF engine (pdf-lib, sharp, docx, tesseract)
│   │   └── storageService.js   # Ephemeral directory sandbox & scheduled garbage collection
│   ├── utils/
│   │   ├── fileValidation.js   # Magic number signatures & path traversal prevention
│   │   └── logger.js           # Sanitized logging without document contents
│   ├── app.js                  # Express application setup & middleware
│   └── server.js               # HTTP server entry point & cleanup interval
├── temp/                       # Ephemeral temporary processing sandboxes (gitignored)
├── tests/                      # Automated integration and security test suite
│   └── pdf.test.js             # 15 comprehensive unit & integration tests
├── .env                        # Local environment configuration
├── .env.example                # Template for environment configuration
├── .gitignore                  # Git ignore rules for node_modules, temp, etc.
├── package.json                # NPM dependencies & scripts
└── README.md                   # Complete documentation
```

---

## ⚙️ Environment Configuration (`.env`)

Copy `.env.example` to `.env` (already created with sensible defaults):

```env
PORT=3000
NODE_ENV=development
TEMP_DIR=temp
JOB_TTL_MINUTES=60
CLEANUP_INTERVAL_MINUTES=15
MAX_FILE_SIZE_MB=50
MAX_BATCH_FILES=20
PROCESSING_TIMEOUT_MS=60000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=120
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500
LIBREOFFICE_PATH=
```

---

## 🖥️ Running on Windows: Exact Commands & Steps

### 1. Backend Server (Node.js & Express)

#### Option A: Using Windows Command Prompt (`cmd.exe`)
Open Command Prompt in the project folder and run:
```cmd
npm start
```
Or for development with auto-reload:
```cmd
npm run dev
```

#### Option B: Using Windows PowerShell
If PowerShell script execution is restricted on your system (`PSSecurityException`), run:
```powershell
cmd.exe /c npm start
```
*Or temporarily bypass execution policy for the current session:*
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm start
```

When started, the backend outputs:
```text
===============================================================
              PDFNova - Production PDF Platform
===============================================================
 Server running at: http://localhost:3000
 Environment:       development
 Max File Size:     50 MB
 Job TTL:           60 minutes
 LibreOffice:       OPTIONAL (NOT INSTALLED)
 OCR Engine:        Tesseract.js active
 Ready for requests!
===============================================================
```

---

### 2. Frontend Access

#### Method 1: Integrated (Recommended)
Open your browser and navigate directly to:
👉 **[http://localhost:3000](http://localhost:3000)**

Express serves all static HTML, CSS, JS, and PDF.js vendor assets directly from `public/` alongside the `/api/` endpoints.

#### Method 2: Running Frontend via VS Code "Live Server"
If you prefer developing the frontend using VS Code's **Live Server** extension:
1. Ensure the Node backend is running on `http://localhost:3000`.
2. In VS Code, right-click `public/index.html` and click **"Open with Live Server"** (runs on port `5500`).
3. Open `http://127.0.0.1:5500` in your browser.
4. **CORS is pre-configured**: `public/js/api.js` detects Live Server automatically and routes all REST API requests to `http://localhost:3000`.

#### Method 3: Standalone Frontend via NPX
```cmd
npx serve public -p 5500
```
Then open `http://localhost:5500`.

---

## 🛡️ Admin Operations Console

PDFNova includes a dedicated, secure **Admin Console** at `/admin` (or [`public/admin.html`](file:///c:/Users/mayan/OneDrive/Desktop/pdf/public/admin.html)).

- **URL**: `http://localhost:3000/admin` (or `http://localhost:3000/admin.html`)
- **Default Security Key**: `pdfnova_admin_secret_2026` (configurable via `ADMIN_KEY` in `.env`)
- **Features**:
  - Live metric cards: Active Sandboxes, Storage Consumed (Bytes/MB), V8 Heap Memory, and Server Uptime.
  - Active Job Sandboxes table: Inspects all directories in `temp/jobs/`, display timestamps, remaining time before auto-expiry, and force-delete buttons.
  - One-click **"Purge Expired Jobs"** garbage collection button.
  - **"Emergency Wipe All"** with prompt verification for immediate clean slate.
  - Engine & environment diagnostics: Node.js version, platform, LibreOffice status, Tesseract OCR version, and configuration limits.

---

## 🧪 Running Automated Tests

Run the complete integration and security test suite:
```cmd
npm test
```
*(On Windows PowerShell, use `cmd.exe /c npm test`)*

### Verified Test Results:
```text
PASS tests/pdf.test.js
  PDFNova Integration and Security Test Suite
    1. System and Health Endpoints
      ✓ GET /api/health returns healthy status
      ✓ GET /api/system/capabilities reports engine status
    2. Core PDF Operations
      ✓ POST /api/pdf/merge combines multiple PDFs
      ✓ POST /api/pdf/compress reduces or optimizes PDF streams
      ✓ POST /api/pdf/rotate rotates pages by specified angle
      ✓ POST /api/pdf/watermark applies watermark to PDF pages
      ✓ POST /api/pdf/page-numbers stamps page numbers
      ✓ POST /api/pdf/protect encrypts PDF with password and /unlock decrypts it
      ✓ POST /api/pdf/images-to-pdf converts images to PDF document
      ✓ POST /api/pdf/pdf-to-word produces valid .docx Word document
    3. Security, Authorization, and Storage Lifecycle
      ✓ Rejects invalid file extensions (e.g. .exe)
      ✓ Blocks download access without valid capability token
      ✓ Prevents path traversal and invalid identifiers in jobId parameter
      ✓ Immediate delete endpoint removes job files immediately from disk
      ✓ Scheduled cleanup removes expired jobs

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

---

## 🔒 Security Architecture

1. **Job Directory Sandboxing**: Each request generates a cryptographically random UUID v4. Uploads and processed outputs are stored in `temp/jobs/<UUID>/inputs` and `temp/jobs/<UUID>/outputs`. User filenames are stripped of path delimiters to prevent directory traversal.
2. **Capability Token Gating**: Every output download and deletion requires a 24-byte random hexadecimal token (`?token=...`). Job IDs cannot be guessed or iterated.
3. **Automated Scheduled Cleanup**: An unreferenced background timer runs every 15 minutes, inspecting file expiration timestamps (`expiresAt`) and removing expired directories. Cleanup also executes automatically on server boot.
4. **Immediate Deletion**: Users can click **"Delete File Now"** in the result card to wipe their document and job folder from server disk instantly.
5. **No Persistent Database / Cloud Storage**: Documents are strictly ephemeral. No documents or sensitive metadata are written to permanent databases.
6. **Safe Error Handling**: Internal paths and stack traces are suppressed in API responses to prevent information leakage.

---

## 📦 Optional External Dependencies (LibreOffice)

- **PDF to Word**: Works **100% natively** without LibreOffice via pure JavaScript (`pdf-parse` + `docx`).
- **Word / Excel / PowerPoint to PDF**: Requires LibreOffice headless on the host machine.
  - Windows install: `winget install TheDocumentFoundation.LibreOffice`
  - Linux install: `sudo apt-get install libreoffice --no-install-recommends`
  - Set executable path in `.env`: `LIBREOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"`
  - If LibreOffice is absent, the UI clearly displays the requirement and directs users appropriately.

---

## 📄 License
MIT © 2026 PDFNova Team.
