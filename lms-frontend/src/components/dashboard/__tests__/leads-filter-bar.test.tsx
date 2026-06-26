// src/components/dashboard/__tests__/leads-filter-bar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
import { LeadsFilterBar } from '../leads-filter-bar';

beforeEach(() => push.mockReset());

describe('LeadsFilterBar', () => {
  it('pushes the chosen stage to the URL', async () => {
    render(<LeadsFilterBar current={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/stage/i), 'SLIP_UPLOADED');
    expect(push).toHaveBeenCalledWith('/sales?stage=SLIP_UPLOADED');
  });
});
