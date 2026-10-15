import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadingState, EmptyState, ErrorState } from '../components/ui/StateComponents';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';

describe('UI State & Accessibility Components', () => {
  it('LoadingState renders with role="status" and polite live region', () => {
    render(<LoadingState message="Fetching patient records…" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Fetching patient records…')).toBeInTheDocument();
  });

  it('EmptyState renders title, description, and accessible action button', async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();

    render(
      <EmptyState
        title="No medications found"
        description="Add your first prescription to begin tracking doses."
        action={{ label: 'Add Medication', onClick: handleAction }}
      />
    );

    expect(screen.getByText('No medications found')).toBeInTheDocument();
    expect(screen.getByText('Add your first prescription to begin tracking doses.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Add Medication' });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('ErrorState renders with role="alert" and accessible retry button', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    render(
      <ErrorState
        title="Failed to load appointments"
        description="Network connection lost."
        onRetry={handleRetry}
      />
    );

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Failed to load appointments')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    await user.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('Button supports loading state and aria-busy attribute', () => {
    render(<Button loading>Save Changes</Button>);
    const button = screen.getByRole('button', { name: 'Save Changes' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('Input links error message with aria-describedby and sets aria-invalid', () => {
    render(
      <Input
        label="Email Address"
        id="test-email"
        error="Please enter a valid email."
      />
    );
    const input = screen.getByLabelText(/Email Address/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-email-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email.');
  });

  it('Select links helpText with aria-describedby', () => {
    render(
      <Select
        label="Blood Group"
        id="test-blood"
        helpText="Required for emergency records."
        options={[{ value: 'O+', label: 'O Positive' }]}
      />
    );
    const select = screen.getByLabelText(/Blood Group/i);
    expect(select).toHaveAttribute('aria-describedby', 'test-blood-help');
    expect(screen.getByText('Required for emergency records.')).toBeInTheDocument();
  });
});
