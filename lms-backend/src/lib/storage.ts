import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

// Internal client — for any server-side S3 operations (reaches MinIO over the docker network).
export const s3 = new S3Client({
  endpoint: config.minio.endpoint,
  region: config.minio.region,
  credentials: { accessKeyId: config.minio.accessKey, secretAccessKey: config.minio.secretKey },
  forcePathStyle: config.minio.forcePathStyle,
});

// Public client — signs presigned URLs against the browser/host-reachable endpoint.
// Presigning is a local signing operation (no network call), so signing with the public
// host (e.g. http://localhost:9000) yields URLs the browser can actually PUT/GET to.
const s3Public = new S3Client({
  endpoint: config.minio.publicEndpoint,
  region: config.minio.region,
  credentials: { accessKeyId: config.minio.accessKey, secretAccessKey: config.minio.secretKey },
  forcePathStyle: config.minio.forcePathStyle,
});

export function getUploadUrl(key: string, mime: string): Promise<string> {
  return getSignedUrl(s3Public, new PutObjectCommand({ Bucket: config.minio.bucket, Key: key, ContentType: mime }), {
    expiresIn: 300,
  });
}
export function getDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: config.minio.bucket, Key: key }), { expiresIn: 300 });
}
