const express = require('express');
const multer = require('multer');
const yauzl = require('yauzl');
const path = require('path');
const fs = require('fs');
const { DOMParser } = require('xmldom');
const PDFDocument = require('pdfkit');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

app.use(express.static('public'));

// HTML interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SCORM Analyzer - Transform Your eLearning Content</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6;
                color: #1a1a1a;
                background: #ffffff;
                overflow-x: hidden;
            }
            
            /* Header */
            .header {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-bottom: 1px solid #f0f0f0;
                padding: 20px 0;
                position: sticky;
                top: 0;
                z-index: 100;
            }
            
            .nav {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .logo {
                font-size: 24px;
                font-weight: 700;
                color: #1a1a1a;
                text-decoration: none;
            }
            
            .logo-accent {
                color: #6366f1;
            }
            
            /* Hero Section */
            .hero {
                max-width: 1200px;
                margin: 0 auto;
                padding: 100px 40px 80px;
                text-align: center;
            }
            
            .hero h1 {
                font-size: clamp(48px, 8vw, 72px);
                font-weight: 700;
                line-height: 1.1;
                margin-bottom: 24px;
                letter-spacing: -0.02em;
            }
            
            .hero-gradient {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .hero p {
                font-size: 20px;
                color: #6b7280;
                margin-bottom: 40px;
                max-width: 600px;
                margin-left: auto;
                margin-right: auto;
                font-weight: 400;
            }
            
            /* Features Grid */
            .features-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 32px;
                margin: 60px 0;
                max-width: 1000px;
                margin-left: auto;
                margin-right: auto;
            }
            
            .feature-card {
                background: #ffffff;
                border: 1px solid #f3f4f6;
                border-radius: 16px;
                padding: 32px;
                text-align: center;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .feature-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                border-color: #e5e7eb;
            }
            
            .feature-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
                transform: scaleX(0);
                transition: transform 0.3s ease;
            }
            
            .feature-card:hover::before {
                transform: scaleX(1);
            }
            
            .feature-icon {
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                font-size: 28px;
                color: white;
            }
            
            .feature-card h3 {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 12px;
                color: #1f2937;
            }
            
            .feature-card p {
                color: #6b7280;
                font-size: 16px;
                line-height: 1.6;
            }
            
            /* Upload Section */
            .upload-section {
                background: #f9fafb;
                border: 2px dashed #d1d5db;
                border-radius: 24px;
                padding: 60px 40px;
                margin: 60px 0;
                text-align: center;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .upload-section:hover {
                border-color: #6366f1;
                background: #f8faff;
            }
            
            .upload-section.dragover {
                border-color: #6366f1;
                background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
                transform: scale(1.02);
            }
            
            .upload-icon {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                font-size: 36px;
                color: white;
                animation: float 6s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            .upload-section h3 {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 12px;
                color: #1f2937;
            }
            
            .upload-section p {
                color: #6b7280;
                font-size: 16px;
                margin-bottom: 32px;
            }
            
            .file-input-wrapper {
                position: relative;
                display: inline-block;
                margin-bottom: 24px;
            }
            
            .file-input {
                position: absolute;
                opacity: 0;
                width: 100%;
                height: 100%;
                cursor: pointer;
            }
            
            .file-input-button {
                background: #ffffff;
                border: 2px solid #e5e7eb;
                color: #374151;
                padding: 16px 32px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            
            .file-input-button:hover {
                border-color: #6366f1;
                color: #6366f1;
                background: #f8faff;
            }
            
            .selected-file {
                margin-top: 16px;
                padding: 12px 20px;
                background: #ecfdf5;
                border: 1px solid #d1fae5;
                border-radius: 8px;
                color: #065f46;
                font-size: 14px;
            }
            
            /* CTA Button */
            .cta-button {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: white;
                padding: 18px 48px;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                min-width: 200px;
            }
            
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 40px rgba(99, 102, 241, 0.3);
            }
            
            .cta-button:active {
                transform: translateY(0);
            }
            
            .cta-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            /* Processing State */
            .processing {
                display: none;
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                padding: 40px;
                margin: 40px 0;
                text-align: center;
            }
            
            .processing.show {
                display: block;
            }
            
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #f3f4f6;
                border-top: 3px solid #6366f1;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .processing h3 {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #1f2937;
            }
            
            .processing p {
                color: #6b7280;
                font-size: 16px;
            }
            
            /* Stats */
            .stats {
                display: flex;
                justify-content: center;
                gap: 48px;
                margin: 60px 0;
                flex-wrap: wrap;
            }
            
            .stat {
                text-align: center;
            }
            
            .stat-number {
                font-size: 36px;
                font-weight: 700;
                color: #6366f1;
                margin-bottom: 8px;
                display: block;
            }
            
            .stat-label {
                color: #6b7280;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 500;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .nav {
                    padding: 0 20px;
                }
                
                .hero {
                    padding: 60px 20px 40px;
                }
                
                .features-grid {
                    grid-template-columns: 1fr;
                    gap: 24px;
                    margin: 40px 20px;
                }
                
                .upload-section {
                    margin: 40px 20px;
                    padding: 40px 20px;
                }
                
                .stats {
                    gap: 32px;
                    margin: 40px 0;
                }
            }
            
            /* Footer */
            .footer {
                background: #f9fafb;
                padding: 40px 0;
                text-align: center;
                margin-top: 100px;
                border-top: 1px solid #f0f0f0;
            }
            
            .footer p {
                color: #6b7280;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <header class="header">
            <nav class="nav">
                <a href="/" class="logo">SCORM<span class="logo-accent">Analyzer</span></a>
                <div style="color: #6b7280; font-size: 14px;">Transform your eLearning content</div>
            </nav>
        </header>
        
        <main>
            <section class="hero">
                <h1>Transform <span class="hero-gradient">SCORM packages</span> into beautiful PDFs</h1>
                <p>Upload any SCORM package and get a comprehensive, professionally designed PDF report with all content, assessments, and interactive elements extracted and organized.</p>
                
                <div class="stats">
                    <div class="stat">
                        <span class="stat-number">100%</span>
                        <span class="stat-label">Content Extraction</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">2</span>
                        <span class="stat-label">SCORM Versions</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">∞</span>
                        <span class="stat-label">File Size Support</span>
                    </div>
                </div>
            </section>
            
            <section class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🔍</div>
                    <h3>Deep Content Analysis</h3>
                    <p>Extracts all text, images, videos, and interactive elements from your SCORM package with pixel-perfect accuracy.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📝</div>
                    <h3>Quiz & Assessment Export</h3>
                    <p>Captures all questions, multiple choice answers, and assessment details in a structured, readable format.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📄</div>
                    <h3>Professional PDF Reports</h3>
                    <p>Generates beautiful, print-ready PDFs with proper formatting, table of contents, and embedded media.</p>
                </div>
            </section>
            
            <form id="uploadForm" action="/analyze" method="post" enctype="multipart/form-data">
                <div class="upload-section" id="uploadArea">
                    <div class="upload-icon">📁</div>
                    <h3>Choose your SCORM ZIP file</h3>
                    <p>Supports SCORM 1.2 and SCORM 2004 packages up to 100MB</p>
                    
                    <div class="file-input-wrapper">
                        <input type="file" name="scormFile" accept=".zip" required class="file-input" id="fileInput">
                        <label for="fileInput" class="file-input-button">
                            📎 Select File
                        </label>
                    </div>
                    
                    <div id="selectedFile" class="selected-file" style="display: none;"></div>
                    
                    <button type="submit" class="cta-button" id="submitBtn">
                        ✨ Analyze & Generate PDF
                    </button>
                </div>
            </form>
            
            <div id="processing" class="processing">
                <div class="spinner"></div>
                <h3>Processing your SCORM package...</h3>
                <p>Extracting content, analyzing structure, and generating your beautiful PDF report</p>
            </div>
        </main>
        
        <footer class="footer">
            <p>© 2025 SCORM Analyzer. Built with ❤️ for the eLearning community.</p>
        </footer>
        
        <script>
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const selectedFile = document.getElementById('selectedFile');
            const submitBtn = document.getElementById('submitBtn');
            const uploadForm = document.getElementById('uploadForm');
            const processing = document.getElementById('processing');
            
            // File drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].name.endsWith('.zip')) {
                    fileInput.files = files;
                    showSelectedFile(files[0]);
                }
            });
            
            // File input change
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    showSelectedFile(e.target.files[0]);
                }
            });
            
            function showSelectedFile(file) {
                selectedFile.textContent = \`Selected: \${file.name} (\${formatFileSize(file.size)})\`;
                selectedFile.style.display = 'block';
                submitBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
                submitBtn.innerHTML = '🚀 Ready to Analyze';
            }
            
            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
            
            // Form submission
            uploadForm.addEventListener('submit', function(e) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Processing...';
                processing.classList.add('show');
                uploadArea.style.opacity = '0.6';
                
                // Scroll to processing area
                processing.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        </script>
    </body>
    </html>
  `);
});

