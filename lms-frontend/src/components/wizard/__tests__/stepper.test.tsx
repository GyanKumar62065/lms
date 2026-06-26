import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from '../stepper';
describe('Stepper', () => {
  it('marks prior steps complete and current active', () => {
    render(<Stepper steps={['Account', 'Details', 'Slip', 'Apply']} current={1} />);
    expect(screen.getByText('Account').closest('[data-state]')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByText('Details').closest('[data-state]')).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Slip').closest('[data-state]')).toHaveAttribute('data-state', 'upcoming');
  });
});
