// src/components/dashboard/charts/__tests__/chart-container.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartContainer } from '../chart-container';
import { CHART_COLORS, chartColor } from '../chart-colors';

describe('ChartContainer', () => {
  it('renders its title and children host', () => {
    render(<ChartContainer title="Loans by status" testId="donut"><div /></ChartContainer>);
    expect(screen.getByText('Loans by status')).toBeInTheDocument();
    expect(screen.getByTestId('donut')).toBeInTheDocument();
  });
  it('chartColor cycles through the 5 theme tokens', () => {
    expect(CHART_COLORS).toHaveLength(5);
    expect(chartColor(0)).toBe('var(--chart-1)');
    expect(chartColor(5)).toBe('var(--chart-1)');
    expect(chartColor(6)).toBe('var(--chart-2)');
  });
});
