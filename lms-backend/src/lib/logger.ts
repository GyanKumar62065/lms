import pino from 'pino';
import { config } from '../config';
export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.passwordHash', '*.password'],
});