// Helper function to extract and parse ZIP
function extractZip(zipPath) {
  return new Promise((resolve, reject) => {
    const files = {};
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      
      zipfile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
        } else {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const chunks = [];
            readStream.on('data', (chunk) => {
              chunks.push(chunk);
            });
            
            readStream.on('end', () => {
              const buffer = Buffer.concat(chunks);
              files[entry.fileName] = {
                buffer: buffer,
                content: buffer.toString('utf8'),
                isImage: /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(entry.fileName),
                isHTML: /\.html?$/i.test(entry.fileName),
                isCSS: /\.css$/i.test(entry.fileName),
                isJS: /\.js$/i.test(entry.fileName)
              };
              zipfile.readEntry();
            });
          });
        }
      });
      
      zipfile.on("end", () => {
        resolve(files);
      });
    });
  });
}

// Helper function to parse XML manifest
function parseManifest(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  
  const manifest = {
    identifier: '',
    version: '',
    title: '',
    description: '',
    organizations: [],
    resources: []
  };
  
  const manifestNode = doc.getElementsByTagName('manifest')[0];
  if (manifestNode) {
    manifest.identifier = manifestNode.getAttribute('identifier') || '';
    manifest.version = manifestNode.getAttribute('version') || '';
  }
  
  // Parse organizations
  const orgs = doc.getElementsByTagName('organization');
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const orgData = {
      identifier: org.getAttribute('identifier') || '',
      title: '',
      items: []
    };
    
    const title = org.getElementsByTagName('title')[0];
    if (title) {
      orgData.title = title.textContent;
      if (!manifest.title) manifest.title = title.textContent;
    }
    
    // Parse items recursively
    const parseItems = (parentElement, depth = 0) => {
      const items = [];
      const itemNodes = parentElement.getElementsByTagName('item');
      
      for (let j = 0; j < itemNodes.length; j++) {
        const item = itemNodes[j];
        if (item.parentNode === parentElement) {
          const itemData = {
            identifier: item.getAttribute('identifier') || '',
            identifierref: item.getAttribute('identifierref') || '',
            title: '',
            depth: depth,
            children: []
          };
          
          const itemTitle = item.getElementsByTagName('title')[0];
          if (itemTitle) itemData.title = itemTitle.textContent;
          
          itemData.children = parseItems(item, depth + 1);
          items.push(itemData);
        }
      }
      return items;
    };
    
    orgData.items = parseItems(org, 0);
    manifest.organizations.push(orgData);
  }
  
  // Parse resources
  const resources = doc.getElementsByTagName('resource');
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    const resourceData = {
      identifier: resource.getAttribute('identifier') || '',
      type: resource.getAttribute('type') || '',
      href: resource.getAttribute('href') || '',
      files: []
    };
    
    const files = resource.getElementsByTagName('file');
    for (let j = 0; j < files.length; j++) {
      resourceData.files.push(files[j].getAttribute('href') || '');
    }
    
    manifest.resources.push(resourceData);
  }
  
  return manifest;
}

