export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}
export class AuthError extends AppError {
  constructor(message = 'Unauthenticated') {
    super(401, 'UNAUTHENTICATED', message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
export class CaptchaError extends AppError {
  constructor(message = 'Captcha verification failed') { super(422, 'CAPTCHA_INVALID', message); }
}
export class ProductNotFoundError extends AppError {
  constructor(message = 'Loan product not found') { super(404, 'PRODUCT_NOT_FOUND', message); }
}
export class ProductBoundsError extends AppError {
  constructor(message: string, details?: unknown) { super(422, 'PRODUCT_BOUNDS', message, details); }
}
export class ProductEligibilityError extends AppError {
  constructor(failedRules: string[]) {
    super(422, 'PRODUCT_ELIGIBILITY_FAILED', 'Eligibility check failed for this product', { failedRules });
  }
}
export class ProductCodeExistsError extends AppError {
  constructor(message = 'A product with this code already exists') { super(409, 'PRODUCT_CODE_EXISTS', message); }
}
