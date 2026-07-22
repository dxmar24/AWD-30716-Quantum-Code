const multer = require('multer');
const { env } = require('../config/env');
const { AppError } = require('../exceptions/AppError');

const ALLOWED_EVIDENCE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage:multer.memoryStorage(),
  limits:{ fileSize:env.evidenceMaxBytes, files:1, fields:4 },
  fileFilter:(req, file, callback) => {
    if (!ALLOWED_EVIDENCE_TYPES.has(file.mimetype)) {
      return callback(new AppError('La evidencia debe ser una imagen JPG, PNG o WebP, o un documento PDF.', 422, {
        code:'INVALID_EVIDENCE_FILE_TYPE',
      }));
    }
    return callback(null, true);
  },
});

function uploadAbsenceEvidence(req, res, next) {
  upload.single('evidence')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('La evidencia no puede superar 5 MB.', 413, { code:'EVIDENCE_FILE_TOO_LARGE' }));
    }
    if (error instanceof multer.MulterError) {
      return next(new AppError('No se pudo procesar el archivo de evidencia.', 422, { code:error.code }));
    }
    return next(error);
  });
}

module.exports = { uploadAbsenceEvidence, ALLOWED_EVIDENCE_TYPES };
