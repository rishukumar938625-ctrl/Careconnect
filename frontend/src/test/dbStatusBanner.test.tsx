import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DbStatusBanner } from '../components/ui/DbStatusBanner';
import { healthCheckApi, DbHealth } from '../services/api';

describe('DbStatusBanner Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when database health check returns connected', async () => {
    vi.spyOn(healthCheckApi, 'checkDatabase').mockResolvedValueOnce({
      status: 'connected',
      database: 'connected',
      readyState: 1,
      timestamp: new Date().toISOString(),
    });

    render(<DbStatusBanner />);

    // Wait for async effect to resolve
    await waitFor(() => {
      expect(healthCheckApi.checkDatabase).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('db-status-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Database Unavailable')).not.toBeInTheDocument();
  });

  it('renders the database unavailable banner when database is disconnected', async () => {
    vi.spyOn(healthCheckApi, 'checkDatabase').mockResolvedValueOnce({
      status: 'disconnected',
      database: 'disconnected',
      readyState: 0,
      timestamp: new Date().toISOString(),
      message: 'Database connection is not established',
    });

    render(<DbStatusBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('db-status-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Database Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/The database connection is currently down/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('renders the banner when health check encounters a network failure', async () => {
    vi.spyOn(healthCheckApi, 'checkDatabase').mockRejectedValueOnce(
      new Error('Unable to connect to the server')
    );

    render(<DbStatusBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('db-status-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Database Unavailable')).toBeInTheDocument();
  });

  it('dismisses only the visual banner when Dismiss is clicked without falsely marking healthy', async () => {
    const user = userEvent.setup();

    vi.spyOn(healthCheckApi, 'checkDatabase').mockResolvedValueOnce({
      status: 'disconnected',
      database: 'disconnected',
      readyState: 0,
      timestamp: new Date().toISOString(),
    });

    render(<DbStatusBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('db-status-banner')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissBtn);

    // Banner is dismissed visually
    expect(screen.queryByTestId('db-status-banner')).not.toBeInTheDocument();
  });

  it('triggers a fresh health check and calls onReconnect when Retry succeeds', async () => {
    const user = userEvent.setup();
    const handleReconnect = vi.fn();

    // First call: disconnected
    // Second call (triggered by Retry): connected
    const checkSpy = vi.spyOn(healthCheckApi, 'checkDatabase')
      .mockResolvedValueOnce({
        status: 'disconnected',
        database: 'disconnected',
        readyState: 0,
        timestamp: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        status: 'connected',
        database: 'connected',
        readyState: 1,
        timestamp: new Date().toISOString(),
      });

    render(<DbStatusBanner onReconnect={handleReconnect} />);

    await waitFor(() => {
      expect(screen.getByTestId('db-status-banner')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    // Expect second call to checkDatabase
    await waitFor(() => {
      expect(checkSpy).toHaveBeenCalledTimes(2);
    });

    // Banner should disappear upon successful recovery
    await waitFor(() => {
      expect(screen.queryByTestId('db-status-banner')).not.toBeInTheDocument();
    });

    // onReconnect callback must be invoked to trigger dashboard data reload
    expect(handleReconnect).toHaveBeenCalledTimes(1);
  });

  it('displays loading state "Checking…" on Retry button while in-flight', async () => {
    const user = userEvent.setup();

    let resolveRetry!: (value: DbHealth) => void;
    const retryPromise = new Promise<DbHealth>((resolve) => {
      resolveRetry = resolve;
    });

    vi.spyOn(healthCheckApi, 'checkDatabase')
      .mockResolvedValueOnce({
        status: 'disconnected',
        database: 'disconnected',
        readyState: 0,
        timestamp: new Date().toISOString(),
      })
      .mockReturnValueOnce(retryPromise);

    render(<DbStatusBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('db-status-banner')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    // While in-flight, button shows "Checking…" and is disabled
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(retryBtn).toBeDisabled();

    // Resolve second request
    resolveRetry({
      status: 'connected',
      database: 'connected',
      readyState: 1,
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(screen.queryByTestId('db-status-banner')).not.toBeInTheDocument();
    });
  });
});