// Function to parse HTML content and extract everything
function parseHTMLContent(htmlContent, fileName, allFiles) {
  const $ = cheerio.load(htmlContent);
  const content = {
    fileName: fileName,
    title: '',
    text: [],
    images: [],
    quizzes: [],
    interactions: [],
    links: [],
    structure: [],
    scripts: [],
    styles: []
  };
  
  // Extract title
  content.title = $('title').text() || $('h1').first().text() || fileName;
  
  // Extract all headings with hierarchy
  $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const level = parseInt(elem.tagName.charAt(1));
    const text = $(elem).text().trim();
    if (text) {
      content.structure.push({
        type: 'heading',
        level: level,
        text: text
      });
    }
  });
  
  // Extract all meaningful text content
  $('p, div.content, .lesson-content, .text-block, li, td, th, span.text').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 10 && !$(elem).closest('script, style').length) {
      content.text.push({
        type: 'paragraph',
        text: text,
        tag: elem.tagName.toLowerCase()
      });
    }
  });
  
  // Extract images with all metadata
  $('img').each((i, elem) => {
    const src = $(elem).attr('src');
    const alt = $(elem).attr('alt') || '';
    const title = $(elem).attr('title') || '';
    const width = $(elem).attr('width') || '';
    const height = $(elem).attr('height') || '';
    
    if (src) {
      content.images.push({
        src: src,
        alt: alt,
        title: title,
        width: width,
        height: height,
        caption: alt || title || src
      });
    }
  });
  
  // Extract comprehensive quiz/assessment content
  const extractQuizContent = () => {
    const quizzes = [];
    
    // Look for form-based quizzes
    $('form, .quiz, .question, .assessment, .test').each((i, elem) => {
      const quizData = {
        type: 'quiz',
        title: $(elem).find('h1, h2, h3, .quiz-title').first().text().trim() || 'Assessment',
        questions: []
      };
      
      // Find questions in various formats
      $(elem).find('.question, .quiz-question, fieldset').each((qIndex, qElem) => {
        const questionText = $(qElem).find('legend, .question-text, label:first, h4, h5').first().text().trim();
        
        if (questionText) {
          const question = {
            number: qIndex + 1,
            question: questionText,
            type: 'multiple-choice',
            answers: []
          };
          
          // Extract answers
          $(qElem).find('input[type="radio"], input[type="checkbox"]').each((aIndex, input) => {
            const $input = $(input);
            const answerText = $input.next('label').text().trim() || 
                              $input.parent().text().replace(questionText, '').trim() ||
                              $input.val();
            
            if (answerText) {
              question.answers.push({
                letter: String.fromCharCode(65 + aIndex),
                text: answerText,
                value: $input.val(),
                type: $input.attr('type')
              });
            }
          });
          
          // Look for select dropdowns
          $(qElem).find('select option').each((aIndex, option) => {
            const optionText = $(option).text().trim();
            if (optionText && optionText !== 'Select an answer') {
              question.answers.push({
                letter: String.fromCharCode(65 + aIndex),
                text: optionText,
                value: $(option).val(),
                type: 'select'
              });
            }
          });
          
          if (question.answers.length > 0) {
            quizData.questions.push(question);
          }
        }
      });
      
      if (quizData.questions.length > 0) {
        quizzes.push(quizData);
      }
    });
    
    return quizzes;
  };
  
  content.quizzes = extractQuizContent();
  
  // Extract interactive elements
  $('button, .interactive, .hotspot, .drag-drop, .clickable, input[type="button"], .btn').each((i, elem) => {
    const text = $(elem).text().trim();
    const type = $(elem).attr('class') || $(elem).attr('type') || 'button';
    const onclick = $(elem).attr('onclick') || '';
    
    if (text) {
      content.interactions.push({
        type: type,
        text: text,
        action: onclick
      });
    }
  });
  
  // Extract links
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().trim();
    
    if (href && text) {
      content.links.push({
        url: href,
        text: text
      });
    }
  });
  
  // Extract inline scripts and styles
  $('script').each((i, elem) => {
    const src = $(elem).attr('src');
    const content_script = $(elem).html();
    
    if (src) {
      content.scripts.push({ type: 'external', src: src });
    } else if (content_script && content_script.trim()) {
      content.scripts.push({ type: 'inline', content: content_script.substring(0, 200) + '...' });
    }
  });
  
  return content;
}

