import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoanTimeline } from '../loan-timeline';

describe('LoanTimeline', () => {
  it('falls back to the status flow when no entries are given', () => {
    render(<LoanTimeline status="DISBURSED" />);
    expect(screen.getByText('APPLIED')).toBeInTheDocument();
    expect(screen.getByText('DISBURSED')).toBeInTheDocument();
  });
  it('renders an audit list with actor and detail when entries are given', () => {
    render(<LoanTimeline status="CLOSED" entries={[
      { type: 'APPLIED', at: '2026-06-19T10:00:00.000Z', actor: { id: 'u1', name: 'Rahul Kumar' } },
      { type: 'SANCTIONED', at: '2026-06-20T10:00:00.000Z', actor: { id: 's1', name: 'Sanction Exec' }, detail: 'Approved' },
      { type: 'PAYMENT', at: '2026-06-25T10:00:00.000Z', actor: { id: 'c1', name: 'Collection Exec' }, detail: '₹2,03,945 · UTR V2-1' },
    ]} />);
    expect(screen.getByText(/Rahul Kumar/)).toBeInTheDocument();
    expect(screen.getByText(/Sanction Exec/)).toBeInTheDocument();
    expect(screen.getByText(/UTR V2-1/)).toBeInTheDocument();
    expect(screen.getByText('SANCTIONED')).toBeInTheDocument();
  });
  it('shows APPLIED → CANCELLED terminal state (no entries)', () => {
    render(<LoanTimeline status="CANCELLED" />);
    expect(screen.getByText(/APPLIED/)).toBeInTheDocument();
    expect(screen.getByText(/CANCELLED/)).toBeInTheDocument();
    // Should NOT render the happy-path flow nodes (SANCTIONED, DISBURSED, CLOSED)
    expect(screen.queryByText('SANCTIONED')).not.toBeInTheDocument();
    expect(screen.queryByText('DISBURSED')).not.toBeInTheDocument();
    expect(screen.queryByText('CLOSED')).not.toBeInTheDocument();
  });
  it('renders entries list including a CANCELLED entry when entries are given', () => {
    render(<LoanTimeline status="CANCELLED" entries={[
      { type: 'APPLIED', at: '2026-06-19T10:00:00.000Z', actor: { id: 'u1', name: 'Rahul Kumar' } },
      { type: 'CANCELLED', at: '2026-06-20T09:00:00.000Z', actor: { id: 'u1', name: 'Rahul Kumar' }, detail: 'Customer request' },
    ]} />);
    expect(screen.getByText('APPLIED')).toBeInTheDocument();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.getByText(/Customer request/)).toBeInTheDocument();
  });
});
