import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { healthCheckApi } from '../../services/api';

/**
 * A persistent status banner that checks database connectivity
 * and shows a user-friendly warning when the backend database
 * is disconnected or unreachable.
 *
 * Renders nothing when the database is healthy.
 */
export const DbStatusBanner: React.FC = () => {
  const [dbDown, setDbDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkDbHealth = useCallback(async () => {
    setChecking(true);
    try {
      const res = await healthCheckApi.checkDatabase();
      setDbDown(res.status !== 'connected');
      if (res.status === 'connected') setDismissed(false);
    } catch {
      setDbDown(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkDbHealth();

    // Re-check every 30 seconds in background
    const interval = setInterval(checkDbHealth, 30_000);
    return () => clearInterval(interval);
  }, [checkDbHealth]);

  if (!dbDown || dismissed) return null;

  return (
    <div
      className="mx-auto max-w-lg mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex-shrink-0 mt-0.5">
          <WifiOff className="h-4.5 w-4.5" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">Database Unavailable</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            The database connection is currently down. Some features may not work properly. This is
            typically caused by a network issue or IP address not being whitelisted in MongoDB Atlas.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={checkDbHealth}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {checking ? 'Checking…' : 'Retry'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 hover:text-amber-800 hover:bg-amber-100/60 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" aria-hidden="true" />
      </div>
    </div>
  );
};
