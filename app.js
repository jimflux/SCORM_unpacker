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

// Clean Tilda-style interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SCORM to PDF</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
                background: linear-gradient(135deg, #ff6b35 0%, #ff8f65 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .container {
                background: white;
                border-radius: 24px;
                padding: 60px;
                max-width: 600px;
                width: 100%;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                text-align: center;
            }
            
            .logo {
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, #ff6b35, #ff8f65);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 32px;
                font-size: 28px;
                color: white;
            }
            
            h1 {
                font-size: 42px;
                font-weight: 700;
                margin-bottom: 16px;
                color: #1a1a1a;
                letter-spacing: -0.02em;
            }
            
            .subtitle {
                font-size: 18px;
                color: #6b7280;
                margin-bottom: 48px;
                line-height: 1.6;
            }
            
            .upload-area {
                border: 2px dashed #d1d5db;
                border-radius: 16px;
                padding: 48px 24px;
                margin-bottom: 32px;
                transition: all 0.3s ease;
                cursor: pointer;
                background: #f9fafb;
            }
            
            .upload-area:hover,
            .upload-area.dragover {
                border-color: #ff6b35;
                background: #fff5f0;
                transform: translateY(-2px);
            }
            
            .upload-icon {
                font-size: 48px;
                margin-bottom: 16px;
                color: #9ca3af;
            }
            
            .upload-area h3 {
                font-size: 20px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #374151;
            }
            
            .upload-area p {
                color: #6b7280;
                margin-bottom: 24px;
            }
            
            .file-input {
                display: none;
            }
            
            .file-button {
                background: #ff6b35;
                color: white;
                padding: 14px 28px;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-block;
            }
            
            .file-button:hover {
                background: #e55a2b;
                transform: translateY(-1px);
            }
            
            .selected-file {
                margin-top: 16px;
                padding: 12px 16px;
                background: #ecfdf5;
                border-radius: 8px;
                color: #047857;
                font-size: 14px;
                display: none;
            }
            
            .analyze-button {
                background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                color: white;
                padding: 16px 32px;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
                margin-top: 24px;
            }
            
            .analyze-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            }
            
            .analyze-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .processing {
                display: none;
                text-align: center;
                margin-top: 32px;
                padding: 32px;
                background: #f3f4f6;
                border-radius: 12px;
            }
            
            .processing.show {
                display: block;
            }
            
            .spinner {
                width: 32px;
                height: 32px;
                border: 3px solid #f3f4f6;
                border-top: 3px solid #ff6b35;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .processing h3 {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #374151;
            }
            
            .processing p {
                color: #6b7280;
                font-size: 14px;
            }
            
            @media (max-width: 640px) {
                .container {
                    padding: 40px 24px;
                    margin: 20px;
                }
                
                h1 {
                    font-size: 32px;
                }
                
                .upload-area {
                    padding: 32px 16px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">📚</div>
            <h1>SCORM to PDF</h1>
            <p class="subtitle">Transform your learning content into beautiful reports</p>
            
            <form id="uploadForm" action="/analyze" method="post" enctype="multipart/form-data">
                <div class="upload-area" id="uploadArea">
                    <div class="upload-icon">📁</div>
                    <h3>Drop your SCORM file here</h3>
                    <p>or click to browse</p>
                    <input type="file" name="scormFile" accept=".zip" required class="file-input" id="fileInput">
                    <label for="fileInput" class="file-button">Choose File</label>
                    <div id="selectedFile" class="selected-file"></div>
                </div>
                
                <button type="submit" class="analyze-button" id="analyzeBtn">
                    Generate PDF Report
                </button>
            </form>
            
            <div id="processing" class="processing">
                <div class="spinner"></div>
                <h3>Processing your content...</h3>
                <p>Extracting lessons, images, and assessments</p>
            </div>
        </div>
        
        <script>
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const selectedFile = document.getElementById('selectedFile');
            const analyzeBtn = document.getElementById('analyzeBtn');
            const uploadForm = document.getElementById('uploadForm');
            const processing = document.getElementById('processing');
            
            uploadArea.addEventListener('click', () => fileInput.click());
            
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
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    showSelectedFile(e.target.files[0]);
                }
            });
            
            function showSelectedFile(file) {
                selectedFile.textContent = \`Selected: \${file.name} (\${formatFileSize(file.size)})\`;
                selectedFile.style.display = 'block';
                analyzeBtn.style.background = 'linear-gradient(135deg, #047857 0%, #059669 100%)';
                analyzeBtn.textContent = 'Generate PDF Report';
            }
            
            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
            
            uploadForm.addEventListener('submit', function(e) {
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = 'Processing...';
                processing.classList.add('show');
                uploadArea.style.opacity = '0.6';
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
                isImage: /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(entry.fileName),
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

// Enhanced content extraction function
function parseHTMLContent(htmlContent, fileName, allFiles) {
  const $ = cheerio.load(htmlContent);
  const content = {
    fileName: fileName,
    title: '',
    lessons: [],
    quizzes: [],
    navigation: [],
    images: [],
    allText: [],
    courseProgress: '',
    metadata: {}
  };
  
  // Extract title from multiple sources
  content.title = $('title').text() || 
                  $('.course-title, .lesson-title, h1').first().text() || 
                  fileName;
  
  // Extract course progress if available
  const progressText = $('.progress, .complete, .percentage').text();
  if (progressText) {
    content.courseProgress = progressText;
  }
  
  // Extract navigation items
  $('nav ul li, .nav-item, .navigation li, .menu li').each((i, elem) => {
    const navText = $(elem).text().trim();
    const navLink = $(elem).find('a').attr('href') || '';
    if (navText && navText.length > 2) {
      content.navigation.push({
        text: navText,
        link: navLink,
        isActive: $(elem).hasClass('active') || $(elem).hasClass('current')
      });
    }
  });
  
  // Extract lesson content sections
  $('.lesson, .content-section, .module, .slide').each((i, elem) => {
    const lessonData = {
      title: '',
      content: [],
      images: [],
      number: i + 1
    };
    
    // Get lesson title
    lessonData.title = $(elem).find('h1, h2, h3, .lesson-title').first().text().trim() ||
                      `Lesson ${i + 1}`;
    
    // Extract all paragraphs and text blocks in this lesson
    $(elem).find('p, .text-block, .content-text, div').each((j, textElem) => {
      const text = $(textElem).text().trim();
      if (text && text.length > 20 && !$(textElem).closest('script, style, nav').length) {
        lessonData.content.push(text);
      }
    });
    
    // Extract images in this lesson
    $(elem).find('img').each((j, imgElem) => {
      const src = $(imgElem).attr('src');
      const alt = $(imgElem).attr('alt') || '';
      if (src) {
        lessonData.images.push({
          src: src,
          alt: alt,
          caption: alt
        });
      }
    });
    
    if (lessonData.content.length > 0 || lessonData.images.length > 0) {
      content.lessons.push(lessonData);
    }
  });
  
  // If no lessons found with specific classes, extract content differently
  if (content.lessons.length === 0) {
    const mainContent = {
      title: content.title,
      content: [],
      images: [],
      number: 1
    };
    
    // Extract all meaningful text
    $('body').find('p, div, span, li').each((i, elem) => {
      const text = $(elem).text().trim();
      const tagName = elem.tagName.toLowerCase();
      
      // Skip scripts, styles, nav elements
      if ($(elem).closest('script, style, nav, header, footer').length > 0) return;
      
      // Only include substantial text content
      if (text && text.length > 30 && !text.includes('javascript') && !text.includes('function')) {
        // Check if this text is not already included in a parent element
        const parentText = $(elem).parent().text().trim();
        if (parentText !== text && !mainContent.content.includes(text)) {
          mainContent.content.push(text);
        }
      }
    });
    
    // Extract all images
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      const alt = $(elem).attr('alt') || '';
      if (src) {
        mainContent.images.push({
          src: src,
          alt: alt,
          caption: alt || `Image ${i + 1}`
        });
      }
    });
    
    if (mainContent.content.length > 0 || mainContent.images.length > 0) {
      content.lessons.push(mainContent);
    }
  }
  
  // Extract quiz content
  $('form, .quiz, .question, .assessment').each((i, elem) => {
    const quiz = {
      title: $(elem).find('.quiz-title, h1, h2, h3').first().text().trim() || `Quiz ${i + 1}`,
      questions: []
    };
    
    $(elem).find('.question, fieldset, .quiz-question').each((j, qElem) => {
      const questionText = $(qElem).find('legend, .question-text, label, h4, h5').first().text().trim();
      
      if (questionText) {
        const question = {
          number: j + 1,
          text: questionText,
          answers: []
        };
        
        $(qElem).find('input[type="radio"], input[type="checkbox"]').each((k, input) => {
          const answerText = $(input).next('label').text().trim() || 
                            $(input).parent().text().replace(questionText, '').trim();
          
          if (answerText) {
            question.answers.push({
              letter: String.fromCharCode(65 + k),
              text: answerText
            });
          }
        });
        
        if (question.answers.length > 0) {
          quiz.questions.push(question);
        }
      }
    });
    
    if (quiz.questions.length > 0) {
      content.quizzes.push(quiz);
    }
  });
  
  // Collect all images with their file references
  $('img').each((i, elem) => {
    const src = $(elem).attr('src');
    const alt = $(elem).attr('alt') || '';
    
    if (src) {
      // Try to find the actual file
      const imagePath = Object.keys(allFiles).find(filePath => 
        filePath.includes(src) || filePath.endsWith(src.split('/').pop())
      );
      
      content.images.push({
        src: src,
        alt: alt,
        caption: alt || `Image ${i + 1}`,
        filePath: imagePath,
        buffer: imagePath ? allFiles[imagePath]?.buffer : null
      });
    }
  });
  
  return content;
}

// Enhanced PDF generation with embedded images
async function generatePDF(manifest, contentData, files) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: manifest.title || 'SCORM Course Report',
        Author: 'SCORM PDF Generator',
        Subject: 'Learning Content Analysis'
      }
    });
    
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    
    // Helper function for page breaks
    const checkPageBreak = (space = 100) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - space) {
        doc.addPage();
      }
    };
    
    // Helper function to add images
    const addImage = (imageData, maxWidth = 400, maxHeight = 300) => {
      if (!imageData.buffer) return;
      
      try {
        // Check if we have enough space for the image
        checkPageBreak(maxHeight + 50);
        
        const imageOptions = {
          fit: [maxWidth, maxHeight],
          align: 'center'
        };
        
        doc.image(imageData.buffer, doc.x, doc.y, imageOptions);
        
        // Add caption if available
        if (imageData.caption) {
          const imageHeight = doc._imageHeight || maxHeight;
          doc.y += imageHeight + 10;
          doc.fontSize(10).font('Helvetica-Oblique')
             .text(imageData.caption, { align: 'center' });
        }
        
        doc.moveDown(1);
      } catch (error) {
        // If image fails to load, just add a placeholder
        doc.fontSize(10).font('Helvetica-Oblique')
           .text(`[Image: ${imageData.caption || imageData.src}]`, { align: 'center' });
        doc.moveDown(0.5);
      }
    };
    
    // Title Page
    doc.fontSize(32).font('Helvetica-Bold')
       .text(manifest.title || 'Learning Content Report', { align: 'center' });
    
    doc.moveDown(2);
    
    doc.fontSize(16).font('Helvetica')
       .text('Complete Course Analysis', { align: 'center' });
    
    doc.moveDown(4);
    
    // Course summary
    const totalLessons = contentData.reduce((sum, content) => sum + content.lessons.length, 0);
    const totalQuizzes = contentData.reduce((sum, content) => sum + content.quizzes.length, 0);
    const totalImages = contentData.reduce((sum, content) => sum + content.images.length, 0);
    
    doc.fontSize(14).font('Helvetica')
       .text(`📚 ${totalLessons} Lessons`, { align: 'center' })
       .text(`❓ ${totalQuizzes} Quizzes`, { align: 'center' })
       .text(`🖼️ ${totalImages} Images`, { align: 'center' })
       .text(`📅 Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    
    // Course Content
    contentData.forEach((content, pageIndex) => {
      if (content.lessons.length === 0 && content.quizzes.length === 0) return;
      
      doc.addPage();
      
      // Page title
      doc.fontSize(24).font('Helvetica-Bold')
         .text(content.title, { align: 'left' });
      
      if (content.courseProgress) {
        doc.fontSize(12).font('Helvetica')
           .text(`Progress: ${content.courseProgress}`, { color: '#666666' });
      }
      
      doc.moveDown(1);
      
      // Navigation menu if available
      if (content.navigation.length > 0) {
        doc.fontSize(16).font('Helvetica-Bold').text('📋 Course Navigation');
        doc.moveDown(0.5);
        
        content.navigation.forEach(navItem => {
          const marker = navItem.isActive ? '▶' : '•';
          doc.fontSize(12).font('Helvetica')
             .text(`${marker} ${navItem.text}`);
        });
        
        doc.moveDown(1);
      }
      
      // Lessons
      content.lessons.forEach((lesson, lessonIndex) => {
        checkPageBreak(100);
        
        doc.fontSize(18).font('Helvetica-Bold')
           .text(`Lesson ${lesson.number}: ${lesson.title}`);
        doc.moveDown(0.5);
        
        // Lesson content
        lesson.content.forEach(paragraph => {
          checkPageBreak(60);
          doc.fontSize(11).font('Helvetica')
             .text(paragraph, { align: 'justify' });
          doc.moveDown(0.5);
        });
        
        // Lesson images
        lesson.images.forEach(image => {
          addImage(image);
        });
        
        doc.moveDown(1);
      });
      
      // All page images (if not already included in lessons)
      const unattachedImages = content.images.filter(img => 
        !content.lessons.some(lesson => 
          lesson.images.some(lessonImg => lessonImg.src === img.src)
        )
      );
      
      if (unattachedImages.length > 0) {
        checkPageBreak(100);
        doc.fontSize(16).font('Helvetica-Bold').text('📸 Additional Images');
        doc.moveDown(0.5);
        
        unattachedImages.forEach(image => {
          addImage(image);
        });
      }
      
      // Quizzes
      content.quizzes.forEach((quiz, quizIndex) => {
        checkPageBreak(150);
        
        doc.fontSize(18).font('Helvetica-Bold')
           .text(`📝 ${quiz.title}`);
        doc.moveDown(0.5);
        
        quiz.questions.forEach((question, qIndex) => {
          checkPageBreak(80);
          
          doc.fontSize(12).font('Helvetica-Bold')
             .text(`Question ${question.number}: ${question.text}`);
          doc.moveDown(0.3);
          
          question.answers.forEach(answer => {
            doc.fontSize(11).font('Helvetica')
               .text(`   ${answer.letter}) ${answer.text}`);
          });
          doc.moveDown(0.5);
        });
        
        doc.moveDown(1);
      });
    });
    
    // Technical Summary
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold').text('🔧 Technical Summary');
    doc.moveDown();
    
    const fileStats = {
      html: 0,
      images: 0,
      css: 0,
      js: 0,
      other: 0
    };
    
    Object.keys(files).forEach(fileName => {
      if (files[fileName].isHTML) fileStats.html++;
      else if (files[fileName].isImage) fileStats.images++;
      else if (files[fileName].isCSS) fileStats.css++;
      else if (files[fileName].isJS) fileStats.js++;
      else fileStats.other++;
    });
    
    doc.fontSize(12).font('Helvetica')
       .text(`📄 HTML Files: ${fileStats.html}`)
       .text(`🖼️ Image Files: ${fileStats.images}`)
       .text(`🎨 CSS Files: ${fileStats.css}`)
       .text(`⚡ JavaScript Files: ${fileStats.js}`)
       .text(`📎 Other Files: ${fileStats.other}`)
       .moveDown()
       .text(`📦 Total Files: ${Object.keys(files).length}`)
       .text(`🆔 Package ID: ${manifest.identifier}`)
       .text(`📋 SCORM Version: ${manifest.version}`);
    
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
    console.log('Parsed manifest:', manifest.title);
    
    // Process all HTML files
    const contentData = [];
    Object.keys(files).forEach(fileName => {
      if (files[fileName].isHTML) {
        console.log('Processing HTML file:', fileName);
        const content = parseHTMLContent(files[fileName].content, fileName, files);
        if (content.lessons.length > 0 || content.quizzes.length > 0 || content.navigation.length > 0) {
          contentData.push(content);
        }
      }
    });
    
    console.log('Found content in', contentData.length, 'files');
    console.log('Total lessons:', contentData.reduce((sum, c) => sum + c.lessons.length, 0));
    console.log('Total quizzes:', contentData.reduce((sum, c) => sum + c.quizzes.length, 0));
    
    // Generate PDF
    console.log('Generating PDF with embedded images...');
    const pdfBuffer = await generatePDF(manifest, contentData, files);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Send PDF
    const fileName = `${manifest.title || 'SCORM-Report'}-${Date.now()}.pdf`.replace(/[^a-zA-Z0-9-_]/g, '-');
    
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
  console.log(`SCORM to PDF Generator running on port ${port}`);
});
