import bcrypt from 'bcrypt';
import { config } from '../config';

function peppered(plain: string): string {
  return `${plain}${config.passwordPepper}`;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(peppered(plain), config.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(peppered(plain), hash);
}
