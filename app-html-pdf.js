const express = require('express');
const multer = require('multer');
const yauzl = require('yauzl');
const path = require('path');
const fs = require('fs');
const { DOMParser } = require('xmldom');
const pdf = require('html-pdf');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }
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
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.6; color: #1a1a1a;
                background: linear-gradient(135deg, #ff6b35 0%, #ff8f65 100%);
                min-height: 100vh; display: flex; align-items: center;
                justify-content: center; padding: 20px;
            }
            
            .container {
                background: white; border-radius: 24px; padding: 60px;
                max-width: 600px; width: 100%;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                text-align: center;
            }
            
            .logo {
                width: 64px; height: 64px;
                background: linear-gradient(135deg, #ff6b35, #ff8f65);
                border-radius: 16px; display: flex; align-items: center;
                justify-content: center; margin: 0 auto 32px;
                font-size: 28px; color: white;
            }
            
            h1 { font-size: 42px; font-weight: 700; margin-bottom: 16px; color: #1a1a1a; letter-spacing: -0.02em; }
            .subtitle { font-size: 18px; color: #6b7280; margin-bottom: 48px; line-height: 1.6; }
            
            .upload-area {
                border: 2px dashed #d1d5db; border-radius: 16px;
                padding: 48px 24px; margin-bottom: 32px;
                transition: all 0.3s ease; cursor: pointer; background: #f9fafb;
            }
            .upload-area:hover, .upload-area.dragover {
                border-color: #ff6b35; background: #fff5f0; transform: translateY(-2px);
            }
            
            .upload-icon { font-size: 48px; margin-bottom: 16px; color: #9ca3af; }
            .upload-area h3 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #374151; }
            .upload-area p { color: #6b7280; margin-bottom: 24px; }
            
            .file-input { display: none; }
            .file-button {
                background: #ff6b35; color: white; padding: 14px 28px;
                border: none; border-radius: 12px; font-size: 16px;
                font-weight: 600; cursor: pointer; transition: all 0.3s ease;
                display: inline-block;
            }
            .file-button:hover { background: #e55a2b; transform: translateY(-1px); }
            
            .selected-file {
                margin-top: 16px; padding: 12px 16px; background: #ecfdf5;
                border-radius: 8px; color: #047857; font-size: 14px; display: none;
            }
            
            .analyze-button {
                background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                color: white; padding: 16px 32px; border: none;
                border-radius: 12px; font-size: 18px; font-weight: 600;
                cursor: pointer; transition: all 0.3s ease; width: 100%; margin-top: 24px;
            }
            .analyze-button:hover {
                transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
            }
            .analyze-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
            
            .processing {
                display: none; text-align: center; margin-top: 32px;
                padding: 32px; background: #f3f4f6; border-radius: 12px;
            }
            .processing.show { display: block; }
            
            .spinner {
                width: 32px; height: 32px; border: 3px solid #f3f4f6;
                border-top: 3px solid #ff6b35; border-radius: 50%;
                animation: spin 1s linear infinite; margin: 0 auto 16px;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            
            .processing h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #374151; }
            .processing p { color: #6b7280; font-size: 14px; }
            
            @media (max-width: 640px) {
                .container { padding: 40px 24px; margin: 20px; }
                h1 { font-size: 32px; }
                .upload-area { padding: 32px 16px; }
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
                <p>Rendering HTML pages to PDF</p>
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

// Helper function to extract ZIP
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
                isHTML: /\.html?$/i.test(entry.fileName)
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

// Parse manifest
function parseManifest(xmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  
  const manifest = {
    identifier: '',
    version: '',
    title: '',
    organizations: [],
    resources: []
  };
  
  const manifestNode = doc.getElementsByTagName('manifest')[0];
  if (manifestNode) {
    manifest.identifier = manifestNode.getAttribute('identifier') || '';
    manifest.version = manifestNode.getAttribute('version') || '';
  }
  
  const orgs = doc.getElementsByTagName('organization');
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const title = org.getElementsByTagName('title')[0];
    if (title) {
      manifest.title = title.textContent;
      break;
    }
  }
  
  return manifest;
}

// HTML-to-PDF conversion with embedded images
async function generatePDFFromHTML(manifest, htmlFiles, files) {
  return new Promise((resolve, reject) => {
    let combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${manifest.title || 'SCORM Course'}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6; color: #333; margin: 0; padding: 20px;
            background: white;
          }
          .page-break { page-break-before: always; margin-top: 40px; }
          .course-header { 
            background: linear-gradient(135deg, #ff6b35, #ff8f65);
            color: white; padding: 30px; border-radius: 12px;
            text-align: center; margin-bottom: 30px;
          }
          .course-title { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .page-title { 
            font-size: 22px; font-weight: bold; color: #ff6b35;
            margin: 30px 0 20px 0; padding-bottom: 10px;
            border-bottom: 2px solid #ff6b35;
          }
          .content-wrapper {
            max-width: 800px; margin: 0 auto;
            background: white; padding: 20px;
            border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
          }
          .original-content {
            font-size: 14px; line-height: 1.8;
          }
          .original-content h1, .original-content h2, .original-content h3 {
            color: #333; margin: 20px 0 10px 0;
          }
          .original-content p { margin: 10px 0; }
          .original-content img {
            max-width: 100%; height: auto; margin: 15px 0;
            border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .navigation-section {
            background: #f8f9fa; padding: 20px; border-radius: 8px;
            margin: 20px 0; border-left: 4px solid #ff6b35;
          }
          .nav-item {
            padding: 8px 0; border-bottom: 1px solid #eee;
            font-weight: 500;
          }
          .quiz-section {
            background: #fff5f0; padding: 20px; border-radius: 8px;
            margin: 20px 0; border: 2px solid #ff6b35;
          }
          .question { margin: 15px 0; padding: 15px; background: white; border-radius: 6px; }
          .metadata {
            background: #f0f0f0; padding: 15px; border-radius: 8px;
            margin: 20px 0; font-size: 12px; color: #666;
          }
          .file-info {
            background: #e3f2fd; padding: 10px; border-radius: 6px;
            margin: 10px 0; font-size: 12px; color: #1565c0;
          }
        </style>
      </head>
      <body>
        <div class="course-header">
          <div class="course-title">${manifest.title || 'SCORM Course Report'}</div>
          <div>Complete Visual Rendering</div>
        </div>
        
        <div class="metadata">
          <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
          <strong>Package ID:</strong> ${manifest.identifier}<br>
          <strong>HTML Pages:</strong> ${htmlFiles.length}<br>
          <strong>Total Files:</strong> ${Object.keys(files).length}
        </div>
    `;
    
    // Process each HTML file
    htmlFiles.forEach((fileName, index) => {
      console.log(`Processing HTML file: ${fileName}`);
      
      if (index > 0) {
        combinedHTML += '<div class="page-break"></div>';
      }
      
      combinedHTML += `<div class="page-title">Page ${index + 1}: ${path.basename(fileName)}</div>`;
      combinedHTML += `<div class="file-info">Source: ${fileName}</div>`;
      
      let htmlContent = files[fileName].content;
      const $ = cheerio.load(htmlContent);
      
      // Convert relative image paths to embedded base64
      $('img').each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          // Try to find the image file
          const possiblePaths = [
            src,
            src.replace(/^\.\//, ''),
            src.replace(/^\//, ''),
            path.join(path.dirname(fileName), src),
            Object.keys(files).find(f => f.endsWith(path.basename(src)))
          ].filter(Boolean);
          
          let imageFile = null;
          for (const imagePath of possiblePaths) {
            if (files[imagePath] && files[imagePath].isImage) {
              imageFile = files[imagePath];
              break;
            }
          }
          
          if (imageFile) {
            try {
              const ext = path.extname(src).toLowerCase();
              let mimeType = 'image/jpeg';
              
              if (ext === '.png') mimeType = 'image/png';
              else if (ext === '.gif') mimeType = 'image/gif';
              else if (ext === '.svg') mimeType = 'image/svg+xml';
              else if (ext === '.webp') mimeType = 'image/webp';
              
              const base64 = imageFile.buffer.toString('base64');
              $(elem).attr('src', `data:${mimeType};base64,${base64}`);
              console.log(`Embedded image: ${src}`);
            } catch (error) {
              console.error(`Error embedding image ${src}:`, error.message);
            }
          }
        }
      });
      
      // Clean up and preserve the body content
      $('script').remove(); // Remove scripts for cleaner output
      
      // Get the full body content with all styling preserved
      let bodyContent = $('body').html() || htmlContent;
      
      // If no body tag, use the whole content
      if (!bodyContent || bodyContent.trim() === '') {
        bodyContent = $.html();
      }
      
      combinedHTML += `
        <div class="content-wrapper">
          <div class="original-content">
            ${bodyContent}
          </div>
        </div>
      `;
    });
    
    combinedHTML += '</body></html>';
    
    // PDF generation options
    const options = {
      format: 'A4',
      border: {
        top: '15mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      },
      header: {
        height: '12mm',
        contents: `<div style="text-align: center; font-size: 10px; color: #666; font-family: Arial;">${manifest.title || 'SCORM Course'}</div>`
      },
      footer: {
        height: '12mm',
        contents: {
          default: '<div style="text-align: center; font-size: 10px; color: #666; font-family: Arial;">Page {{page}} of {{pages}}</div>'
        }
      },
      quality: '100',
      type: 'pdf',
      timeout: 60000
    };
    
    console.log('Generating PDF from combined HTML...');
    
    pdf.create(combinedHTML, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('PDF generation error:', err);
        reject(err);
      } else {
        console.log('PDF generated successfully');
        resolve(buffer);
      }
    });
  });
}

// Main processing endpoint
app.post('/analyze', upload.single('scormFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    
    console.log('Processing SCORM file:', req.file.originalname);
    
    // Extract ZIP contents
    const files = await extractZip(req.file.path);
    console.log('Extracted', Object.keys(files).length, 'files');
    
    // Find manifest
    const manifestFile = files['imsmanifest.xml'] || files['IMSMANIFEST.XML'];
    if (!manifestFile) {
      return res.status(400).send('No imsmanifest.xml found');
    }
    
    // Parse manifest
    const manifest = parseManifest(manifestFile.content);
    console.log('Course title:', manifest.title);
    
    // Find all HTML files
    const htmlFiles = Object.keys(files).filter(fileName => files[fileName].isHTML);
    console.log('Found HTML files:', htmlFiles);
    
    if (htmlFiles.length === 0) {
      return res.status(400).send('No HTML files found in SCORM package');
    }
    
    // Generate PDF
    console.log('Generating PDF...');
    const pdfBuffer = await generatePDFFromHTML(manifest, htmlFiles, files);
    
    // Clean up
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
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 'html-pdf' });
});

app.listen(port, () => {
  console.log(`SCORM to PDF (html-pdf) running on port ${port}`);
});
