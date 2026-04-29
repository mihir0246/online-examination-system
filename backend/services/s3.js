import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Initialize S3 Client
export const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Upload a buffer or stream to S3
 * @param {Buffer|ReadableStream} body - The file content
 * @param {string} key - The destination path in the bucket
 * @param {string} contentType - The MIME type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadToS3 = async (body, key, contentType, acl = 'public-read') => {
    const bucketName = process.env.S3_BUCKET_NAME;
    
    if (!bucketName) {
        throw new Error("S3_BUCKET_NAME environment variable is not set.");
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: acl
    });

    await s3Client.send(command);

    // Return both the key and the location
    return {
        key: key,
        location: `https://${bucketName}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`
    };
};
