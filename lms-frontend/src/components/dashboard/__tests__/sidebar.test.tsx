import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('next/navigation', () => ({ usePathname: () => '/sanction' }));
import { Sidebar } from '../sidebar';

const ALL = ['metrics:read','lead:read','loan:sanction','loan:disburse','payment:create','loan:read:all','product:manage','rbac:read'];

beforeEach(() => localStorage.clear());

describe('Sidebar', () => {
  it('renders labels expanded and has no "LMS Ops" wordmark', () => {
    render(<Sidebar permissions={ALL} />);
    expect(screen.getByText('Sanction')).toBeInTheDocument();
    expect(screen.queryByText(/LMS Ops/i)).toBeNull();
  });

  it('collapses to icons-only and persists the choice', async () => {
    const { unmount } = render(<Sidebar permissions={ALL} />);
    await userEvent.click(screen.getByRole('button', { name: /collapse/i }));
    // label text hidden in collapsed mode
    expect(screen.queryByText('Sanction')).toBeNull();
    // still reachable by accessible name (title/aria-label)
    expect(screen.getByRole('link', { name: /sanction/i })).toBeInTheDocument();
    expect(localStorage.getItem('lms.sidebar.collapsed')).toBe('true');
    unmount();
    render(<Sidebar permissions={ALL} />);
    expect(screen.queryByText('Sanction')).toBeNull(); // restored collapsed
  });

  it('filters nav by permission', () => {
    render(<Sidebar permissions={['loan:sanction']} />);
    expect(screen.getByRole('link', { name: /sanction/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^roles$/i })).toBeNull();
  });
});
