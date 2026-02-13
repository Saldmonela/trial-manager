import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../../test/test-utils';
import Modal from '../Modal';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content here</p>,
  };

  it('renders children when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Modal content here')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Modal content here')).not.toBeInTheDocument();
  });

  it('displays the title when provided', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('does not display title header when title is not provided', () => {
    render(<Modal {...defaultProps} title={undefined} />);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    // Content should still render
    expect(screen.getByText('Modal content here')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    // The backdrop is the outer div with the onClick={onClose}
    const backdrop = screen.getByText('Modal content here').closest('div')!.parentElement!;
    await userEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when modal content area is clicked (stopPropagation)', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    await userEvent.click(screen.getByText('Modal content here'));

    // onClose should NOT be called from content click
    // (only from backdrop; the inner div stops propagation)
    expect(onClose).not.toHaveBeenCalled();
  });
});
