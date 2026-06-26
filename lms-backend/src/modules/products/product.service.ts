import { Types } from 'mongoose';
import { LoanProduct } from '../../models/loan-product.model';
import { rupeesToPaise } from '../../lib/money';
import { ProductCodeExistsError, ProductNotFoundError, ValidationError } from '../../lib/errors';
import { CreateProductInput, UpdateProductInput } from './product.dto';

export async function listProducts(includeInactive: boolean) {
  const filter = includeInactive ? {} : { status: 'ACTIVE' };
  return LoanProduct.find(filter).sort({ name: 1 });
}

export async function getProductByCode(code: string) {
  const product = await LoanProduct.findOne({ code: code.toUpperCase() });
  if (!product) throw new ProductNotFoundError();
  return product;
}

function toPaiseDoc(input: CreateProductInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    interestRate: input.interestRate,
    minPrincipal: rupeesToPaise(input.minPrincipal),
    maxPrincipal: rupeesToPaise(input.maxPrincipal),
    minTenureDays: input.minTenureDays,
    maxTenureDays: input.maxTenureDays,
    eligibility: {
      minAge: input.eligibility.minAge,
      maxAge: input.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(input.eligibility.minMonthlySalary),
      employmentModes: input.eligibility.employmentModes,
    },
    ...(input.category != null ? { category: input.category } : {}),
    status: 'ACTIVE' as const,
  };
}

export async function createProduct(input: CreateProductInput) {
  const existing = await LoanProduct.findOne({ code: input.code });
  if (existing) throw new ProductCodeExistsError();
  try {
    return await LoanProduct.create(toPaiseDoc(input));
  } catch (err: any) {
    if (err?.code === 11000) throw new ProductCodeExistsError();
    throw err;
  }
}

/**
 * Partial update with merged-range revalidation.
 *
 * The DTO's updateProductDto is partial, so a PATCH of only {minPrincipal: 999999}
 * passes DTO validation (no maxPrincipal to compare against). The service MUST
 * fetch the stored product, convert it to rupees, merge the patch, then
 * re-validate range invariants on the merged result before saving.
 * If any invariant is violated, throws a 422 ValidationError.
 */
export async function updateProduct(id: string, patch: UpdateProductInput) {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError();
  const stored = await LoanProduct.findById(id);
  if (!stored) throw new ProductNotFoundError();

  // Build the merged view in rupees (what the final state would look like)
  const mergedMinPrincipal = patch.minPrincipal ?? stored.minPrincipal / 100;
  const mergedMaxPrincipal = patch.maxPrincipal ?? stored.maxPrincipal / 100;
  const mergedMinTenureDays = patch.minTenureDays ?? stored.minTenureDays;
  const mergedMaxTenureDays = patch.maxTenureDays ?? stored.maxTenureDays;

  const storedEligibility = stored.eligibility as {
    minAge: number;
    maxAge: number;
    minMonthlySalary: number;
    employmentModes: string[];
  };
  const mergedMinAge = patch.eligibility?.minAge ?? storedEligibility.minAge;
  const mergedMaxAge = patch.eligibility?.maxAge ?? storedEligibility.maxAge;

  // Re-validate range invariants on the merged result
  const rangeErrors: string[] = [];
  if (mergedMinPrincipal > mergedMaxPrincipal) {
    rangeErrors.push(`minPrincipal (${mergedMinPrincipal}) must be <= maxPrincipal (${mergedMaxPrincipal}) after patch`);
  }
  if (mergedMinTenureDays > mergedMaxTenureDays) {
    rangeErrors.push(`minTenureDays (${mergedMinTenureDays}) must be <= maxTenureDays (${mergedMaxTenureDays}) after patch`);
  }
  if (mergedMinAge > mergedMaxAge) {
    rangeErrors.push(`minAge (${mergedMinAge}) must be <= maxAge (${mergedMaxAge}) after patch`);
  }
  if (rangeErrors.length > 0) {
    throw new ValidationError('Range invariants violated after merge: ' + rangeErrors.join('; '));
  }

  // Build the $set document
  const set: Record<string, unknown> = {};
  if (patch.name != null) set.name = patch.name;
  if (patch.description != null) set.description = patch.description;
  if (patch.interestRate != null) set.interestRate = patch.interestRate;
  if (patch.minPrincipal != null) set.minPrincipal = rupeesToPaise(patch.minPrincipal);
  if (patch.maxPrincipal != null) set.maxPrincipal = rupeesToPaise(patch.maxPrincipal);
  if (patch.minTenureDays != null) set.minTenureDays = patch.minTenureDays;
  if (patch.maxTenureDays != null) set.maxTenureDays = patch.maxTenureDays;
  if (patch.eligibility != null) {
    set.eligibility = {
      minAge: patch.eligibility.minAge,
      maxAge: patch.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(patch.eligibility.minMonthlySalary),
      employmentModes: patch.eligibility.employmentModes,
    };
  }
  if (patch.category != null) set.category = patch.category;

  const product = await LoanProduct.findByIdAndUpdate(id, { $set: set }, { new: true });
  if (!product) throw new ProductNotFoundError();
  return product;
}

export async function setProductStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError();
  const product = await LoanProduct.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!product) throw new ProductNotFoundError();
  return product;
}
