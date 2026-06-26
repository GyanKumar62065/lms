import { ClientSession } from 'mongoose';
import { nextSequence } from '../models/counter.model';

export async function generateLoanRef(session?: ClientSession): Promise<string> {
  const seq = await nextSequence('loanRef', session);
  const year = new Date().getFullYear();
  return `LMS-${year}-${String(seq).padStart(6, '0')}`;
}
