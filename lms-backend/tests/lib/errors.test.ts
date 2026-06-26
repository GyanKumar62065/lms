import { AppError, NotFoundError, ConflictError, ValidationError } from '../../src/lib/errors';

describe('AppError hierarchy', () => {
  it('NotFoundError maps to 404', () => {
    const e = new NotFoundError('Loan not found');
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });
  it('ConflictError maps to 409', () => {
    expect(new ConflictError('dup').statusCode).toBe(409);
  });
  it('ValidationError carries details', () => {
    const e = new ValidationError('bad', { failedRules: ['AGE'] });
    expect(e.statusCode).toBe(422);
    expect(e.details).toEqual({ failedRules: ['AGE'] });
  });
});
