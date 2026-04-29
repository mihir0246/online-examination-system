import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import { s3Client, uploadToS3 } from "../services/s3.js";
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import FileType from 'file-type';
const { fileTypeFromBuffer } = FileType;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(filename) {
  const baseName = path.basename(filename);
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Use memory storage to allow magic byte validation before uploading to S3
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

router.post('/', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // 1. Validate magic bytes using file-type
        const fileTypeResult = await fileTypeFromBuffer(req.file.buffer);
        
        // If file-type can't detect the type or it's not allowed
        if (!fileTypeResult || !ALLOWED_MIME_TYPES.includes(fileTypeResult.mime)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
            });
        }

        // 2. Generate S3 key
        const fileName = Date.now().toString() + '-' + sanitizeFilename(req.file.originalname);
        const key = `uploads/${fileName}`;

        // 3. Upload to S3 with private ACL
        await uploadToS3(req.file.buffer, key, fileTypeResult.mime, 'private');

        // 4. Generate Pre-signed URL (expires in 1 hour)
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({
            success: true,
            message: 'File uploaded successfully',
            link: signedUrl,
            s3Key: key
        });
    } catch (error) {
        next(error);
    }
});

// Error handling middleware for multer errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'File upload failed'
        });
    }
    next();
});

export default router;
