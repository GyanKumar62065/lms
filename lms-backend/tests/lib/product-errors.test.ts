import {
  ProductNotFoundError,
  ProductBoundsError,
  ProductEligibilityError,
  ProductCodeExistsError,
  AppError,
} from '../../src/lib/errors';

describe('product errors', () => {
  it('ProductNotFoundError is a 404 with PRODUCT_NOT_FOUND', () => {
    const e = new ProductNotFoundError();
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('PRODUCT_NOT_FOUND');
  });
  it('ProductBoundsError is a 422 carrying details', () => {
    const e = new ProductBoundsError('out of range', { minPrincipal: 50000, maxPrincipal: 500000 });
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('PRODUCT_BOUNDS');
    expect(e.details).toEqual({ minPrincipal: 50000, maxPrincipal: 500000 });
  });
  it('ProductEligibilityError is a 422 carrying failedRules', () => {
    const e = new ProductEligibilityError(['AGE', 'SALARY']);
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('PRODUCT_ELIGIBILITY_FAILED');
    expect(e.details).toEqual({ failedRules: ['AGE', 'SALARY'] });
  });
  it('ProductCodeExistsError is a 409 with PRODUCT_CODE_EXISTS', () => {
    const e = new ProductCodeExistsError();
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('PRODUCT_CODE_EXISTS');
  });
});
