import request from 'supertest';
import { createApp } from '../../src/app';

describe('health', () => {
  it('GET /healthz returns ok', async () => {
    const res = await request(createApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
