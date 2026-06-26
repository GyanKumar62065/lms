import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../lib/logger';

export async function connectDb(uri: string = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    minPoolSize: config.mongoPoolMin,
    maxPoolSize: config.mongoPoolMax,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  logger.info('MongoDB connected');
  return mongoose;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
