import { createProductDto, updateProductDto } from '../../../src/modules/products/product.dto';
import { serializeProduct } from '../../../src/modules/products/product.serializer';

const valid = {
  code: 'personal', name: 'Personal Loan', description: 'd', interestRate: 12,
  minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
};

describe('product DTOs', () => {
  it('accepts a valid product and uppercases the code', () => {
    const r = createProductDto.parse(valid);
    expect(r.code).toBe('PERSONAL');
  });
  it('rejects minPrincipal > maxPrincipal', () => {
    expect(() => createProductDto.parse({ ...valid, minPrincipal: 600000 })).toThrow();
  });
  it('rejects minAge > maxAge', () => {
    expect(() => createProductDto.parse({ ...valid, eligibility: { ...valid.eligibility, minAge: 60 } })).toThrow();
  });
  it('rejects empty employmentModes', () => {
    expect(() => createProductDto.parse({ ...valid, eligibility: { ...valid.eligibility, employmentModes: [] } })).toThrow();
  });
  it('update DTO allows a partial patch', () => {
    const r = updateProductDto.parse({ interestRate: 15 });
    expect(r.interestRate).toBe(15);
  });
  it('update DTO still rejects an inverted range when both present', () => {
    expect(() => updateProductDto.parse({ minPrincipal: 9, maxPrincipal: 1 })).toThrow();
  });
});

describe('serializeProduct', () => {
  it('converts paise to rupees', () => {
    const out = serializeProduct({
      _id: { toString: () => 'abc' }, code: 'PERSONAL', name: 'Personal Loan', description: 'd',
      interestRate: 12, minPrincipal: 5_000_000, maxPrincipal: 50_000_000, minTenureDays: 30, maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 2_500_000, employmentModes: ['Salaried'] },
      status: 'ACTIVE', createdAt: new Date(0), updatedAt: new Date(0),
    } as any);
    expect(out.minPrincipal).toBe(50000);
    expect(out.maxPrincipal).toBe(500000);
    expect(out.eligibility.minMonthlySalary).toBe(25000);
    expect(out.id).toBe('abc');
  });
});
