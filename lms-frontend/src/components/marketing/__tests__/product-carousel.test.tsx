import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCarousel } from '../product-carousel';
const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ code: `P${i}`, name: `Loan ${i}`, interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: {}, status: 'ACTIVE' } as any));
describe('ProductCarousel', () => {
  it('renders at most 5 tiles and a see-more link', () => {
    render(<ProductCarousel products={mk(8)} />);
    expect(screen.getAllByTestId('carousel-tile')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /see more loans/i })).toHaveAttribute('href', '/products');
  });
  it('links each tile to its detail page', () => {
    render(<ProductCarousel products={mk(1)} />);
    expect(screen.getByRole('link', { name: /Loan 0/ })).toHaveAttribute('href', '/products/P0');
  });
});
