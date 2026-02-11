const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectory based on date
    const dateDir = new Date().toISOString().split('T')[0];
    const destDir = path.join(uploadDir, dateDir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common file types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
    'audio/mpeg', 'audio/wav',
    'application/zip', 'application/x-rar-compressed'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 // 50MB default
  }
});

// Get uploads
router.get('/', (req, res) => {
  try {
    const { project_id, client_id, category } = req.query;
    
    let query = `
      SELECT u.*, usr.name as uploaded_by_name
      FROM uploads u
      JOIN users usr ON u.uploaded_by = usr.id
      WHERE 1=1
    `;
    const params = [];

    // Clients can only see their own uploads or uploads for their projects
    if (req.user.role === 'client') {
      query += ' AND (u.client_id = ? OR u.uploaded_by = ?)';
      params.push(req.user.id, req.user.id);
    } else {
      if (client_id) {
        query += ' AND u.client_id = ?';
        params.push(client_id);
      }
    }

    if (project_id) {
      query += ' AND u.project_id = ?';
      params.push(project_id);
    }

    if (category) {
      query += ' AND u.category = ?';
      params.push(category);
    }

    query += ' ORDER BY u.created_at DESC';

    const uploads = db.prepare(query).all(...params);

    res.json({ uploads });
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

// Upload file
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { project_id, client_id, category = 'general' } = req.body;

    // Verify access
    if (req.user.role === 'client') {
      if (project_id) {
        const project = db.prepare('SELECT id FROM projects WHERE id = ? AND client_id = ?')
          .get(project_id, req.user.id);
        if (!project) {
          // Delete uploaded file
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ error: 'Invalid project' });
        }
      }
    }

    const uploadId = uuidv4();
    const relativePath = path.relative(uploadDir, req.file.path);

    db.prepare(`
      INSERT INTO uploads (id, client_id, project_id, filename, original_name, mime_type, size, category, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uploadId,
      client_id || (req.user.role === 'client' ? req.user.id : null),
      project_id || null,
      relativePath,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      category,
      req.user.id
    );

    const uploadRecord = db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId);

    // Notify admin if client uploaded
    if (req.user.role === 'client') {
      const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      if (admin) {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          admin.id,
          'file_uploaded',
          'New File Upload',
          `${req.user.name} uploaded a file: ${req.file.originalname}`,
          project_id ? `/projects/${project_id}` : '/uploads'
        );
      }
    }

    res.status(201).json({ 
      message: 'File uploaded successfully',
      upload: uploadRecord,
      url: `/uploads/${relativePath}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up file if database insert failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload multiple files
router.post('/multiple', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { project_id, client_id, category = 'general' } = req.body;
    const uploads = [];

    for (const file of req.files) {
      const uploadId = uuidv4();
      const relativePath = path.relative(uploadDir, file.path);

      db.prepare(`
        INSERT INTO uploads (id, client_id, project_id, filename, original_name, mime_type, size, category, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uploadId,
        client_id || (req.user.role === 'client' ? req.user.id : null),
        project_id || null,
        relativePath,
        file.originalname,
        file.mimetype,
        file.size,
        category,
        req.user.id
      );

      uploads.push({
        id: uploadId,
        filename: file.originalname,
        url: `/uploads/${relativePath}`
      });
    }

    res.status(201).json({ 
      message: `${uploads.length} files uploaded successfully`,
      uploads
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Delete upload
router.delete('/:id', (req, res) => {
  try {
    const uploadRecord = db.prepare('SELECT * FROM uploads WHERE id = ?').get(req.params.id);
    
    if (!uploadRecord) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Check access
    if (req.user.role === 'client' && uploadRecord.uploaded_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file
    const filePath = path.join(uploadDir, uploadRecord.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete record
    db.prepare('DELETE FROM uploads WHERE id = ?').run(req.params.id);

    res.json({ message: 'Upload deleted successfully' });
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Failed to delete upload' });
  }
});

module.exports = router;
