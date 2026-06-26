import { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { config } from '../config';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  // Duplicate key (e.g. unique UTR / email) surfaced from Mongo
  if (err?.code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Duplicate value', details: err.keyValue } });
    return;
  }
  // a malformed ObjectId path param throws a Mongoose CastError — treat as not-found rather than 500
  if (err?.name === 'CastError') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: config.nodeEnv === 'production' ? 'Internal server error' : String(err?.message ?? err),
    },
  });
};
