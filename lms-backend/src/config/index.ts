import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1),
  MONGO_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  MONGO_POOL_MAX: z.coerce.number().int().positive().default(20),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  PASSWORD_PEPPER: z.string().min(1),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  MINIO_ENDPOINT: z.string().url(),
  // browser/host-reachable endpoint used to SIGN presigned URLs (defaults to MINIO_ENDPOINT);
  // in Docker this must be e.g. http://localhost:9000 since the browser can't resolve `minio:9000`
  MINIO_PUBLIC_ENDPOINT: z.string().url().optional(),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  TRUST_PROXY: z.string().optional(),
  CORS_ORIGIN: z.string().min(1),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    mongoUri: e.MONGO_URI,
    mongoPoolMin: e.MONGO_POOL_MIN,
    mongoPoolMax: e.MONGO_POOL_MAX,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      refreshSecret: e.JWT_REFRESH_SECRET,
      accessTtl: e.JWT_ACCESS_TTL,
      refreshTtl: e.JWT_REFRESH_TTL,
    },
    passwordPepper: e.PASSWORD_PEPPER,
    bcryptRounds: e.BCRYPT_ROUNDS,
    minio: {
      endpoint: e.MINIO_ENDPOINT,
      publicEndpoint: e.MINIO_PUBLIC_ENDPOINT ?? e.MINIO_ENDPOINT,
      region: e.MINIO_REGION,
      accessKey: e.MINIO_ACCESS_KEY,
      secretKey: e.MINIO_SECRET_KEY,
      bucket: e.MINIO_BUCKET,
      forcePathStyle: true,
    },
    trustProxy: e.TRUST_PROXY,
    corsOrigin: e.CORS_ORIGIN,
    cookie: { secure: e.COOKIE_SECURE, sameSite: 'strict' as const, domain: e.COOKIE_DOMAIN },
  };
}

export const config = loadConfig(process.env);
