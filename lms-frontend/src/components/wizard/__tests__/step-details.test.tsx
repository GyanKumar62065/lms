import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepDetails } from '../step-details';
import { ApiError } from '@/lib/api/client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { putProfile: vi.fn() } }));

describe('StepDetails — BRE 422 rendering', () => {
  beforeEach(async () => {
    const { endpoints } = await import('@/lib/api/endpoints');
    vi.mocked(endpoints.putProfile).mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'BRE failed', { failedRules: ['AGE', 'SALARY'] }),
    );
  });

  it('shows human-readable labels for AGE and SALARY rules and does NOT call onPassed', async () => {
    const onPassed = vi.fn();
    render(<StepDetails onPassed={onPassed} />);

    // Labels have no htmlFor — target inputs by placeholder / type / role
    const inputs = screen.getAllByRole('textbox');
    // inputs order: fullName, pan, dob (type=date may not be textbox), monthlySalary (type=number)
    // Use placeholder for PAN and query by name attr / position for others
    await userEvent.type(screen.getByPlaceholderText('ABCDE1234F'), 'ABCDE1234F'); // PAN input
    await userEvent.type(inputs[0], 'Test User'); // fullName
    // date input
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, '1990-01-01');
    // number input (monthlySalary)
    const numInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await userEvent.type(numInput, '30000');
    // select for employmentMode
    await userEvent.selectOptions(screen.getByRole('combobox'), 'Salaried');

    await userEvent.click(screen.getByRole('button', { name: /check & continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Age must be between 23 and 50')).toBeInTheDocument();
      expect(screen.getByText('Minimum salary ₹25,000/month required')).toBeInTheDocument();
    });

    expect(onPassed).not.toHaveBeenCalled();
  });
});
