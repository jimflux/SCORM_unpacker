const express = require('express');
const multer = require('multer');
const yauzl = require('yauzl');
const path = require('path');
const fs = require('fs');
const { DOMParser } = require('xmldom');

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.use(express.static('public'));

// HTML interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SCORM Unpacker</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 50px auto; 
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #333; text-align: center; }
            .upload-area {
                border: 3px dashed #ddd;
                border-radius: 10px;
                padding: 40px;
                text-align: center;
                margin: 20px 0;
                transition: border-color 0.3s;
            }
            .upload-area:hover { border-color: #007bff; }
            input[type="file"] {
                margin: 20px 0;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                width: 100%;
            }
            button {
                background: #007bff;
                color: white;
                padding: 12px 30px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                width: 100%;
            }
            button:hover { background: #0056b3; }
            .result {
                margin-top: 20px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 5px;
                border-left: 4px solid #28a745;
            }
            .error {
                background: #f8d7da;
                border-left-color: #dc3545;
                color: #721c24;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📚 SCORM Package Unpacker</h1>
            <p>Upload a SCORM ZIP file to extract and analyze its contents.</p>
            
            <form action="/upload" method="post" enctype="multipart/form-data">
                <div class="upload-area">
                    <p>📁 Choose your SCORM ZIP file</p>
                    <input type="file" name="scormFile" accept=".zip" required>
                </div>
                <button type="submit">🔍 Analyze SCORM Package</button>
            </form>
        </div>
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
          // Directory entry
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            let content = '';
            readStream.on('data', (chunk) => {
              content += chunk.toString('utf8');
            });
            
            readStream.on('end', () => {
              files[entry.fileName] = content;
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
    schemaVersion: '',
    organizations: [],
    resources: [],
    metadata: {}
  };
  
  // Get manifest attributes
  const manifestNode = doc.getElementsByTagName('manifest')[0];
  if (manifestNode) {
    manifest.identifier = manifestNode.getAttribute('identifier') || '';
    manifest.version = manifestNode.getAttribute('version') || '';
    
    const schemaVersions = manifestNode.getAttribute('schemaversion') || 
                          manifestNode.getAttribute('xsi:schemaLocation') || '';
    manifest.schemaVersion = schemaVersions;
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
    if (title) orgData.title = title.textContent;
    
    // Parse items
    const items = org.getElementsByTagName('item');
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const itemData = {
        identifier: item.getAttribute('identifier') || '',
        identifierref: item.getAttribute('identifierref') || '',
        title: ''
      };
      
      const itemTitle = item.getElementsByTagName('title')[0];
      if (itemTitle) itemData.title = itemTitle.textContent;
      
      orgData.items.push(itemData);
    }
    
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

// Upload and process endpoint
app.post('/upload', upload.single('scormFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    
    // Extract ZIP contents
    const files = await extractZip(req.file.path);
    
    // Look for manifest file
    const manifestFile = files['imsmanifest.xml'] || files['IMSMANIFEST.XML'];
    if (!manifestFile) {
      return res.status(400).send('No imsmanifest.xml found in ZIP file');
    }
    
    // Parse manifest
    const manifest = parseManifest(manifestFile);
    
    // Generate text report
    let report = `SCORM PACKAGE ANALYSIS REPORT
${'='.repeat(50)}

PACKAGE INFORMATION:
- Identifier: ${manifest.identifier}
- Version: ${manifest.version}
- Schema Version: ${manifest.schemaVersion}

ORGANIZATIONS (${manifest.organizations.length}):
${manifest.organizations.map((org, i) => `
${i + 1}. ${org.title} (${org.identifier})
   Learning Items (${org.items.length}):
   ${org.items.map((item, j) => `   ${j + 1}. ${item.title} [${item.identifier}] -> ${item.identifierref}`).join('\n')}
`).join('')}

RESOURCES (${manifest.resources.length}):
${manifest.resources.map((res, i) => `
${i + 1}. ${res.identifier}
   Type: ${res.type}
   Launch File: ${res.href}
   Dependencies: ${res.files.length} files
   Files: ${res.files.join(', ')}
`).join('')}

FILE STRUCTURE:
${Object.keys(files).sort().map(filename => `- ${filename} (${files[filename].length} chars)`).join('\n')}

DETAILED FILE CONTENTS:
${'='.repeat(30)}

MANIFEST CONTENT:
${manifestFile}

${Object.entries(files)
  .filter(([filename]) => filename !== 'imsmanifest.xml' && filename !== 'IMSMANIFEST.XML')
  .map(([filename, content]) => `
FILE: ${filename}
${'-'.repeat(filename.length + 6)}
${content.length > 5000 ? content.substring(0, 5000) + '\n\n[Content truncated - file too large]' : content}
`).join('\n')}

END OF REPORT
${'='.repeat(50)}
Generated on: ${new Date().toISOString()}
`;
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Send as downloadable text file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="scorm-analysis.txt"');
    res.send(report);
    
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
  console.log(`SCORM Unpacker running on port ${port}`);
});