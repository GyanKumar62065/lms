import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
  it('renders an APPLIED badge', () => {
    render(<StatusBadge status="APPLIED" />);
    expect(screen.getByText('APPLIED')).toBeInTheDocument();
  });
  it('renders a SANCTIONED badge', () => {
    render(<StatusBadge status="SANCTIONED" />);
    expect(screen.getByText('SANCTIONED')).toBeInTheDocument();
  });
  it('renders a REJECTED badge', () => {
    render(<StatusBadge status="REJECTED" />);
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
  });
  it('renders a DISBURSED badge', () => {
    render(<StatusBadge status="DISBURSED" />);
    expect(screen.getByText('DISBURSED')).toBeInTheDocument();
  });
  it('renders a CLOSED badge', () => {
    render(<StatusBadge status="CLOSED" />);
    expect(screen.getByText('CLOSED')).toBeInTheDocument();
  });
  it('renders a CANCELLED badge', () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText(/CANCELLED/)).toBeInTheDocument();
  });
});
