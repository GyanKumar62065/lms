import { loadConfig } from '../../src/config';

const base = {
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

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(4000);
    expect(cfg.jwt.accessSecret.length).toBeGreaterThanOrEqual(32);
    expect(cfg.bcryptRounds).toBe(12); // default
  });

  it('throws when a required var is missing', () => {
    const { MONGO_URI, ...broken } = base;
    expect(() => loadConfig(broken)).toThrow(/MONGO_URI/);
  });

  it('throws when a secret is too short', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });
});
