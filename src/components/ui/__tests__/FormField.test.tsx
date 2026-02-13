import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../../test/test-utils';
import FormField from '../FormField';

describe('FormField', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  it('renders an input element', () => {
    render(<FormField {...defaultProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with the correct label', () => {
    render(<FormField {...defaultProps} label="Email Address" />);
    expect(screen.getByText('Email Address')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = render(<FormField {...defaultProps} />);
    expect(container.querySelector('label')).toBeNull();
  });

  it('renders input with correct type', () => {
    render(<FormField {...defaultProps} type="email" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('defaults to text type', () => {
    render(<FormField {...defaultProps} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('displays the current value', () => {
    render(<FormField {...defaultProps} value="hello@test.com" />);
    expect(screen.getByDisplayValue('hello@test.com')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(<FormField {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'a');

    expect(onChange).toHaveBeenCalled();
  });

  it('renders placeholder text', () => {
    render(<FormField {...defaultProps} placeholder="Enter email..." />);
    expect(screen.getByPlaceholderText('Enter email...')).toBeInTheDocument();
  });

  it('renders suffix element when provided', () => {
    const suffix = <button data-testid="suffix-btn">👁</button>;
    render(<FormField {...defaultProps} suffix={suffix} />);
    expect(screen.getByTestId('suffix-btn')).toBeInTheDocument();
  });

  it('sets required attribute when specified', () => {
    render(<FormField {...defaultProps} required />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.required).toBe(true);
  });
});