// Function to generate comprehensive PDF
async function generatePDF(manifest, contentData, files) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: manifest.title || 'SCORM Course Analysis',
        Author: 'SCORM PDF Analyzer',
        Subject: 'SCORM Package Content Export',
        Keywords: 'SCORM, eLearning, Content Analysis'
      }
    });
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    
    // Helper function to add page break if needed
    const checkPageBreak = (neededSpace = 100) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - neededSpace) {
        doc.addPage();
      }
    };
    
    // Title Page
    doc.fontSize(28).font('Helvetica-Bold').text(manifest.title || 'SCORM Course Analysis', { align: 'center' });
    doc.moveDown(1);
    
    doc.fontSize(16).font('Helvetica')
       .text('📊 Comprehensive Content Analysis Report', { align: 'center' });
    
    doc.moveDown(3);
    
    doc.fontSize(14).font('Helvetica')
       .text(`Package ID: ${manifest.identifier}`, { align: 'center' })
       .text(`Version: ${manifest.version}`, { align: 'center' })
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
       .text(`Total Files: ${Object.keys(files).length}`, { align: 'center' })
       .text(`HTML Pages: ${contentData.length}`, { align: 'center' });
    
    doc.addPage();
    
    // Table of Contents
    doc.fontSize(20).font('Helvetica-Bold').text('📋 Table of Contents');
    doc.moveDown();
    
    const tocItems = [
      'Course Structure',
      'Content Analysis',
      'Assessments & Quizzes',
      'Interactive Elements',
      'Media Assets',
      'Technical Resources'
    ];
    
    doc.fontSize(12).font('Helvetica');
    tocItems.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`, { continued: true });
      doc.text(`${index + 3}`, { align: 'right' });
    });
    
    // Course Structure
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('🏗️ Course Structure');
    doc.moveDown();
    
    manifest.organizations.forEach(org => {
      doc.fontSize(16).font('Helvetica-Bold').text(`📚 ${org.title}`);
      doc.moveDown(0.5);
      
      const renderItems = (items, indent = 0) => {
        items.forEach(item => {
          checkPageBreak(30);
          const indentText = '  '.repeat(indent);
          const bullet = indent === 0 ? '📖' : '📄';
          doc.fontSize(11).font('Helvetica').text(`${indentText}${bullet} ${item.title}`);
          if (item.children && item.children.length > 0) {
            renderItems(item.children, indent + 1);
          }
        });
      };
      
      renderItems(org.items);
      doc.moveDown();
    });
    
    // Content Analysis
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('📝 Content Analysis');
    doc.moveDown();
    
    contentData.forEach((content, index) => {
      checkPageBreak(150);
      
      // Page header
      doc.fontSize(16).font('Helvetica-Bold').text(`${index + 1}. ${content.title}`);
      doc.fontSize(10).font('Helvetica').text(`File: ${content.fileName}`, { color: 'gray' });
      doc.moveDown();
      
      // Structure headings
      if (content.structure.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('📋 Content Structure:');
        doc.moveDown(0.3);
        
        content.structure.forEach(item => {
          const indent = '  '.repeat(item.level - 1);
          const fontSize = Math.max(12 - item.level, 9);
          doc.fontSize(fontSize).font('Helvetica').text(`${indent}• ${item.text}`);
        });
        doc.moveDown();
      }
      
      // Text content
      if (content.text.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('📄 Text Content:');
        doc.moveDown(0.3);
        
        content.text.slice(0, 10).forEach(textItem => {
          checkPageBreak(40);
          const preview = textItem.text.length > 200 ? 
                         textItem.text.substring(0, 200) + '...' : 
                         textItem.text;
          doc.fontSize(9).font('Helvetica').text(`• ${preview}`, { align: 'justify' });
          doc.moveDown(0.2);
        });
        
        if (content.text.length > 10) {
          doc.fontSize(9).font('Helvetica-Oblique').text(`... and ${content.text.length - 10} more text blocks`);
        }
        doc.moveDown();
      }
      
      // Images
      if (content.images.length > 0) {
        checkPageBreak(100);
        doc.fontSize(12).font('Helvetica-Bold').text('🖼️ Images & Media:');
        doc.moveDown(0.3);
        
        content.images.forEach(img => {
          doc.fontSize(9).font('Helvetica').text(`📷 ${img.src}`);
          if (img.caption) {
            doc.fontSize(8).font('Helvetica-Oblique').text(`   Caption: ${img.caption}`);
          }
          if (img.width && img.height) {
            doc.fontSize(8).font('Helvetica').text(`   Dimensions: ${img.width} x ${img.height}`);
          }
          doc.moveDown(0.2);
        });
        doc.moveDown();
      }
      
      // Interactive elements
      if (content.interactions.length > 0) {
        checkPageBreak(80);
        doc.fontSize(12).font('Helvetica-Bold').text('🔘 Interactive Elements:');
        doc.moveDown(0.3);
        
        content.interactions.forEach(interaction => {
          doc.fontSize(9).font('Helvetica').text(`• ${interaction.type}: ${interaction.text}`);
          if (interaction.action) {
            doc.fontSize(8).font('Helvetica-Oblique').text(`   Action: ${interaction.action.substring(0, 100)}...`);
          }
          doc.moveDown(0.2);
        });
        doc.moveDown();
      }
      
      // Links
      if (content.links.length > 0) {
        checkPageBreak(60);
        doc.fontSize(12).font('Helvetica-Bold').text('🔗 Links:');
        doc.moveDown(0.3);
        
        content.links.forEach(link => {
          doc.fontSize(9).font('Helvetica').text(`• ${link.text} → ${link.url}`);
          doc.moveDown(0.2);
        });
        doc.moveDown();
      }
      
      doc.moveDown(2);
    });
    
    // Assessments & Quizzes
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('🎯 Assessments & Quizzes');
    doc.moveDown();
    
    let totalQuestions = 0;
    contentData.forEach((content, contentIndex) => {
      if (content.quizzes.length > 0) {
        checkPageBreak(100);
        doc.fontSize(16).font('Helvetica-Bold').text(`From: ${content.title}`);
        doc.moveDown(0.5);
        
        content.quizzes.forEach((quiz, quizIndex) => {
          doc.fontSize(14).font('Helvetica-Bold').text(`📝 ${quiz.title}`);
          doc.moveDown(0.5);
          
          quiz.questions.forEach((question, questionIndex) => {
            checkPageBreak(80);
            totalQuestions++;
            
            doc.fontSize(12).font('Helvetica-Bold').text(`Q${questionIndex + 1}: ${question.question}`);
            doc.moveDown(0.3);
            
            question.answers.forEach((answer, aIndex) => {
              doc.fontSize(10).font('Helvetica').text(`   ${answer.letter}) ${answer.text}`);
            });
            doc.moveDown(0.5);
          });
          doc.moveDown();
        });
      }
    });
    
    if (totalQuestions === 0) {
      doc.fontSize(12).font('Helvetica').text('No quizzes or assessments found in this SCORM package.');
    } else {
      doc.fontSize(14).font('Helvetica-Bold').text(`📊 Total Questions Found: ${totalQuestions}`);
    }
    
    // Interactive Elements Summary
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('⚡ Interactive Elements Summary');
    doc.moveDown();
    
    const allInteractions = contentData.flatMap(content => content.interactions);
    const interactionTypes = {};
    
    allInteractions.forEach(interaction => {
      interactionTypes[interaction.type] = (interactionTypes[interaction.type] || 0) + 1;
    });
    
    if (Object.keys(interactionTypes).length > 0) {
      Object.entries(interactionTypes).forEach(([type, count]) => {
        doc.fontSize(12).font('Helvetica').text(`• ${type}: ${count} instances`);
      });
    } else {
      doc.fontSize(12).font('Helvetica').text('No interactive elements found in this SCORM package.');
    }
    
    // Media Assets Summary
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('🎨 Media Assets Summary');
    doc.moveDown();
    
    const mediaStats = {
      images: 0,
      videos: 0,
      audio: 0,
      other: 0
    };
    
    Object.keys(files).forEach(fileName => {
      if (/\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(fileName)) mediaStats.images++;
      else if (/\.(mp4|avi|mov|wmv|flv)$/i.test(fileName)) mediaStats.videos++;
      else if (/\.(mp3|wav|ogg|m4a)$/i.test(fileName)) mediaStats.audio++;
      else if (!/\.(html|css|js|xml|txt)$/i.test(fileName)) mediaStats.other++;
    });
    
    doc.fontSize(14).font('Helvetica-Bold').text('📊 Media File Count:');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica')
       .text(`🖼️ Images: ${mediaStats.images}`)
       .text(`🎥 Videos: ${mediaStats.videos}`)
       .text(`🔊 Audio: ${mediaStats.audio}`)
       .text(`📎 Other Media: ${mediaStats.other}`);
    
    // Technical Resources
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('⚙️ Technical Resources');
    doc.moveDown();
    
    doc.fontSize(14).font('Helvetica-Bold').text('📁 File Structure:');
    doc.moveDown(0.5);
    
    const filesByType = {};
    Object.keys(files).forEach(fileName => {
      const ext = path.extname(fileName).toLowerCase() || 'no extension';
      filesByType[ext] = (filesByType[ext] || 0) + 1;
    });
    
    Object.entries(filesByType).forEach(([ext, count]) => {
      doc.fontSize(10).font('Helvetica').text(`• ${ext}: ${count} files`);
    });
    
    doc.moveDown();
    
    // Resources from manifest
    doc.fontSize(14).font('Helvetica-Bold').text('📋 SCORM Resources:');
    doc.moveDown(0.5);
    
    manifest.resources.forEach((resource, index) => {
      checkPageBreak(60);
      doc.fontSize(11).font('Helvetica-Bold').text(`Resource ${index + 1}: ${resource.identifier}`);
      doc.fontSize(9).font('Helvetica')
         .text(`  Type: ${resource.type}`)
         .text(`  Launch File: ${resource.href}`)
         .text(`  Files: ${resource.files.length} associated files`);
      doc.moveDown(0.5);
    });
    
    // Generation timestamp
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique').text(
      `Generated by SCORM PDF Analyzer on ${new Date().toLocaleString()}`,
      { align: 'center', color: 'gray' }
    );
    
    doc.end();
  });
}

// Upload and process endpoint
app.post('/analyze', upload.single('scormFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    
    console.log('Processing SCORM file:', req.file.originalname);
    
    // Extract ZIP contents
    const files = await extractZip(req.file.path);
    console.log('Extracted', Object.keys(files).length, 'files');
    
    // Look for manifest file
    const manifestFile = files['imsmanifest.xml'] || files['IMSMANIFEST.XML'];
    if (!manifestFile) {
      return res.status(400).send('No imsmanifest.xml found in ZIP file');
    }
    
    // Parse manifest
    const manifest = parseManifest(manifestFile.content);
    console.log('Parsed manifest, found', manifest.organizations.length, 'organizations');
    
    // Process all HTML files
    const contentData = [];
    Object.keys(files).forEach(fileName => {
      if (files[fileName].isHTML) {
        console.log('Processing HTML file:', fileName);
        const content = parseHTMLContent(files[fileName].content, fileName, files);
        contentData.push(content);
      }
    });
    
    console.log('Processed', contentData.length, 'HTML files');
    console.log('Found', contentData.reduce((sum, c) => sum + c.quizzes.length, 0), 'quizzes total');
    
    // Generate PDF
    console.log('Generating PDF...');
    const pdfBuffer = await generatePDF(manifest, contentData, files);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Send PDF
    const fileName = `${manifest.title || 'SCORM-Analysis'}-${Date.now()}.pdf`.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    console.log('Sending PDF:', fileName);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error processing SCORM file:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).send(`Error processing SCORM file: ${error.message}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`SCORM to PDF Analyzer running on port ${port}`);
});
