/**
 * File Upload Middleware using Multer
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/;
  const allowedExts = /\.jpeg|\.jpg|\.png|\.gif|\.webp|\.pdf/;
  const isValidMime = allowedMimes.test(file.mimetype);
  const isValidExt = allowedExts.test(path.extname(file.originalname).toLowerCase());
  if (isValidMime && isValidExt) return cb(null, true);
  cb(new Error('Only image or PDF files are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

module.exports = upload;
