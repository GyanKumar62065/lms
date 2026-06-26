import { loadConfig } from '../../src/config';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  MONGO_URI: 'mongodb://localhost:27017/lms',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PASSWORD_PEPPER: 'pepper',
  MINIO_ENDPOINT: 'http://localhost:9000',
  MINIO_ACCESS_KEY: 'minio',
  MINIO_SECRET_KEY: 'minio123',
  MINIO_BUCKET: 'salary-slips',
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('loadConfig — TRUST_PROXY', () => {
  it('exposes trustProxy when set', () => {
    const cfg = loadConfig({ ...validEnv, TRUST_PROXY: '1' });
    expect(cfg.trustProxy).toBe('1');
  });

  it('trustProxy is undefined when not set', () => {
    const cfg = loadConfig(validEnv);
    expect(cfg.trustProxy).toBeUndefined();
  });
});
