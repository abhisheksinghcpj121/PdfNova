/**
 * PDFNova Tools Registry
 * Central metadata for all tools, categories, endpoints, and options
 */
const PDF_TOOLS = [
  {
    id: 'merge',
    name: 'Merge PDF',
    category: 'edit-organize',
    categoryLabel: 'Edit & Organize',
    description: 'Combine multiple PDFs into one unified document with custom ordering.',
    icon: 'coral',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><path d="M12 8v8m-4-4h8"/></svg>`,
    endpoint: '/api/pdf/merge',
    multiple: true,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Merge PDF',
    tips: [
      'Add multiple PDF files in the order you want them merged.',
      'Drag and drop rows to reorder documents before merging.',
      'Maximum file size: 50 MB each.',
      'Maximum files in batch: 20 files.'
    ],
    options: []
  },
  {
    id: 'split',
    name: 'Split PDF',
    category: 'edit-organize',
    categoryLabel: 'Edit & Organize',
    description: 'Extract individual pages or split into multiple files by custom page ranges.',
    icon: 'violet',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
    endpoint: '/api/pdf/split',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Split PDF',
    tips: [
      'Enter page ranges separated by commas (e.g., 1-3, 5, 8-10).',
      'Leave blank or write "all" to export every single page.',
      'Multiple parts will be cleanly packaged into a ZIP archive.'
    ],
    options: [
      {
        id: 'ranges',
        label: 'Page Ranges to Extract',
        type: 'text',
        placeholder: 'e.g. 1-3, 5, 7-10 or "all"',
        defaultValue: 'all'
      }
    ]
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    category: 'optimize',
    categoryLabel: 'Optimize PDF',
    description: 'Reduce file size while preserving high visual quality and typography.',
    icon: 'mint',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
    endpoint: '/api/pdf/compress',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Compress PDF',
    tips: [
      'Recommended compression strikes an optimal balance between size and crisp quality.',
      'Extreme compression removes metadata and aggressively packs object streams.'
    ],
    options: [
      {
        id: 'level',
        label: 'Compression Preset',
        type: 'select',
        options: [
          { value: 'recommended', label: 'Recommended (Optimal balance)' },
          { value: 'low', label: 'Light Compression (High quality)' },
          { value: 'extreme', label: 'Extreme Compression (Smallest size)' }
        ],
        defaultValue: 'recommended'
      }
    ]
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    category: 'convert-from',
    categoryLabel: 'Convert from PDF',
    description: 'Convert PDF to an editable Microsoft Word document (.docx).',
    icon: 'blue',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    endpoint: '/api/pdf/pdf-to-word',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Convert to Word',
    tips: [
      'Converts paragraphs, headings, and text cleanly into genuine .docx format.',
      'Works completely in Node.js without requiring external software.'
    ],
    options: []
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    category: 'convert-from',
    categoryLabel: 'Convert from PDF',
    description: 'Convert every PDF page into sharp JPG or PNG images.',
    icon: 'amber',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    endpoint: '/api/pdf/pdf-to-images',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Convert to Images',
    tips: [
      'Each page will be rendered at crisp high-DPI resolution.',
      'Multi-page files will be delivered in a convenient ZIP package.'
    ],
    options: [
      {
        id: 'format',
        label: 'Image Format',
        type: 'select',
        options: [
          { value: 'jpg', label: 'JPG (Smaller file size)' },
          { value: 'png', label: 'PNG (Lossless sharpness)' }
        ],
        defaultValue: 'jpg'
      }
    ]
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    category: 'convert-to',
    categoryLabel: 'Convert to PDF',
    description: 'Convert images (JPG, PNG, WebP) into a clean, paginated PDF.',
    icon: 'blue',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    endpoint: '/api/pdf/images-to-pdf',
    multiple: true,
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    popular: true,
    buttonText: 'Create PDF',
    tips: [
      'You can select multiple photos or screenshots simultaneously.',
      'Reorder them in the list to determine page sequence in the output PDF.'
    ],
    options: []
  },
  {
    id: 'rotate',
    name: 'Rotate PDF',
    category: 'edit-organize',
    categoryLabel: 'Edit & Organize',
    description: 'Rotate PDF pages clockwise, upside-down, or counter-clockwise easily.',
    icon: 'violet',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    endpoint: '/api/pdf/rotate',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Rotate PDF',
    tips: [
      'Rotate all pages or target specific page numbers.',
      'Supports 90°, 180°, and 270° orientation.'
    ],
    options: [
      {
        id: 'angle',
        label: 'Rotation Direction',
        type: 'select',
        options: [
          { value: '90', label: '90° Clockwise' },
          { value: '180', label: '180° Flip Upside-Down' },
          { value: '270', label: '90° Counter-Clockwise' }
        ],
        defaultValue: '90'
      },
      {
        id: 'pages',
        label: 'Pages to Rotate',
        type: 'text',
        placeholder: 'e.g. 1, 3-5 or "all"',
        defaultValue: 'all'
      }
    ]
  },
  {
    id: 'delete-pages',
    name: 'Delete Pages',
    category: 'edit-organize',
    categoryLabel: 'Edit & Organize',
    description: 'Remove unwanted pages from your PDF document cleanly.',
    icon: 'coral',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    endpoint: '/api/pdf/delete-pages',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Delete Pages',
    tips: [
      'Specify page numbers to discard separated by commas (e.g. 2, 4, 7).',
      'At least one page must remain in the document.'
    ],
    options: [
      {
        id: 'pages',
        label: 'Page Numbers to Remove',
        type: 'text',
        placeholder: 'e.g. 2, 5, 8',
        defaultValue: ''
      }
    ]
  },
  {
    id: 'protect',
    name: 'Protect PDF',
    category: 'security',
    categoryLabel: 'Security',
    description: 'Add military-grade AES-256 password encryption to your PDF.',
    icon: 'amber',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    endpoint: '/api/pdf/protect',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Encrypt & Protect',
    tips: [
      'Uses standard AES-256 PDF encryption compatible with Adobe Acrobat and all modern readers.',
      'Make sure you remember your password; encrypted files cannot be opened without it.'
    ],
    options: [
      {
        id: 'password',
        label: 'Document Password',
        type: 'password',
        placeholder: 'Enter a strong password',
        defaultValue: ''
      }
    ]
  },
  {
    id: 'unlock',
    name: 'Unlock PDF',
    category: 'security',
    categoryLabel: 'Security',
    description: 'Remove password and security restrictions from an encrypted PDF.',
    icon: 'mint',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
    endpoint: '/api/pdf/unlock',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: true,
    buttonText: 'Unlock PDF',
    tips: [
      'Provide the valid password to decrypt and produce an open document.',
      'All security locks will be permanently removed from the new output.'
    ],
    options: [
      {
        id: 'password',
        label: 'Current Password',
        type: 'password',
        placeholder: 'Enter password to unlock',
        defaultValue: ''
      }
    ]
  },
  {
    id: 'watermark',
    name: 'Add Watermark',
    category: 'security',
    categoryLabel: 'Security',
    description: 'Stamp custom text or confidential stamps across your PDF pages.',
    icon: 'violet',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    endpoint: '/api/pdf/watermark',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: false,
    buttonText: 'Apply Watermark',
    tips: [
      'Choose watermark text like "CONFIDENTIAL", "DRAFT", or your company name.',
      'Adjust opacity and color so document readability is preserved.'
    ],
    options: [
      {
        id: 'text',
        label: 'Watermark Text',
        type: 'text',
        placeholder: 'CONFIDENTIAL',
        defaultValue: 'CONFIDENTIAL'
      },
      {
        id: 'color',
        label: 'Color',
        type: 'select',
        options: [
          { value: '#E94350', label: 'PDFNova Coral Red' },
          { value: '#7046D0', label: 'Violet' },
          { value: '#64748B', label: 'Subtle Slate Gray' },
          { value: '#DC2626', label: 'Crimson Red' }
        ],
        defaultValue: '#E94350'
      },
      {
        id: 'opacity',
        label: 'Opacity',
        type: 'select',
        options: [
          { value: '0.15', label: '15% (Very Subtle)' },
          { value: '0.25', label: '25% (Standard)' },
          { value: '0.45', label: '45% (Noticeable)' }
        ],
        defaultValue: '0.25'
      }
    ]
  },
  {
    id: 'page-numbers',
    name: 'Add Page Numbers',
    category: 'edit-organize',
    categoryLabel: 'Edit & Organize',
    description: 'Insert clean page numbering into headers or footers with custom formatting.',
    icon: 'mint',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    endpoint: '/api/pdf/page-numbers',
    multiple: false,
    accept: '.pdf,application/pdf',
    popular: false,
    buttonText: 'Add Page Numbers',
    tips: [
      'Supports formats like "Page {n} of {total}" or simply "{n}".',
      'Select position: bottom center, bottom right, or top right.'
    ],
    options: [
      {
        id: 'position',
        label: 'Number Position',
        type: 'select',
        options: [
          { value: 'bottom-center', label: 'Bottom Center' },
          { value: 'bottom-right', label: 'Bottom Right' },
          { value: 'top-right', label: 'Top Right' }
        ],
        defaultValue: 'bottom-center'
      },
      {
        id: 'format',
        label: 'Format Template',
        type: 'text',
        placeholder: 'Page {n} of {total}',
        defaultValue: 'Page {n} of {total}'
      }
    ]
  },
  {
    id: 'ocr',
    name: 'OCR (Scan to PDF)',
    category: 'view-more',
    categoryLabel: 'View & More',
    description: 'Extract text from scanned PDF documents using Tesseract OCR engine.',
    icon: 'violet',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
    endpoint: '/api/pdf/ocr',
    multiple: false,
    accept: '.pdf,application/pdf,image/*',
    popular: false,
    buttonText: 'Run OCR Recognition',
    tips: [
      'High-resolution scans yield higher text recognition confidence.',
      'Outputs both a text transcript and a searchable PDF with confidence markers.'
    ],
    options: [
      {
        id: 'lang',
        label: 'Document Language',
        type: 'select',
        options: [
          { value: 'eng', label: 'English' }
        ],
        defaultValue: 'eng'
      },
      {
        id: 'output',
        label: 'Output Result',
        type: 'select',
        options: [
          { value: 'pdf', label: 'Searchable PDF' },
          { value: 'text', label: 'Plain Text (.txt)' }
        ],
        defaultValue: 'pdf'
      }
    ]
  },
  {
    id: 'office-to-pdf',
    name: 'Word / Excel to PDF',
    category: 'convert-to',
    categoryLabel: 'Convert to PDF',
    description: 'Convert DOCX, XLSX, and PPTX office files into standard PDF format.',
    icon: 'blue',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    endpoint: '/api/pdf/office-to-pdf',
    multiple: false,
    accept: '.docx,.doc,.xlsx,.xls,.pptx,.ppt',
    popular: false,
    buttonText: 'Convert Office to PDF',
    tips: [
      'Supports Microsoft Word (.docx), Excel (.xlsx), and PowerPoint (.pptx).',
      'Powered by LibreOffice headless conversion engine on the server.'
    ],
    options: []
  }
];

const CATEGORIES = [
  { id: 'edit-organize', name: 'Edit & Organize', count: 7, iconClass: 'coral' },
  { id: 'convert-to', name: 'Convert to PDF', count: 6, iconClass: 'mint' },
  { id: 'convert-from', name: 'Convert from PDF', count: 6, iconClass: 'mint' },
  { id: 'optimize', name: 'Optimize PDF', count: 3, iconClass: 'violet' },
  { id: 'security', name: 'Security', count: 3, iconClass: 'amber' },
  { id: 'view-more', name: 'View & More', count: 4, iconClass: 'blue' }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDF_TOOLS, CATEGORIES };
}
